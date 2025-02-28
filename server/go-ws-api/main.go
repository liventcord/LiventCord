package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/url"
	"net/http"
	"os"
	"crypto/tls"
	"sync"
	"strings"
	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"github.com/joho/godotenv"
	"github.com/gorilla/websocket"
)

type Hub struct {
	clients map[string]*websocket.Conn
	lock    sync.RWMutex
}

var hub = Hub{
	clients: make(map[string]*websocket.Conn),
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

type EventMessage struct {
	EventType string          `json:"event_type"`
	Payload   json.RawMessage `json:"payload"`
}

var redisClient *redis.Client
var ctx = context.Background()

func loadConfig() {
	if err := godotenv.Load(); err != nil {
		fmt.Println("Error loading .env file")
	}
}



func getEnv(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}


func handleWebSocket(c *gin.Context) {
    cookieHeader := c.Request.Header.Get("Sec-WebSocket-Protocol")
    cookie := strings.TrimPrefix(cookieHeader, "cookie-")

    if cookie == "" {
        c.JSON(http.StatusUnauthorized, gin.H{"message": "Session missing"})
        return
    }
	DOTNET_API_URL := getEnv("DotnetApiUrl","http://localhost:5005")
	req, err := http.NewRequest("POST", DOTNET_API_URL+"/auth/validate-session", nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Internal server error"})
		return
	}
	req.Header.Set("Cookie", ".AspNetCore.Cookies="+cookie)
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil || resp.StatusCode != http.StatusOK {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Session invalid"})
		return
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Println("Error reading response body:", err)
		return
	}
	userId := string(body)
	if userId == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Invalid user ID"})
		return
	}
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		fmt.Println("Error upgrading WebSocket:", err)
		c.JSON(http.StatusInternalServerError, gin.H{"message": "WebSocket upgrade failed"})
		return
	}
	hub.lock.Lock()
	hub.clients[userId] = conn
	hub.lock.Unlock()
	go func() {
		defer func() {
			hub.lock.Lock()
			delete(hub.clients, userId)
			hub.lock.Unlock()
			conn.Close()
			fmt.Println("WebSocket connection closed for user:", userId)
		}()
		for {
			_, _, err := conn.ReadMessage()
			if err != nil {
				fmt.Println("WebSocket read error:", err)
				return
			}
		}
	}()
	fmt.Println("WebSocket connection established for user:", userId)
}

func consumeMessagesFromRedis() {
	streamName := "event_stream"
	lastID := "0"

	err := redisClient.XAdd(ctx, &redis.XAddArgs{
		Stream: streamName,
		Values: map[string]interface{}{"init": "value"},
	}).Err()
	if err != nil {
		fmt.Println("Error creating stream:", err)
		return
	}


	for {
		messages, err := redisClient.XRead(ctx, &redis.XReadArgs{
			Streams: []string{streamName, lastID},
			Block:   0,
			Count:   1,
		}).Result()
		if err != nil {
			fmt.Println("Error reading from Redis stream:", err)
			return
		}
		fmt.Println("Messages received from Redis:", messages)
		for _, msg := range messages {
			for _, xMessage := range msg.Messages {
				eventType, ok := xMessage.Values["EventType"].(string)
				if !ok {
					fmt.Println("Error: EventType field is missing or invalid")
					continue
				}
				rawPayload, ok := xMessage.Values["Payload"].(string)
				if !ok {
					fmt.Println("Error: Payload field is missing or invalid")
					continue
				}
				eventMessage := EventMessage{
					EventType: eventType,
					Payload:   json.RawMessage(rawPayload),
				}
				userIDsStr, ok := xMessage.Values["UserIDs"].(string)
				if !ok {
					fmt.Println("Error: UserIDs field is missing or invalid")
					continue
				}
				var userIDs []string
				err = json.Unmarshal([]byte(userIDsStr), &userIDs)
				if err != nil {
					fmt.Println("Error unmarshalling UserIDs:", err)
					continue
				}
				hub.lock.RLock()
				for _, userId := range userIDs {
					conn, ok := hub.clients[userId]
					if ok {
						payload, err := json.Marshal(eventMessage)
						if err != nil {
							fmt.Println("Error marshalling message:", err)
							continue
						}
						err = conn.WriteMessage(websocket.TextMessage, payload)
						if err != nil {
							fmt.Println("Error sending message to WebSocket client:", err)
							conn.Close()
							hub.lock.Lock()
							delete(hub.clients, userId)
							hub.lock.Unlock()
						}
					} else {
						fmt.Println("No WebSocket connection found for user:", userId)
					}
				}
				hub.lock.RUnlock()
			}
			lastID = messages[len(messages)-1].Messages[len(messages[len(messages)-1].Messages)-1].ID
		}
	}
}


func parseRedisURL(redisURL string) (*redis.Options, error) {
	parsedURL, err := url.Parse(redisURL)
	if err != nil {
		return nil, err
	}

	options := &redis.Options{}

	options.Addr = parsedURL.Host
	if parsedURL.Scheme == "rediss" {
		options.TLSConfig = &tls.Config{}
	}

	if parsedURL.User != nil {
		password, _ := parsedURL.User.Password()
		options.Password = password

		username := parsedURL.User.Username()
		if username != "" {
			options.Username = username
		}
	}

	hostParts := strings.Split(parsedURL.Host, ":")
	if len(hostParts) > 0 {
		options.Addr = hostParts[0]
	}
	if len(hostParts) > 1 {
		options.Addr = hostParts[0] + ":" + hostParts[1]
	}

	return options, nil
}


func init() {
	loadConfig()

	redisURL := getEnv("RedisConnectionString", "localhost:6379")
	redisOptions, err := parseRedisURL(redisURL)
	if err != nil {
		fmt.Printf("Warning: Failed to parse Redis URL: %v. Redis will not be used.\n", err)
	} else {
		redisClient = redis.NewClient(redisOptions)
		_, err := redisClient.Ping(context.Background()).Result()
		if err != nil {
			fmt.Printf("Warning: Failed to connect to Redis: %v. Redis will not be used.\n", err)
			redisClient = nil 
		}
	}
}

func main() {
	loadConfig()
	port := getEnv("Port", "8080")
	hostname := getEnv("Host", "0.0.0.0")
	appMode := getEnv("AppMode", "debug")
	router := gin.Default()

	if appMode == "debug" {
		gin.SetMode(gin.DebugMode)
	} else {
		gin.SetMode(gin.ReleaseMode)
	}

	router.GET("/ws", handleWebSocket)
	router.GET("/", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status": "Service is running",
		})
	})

	if redisClient != nil {
		go consumeMessagesFromRedis()
	}

	router.Run(hostname + ":" + port)
}


package main

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"strings"

	"github.com/go-redis/redis/v8"
	"github.com/gorilla/websocket"
)

var redisClient *redis.Client
var ctx = context.Background()

func initRedisClient(redisURL string) error {
	options, err := parseRedisURL(redisURL)
	if err != nil {
		return fmt.Errorf("error parsing Redis URL: %v", err)
	}

	redisClient = redis.NewClient(options)
	_, err = redisClient.Ping(ctx).Result()
	if err != nil {
		return fmt.Errorf("error connecting to Redis: %v", err)
	}

	fmt.Println("Successfully connected to Redis")
	return nil
}

func consumeMessagesFromRedis() {
	streamName := "event_stream"

	lastID, err := loadLastID()
	if err != nil {
		logErr("Error loading last ID from file", err)
		lastID = "0"
	}

	for {
		messages, err := readFromRedisStream(streamName, lastID)
		if err != nil {
			logErr("Error reading from Redis stream", err)
			return
		}

		for _, msg := range messages {
			for _, xMessage := range msg.Messages {
				eventMessage, userIDs, err := parseRedisMessage(xMessage)
				if err != nil {
					logErr("Error parsing message", err)
					continue
				}

				printEventDetails(eventMessage, userIDs)
				broadcastToUsers(eventMessage, userIDs)

				lastID = xMessage.ID
				if err := saveLastID(lastID); err != nil {
					logErr("Error saving last ID to file", err)
				}
			}
		}
	}
}

func readFromRedisStream(streamName, lastID string) ([]redis.XStream, error) {
	return redisClient.XRead(ctx, &redis.XReadArgs{
		Streams: []string{streamName, lastID},
		Block:   0,
		Count:   100,
	}).Result()
}

func parseRedisMessage(xMessage redis.XMessage) (EventMessage, []string, error) {
	eventType, ok := xMessage.Values["EventType"].(string)
	if !ok {
		return EventMessage{}, nil, fmt.Errorf("eventType field missing or invalid")
	}

	rawPayload, ok := xMessage.Values["Payload"].(string)
	if !ok {
		return EventMessage{}, nil, fmt.Errorf("payload field missing or invalid")
	}

	eventMessage := EventMessage{
		EventType: eventType,
		Payload:   json.RawMessage(rawPayload),
	}

	userIDsStr, ok := xMessage.Values["UserIDs"].(string)
	if !ok {
		return EventMessage{}, nil, fmt.Errorf("userIDs field missing or invalid")
	}

	var userIDs []string
	if err := json.Unmarshal([]byte(userIDsStr), &userIDs); err != nil {
		return EventMessage{}, nil, fmt.Errorf("error unmarshalling userIDs: %v", err)
	}

	return eventMessage, userIDs, nil
}

func printEventDetails(event EventMessage, userIDs []string) {
	eventDetails := fmt.Sprintf(
		"Event Type: %s\nPayload: %s\nUserIDs: %v\n",
		event.EventType,
		string(event.Payload),
		userIDs,
	)
	fmt.Println("New event reached:")
	fmt.Println(eventDetails)
}

func broadcastToUsers(eventMessage EventMessage, userIDs []string) {
	payload, err := json.Marshal(eventMessage)
	if err != nil {
		fmt.Printf("Error marshalling message: %v\n", err)
		return
	}

	for _, targetUserID := range userIDs {
		hub.lock.RLock()
		conns, ok := hub.clients[targetUserID]
		hub.lock.RUnlock()
		if !ok {
			continue
		}

		var failedConns []*WSConnection
		for _, ws := range conns {
			ws.Mutex.Lock()
			err := ws.Conn.WriteMessage(websocket.TextMessage, payload)
			ws.Mutex.Unlock()

			if err != nil {
				fmt.Printf("Error sending message to user %s: %v. Closing connection.\n", targetUserID, err)
				ws.Conn.Close()
				failedConns = append(failedConns, ws)
			} else {
				fmt.Printf("Successfully sent message to WebSocket client for userId %s\n", targetUserID)
			}
		}
		if len(failedConns) > 0 {
			hub.lock.Lock()
			var active []*WSConnection
			for _, ws := range hub.clients[targetUserID] {
				failed := false
				for _, f := range failedConns {
					if ws == f {
						failed = true
						break
					}
				}
				if !failed {
					active = append(active, ws)
				}
			}
			if len(active) == 0 {
				delete(hub.clients, targetUserID)
			} else {
				hub.clients[targetUserID] = active
			}
			hub.lock.Unlock()
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
		options.TLSConfig = &tls.Config{
			MinVersion: tls.VersionTLS13,
		}
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

func logErr(context string, err error) {
	if err != nil {
		fmt.Printf("%s: %v\n", context, err)
	}
}

const lastIDFile = "last_redis_id.txt"

func saveLastID(lastID string) error {
	return os.WriteFile(lastIDFile, []byte(lastID), 0644)
}

func loadLastID() (string, error) {
	data, err := os.ReadFile(lastIDFile)
	if err != nil {
		if os.IsNotExist(err) {
			return "0", nil
		}
		return "", err
	}
	return strings.TrimSpace(string(data)), nil
}

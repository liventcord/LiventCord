package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

const ONLINE_TIMEOUT = 30

var upgrader = websocket.Upgrader{
	CheckOrigin:  func(r *http.Request) bool { return true },
	Subprotocols: []string{"cookie"},
}

var eventHandlers = map[string]func(*websocket.Conn, EventMessage, string){
	"UPDATE_USER_STATUS": handleUpdateUserStatus,
	"GET_USER_STATUS":    handleGetUserStatus,
}

func handleWebSocket(c *gin.Context) {
	userId, conn, err := establishWebSocketConnection(c)
	if err != nil {
		return
	}

	registerClient(userId, conn)
	go handleWebSocketMessages(userId, conn)
}

func establishWebSocketConnection(c *gin.Context) (string, *websocket.Conn, error) {
	userId, conn, err := getSessionAndUpgradeConnection(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"message": err.Error()})
		return "", nil, err
	}
	return userId, conn, nil
}

func getSessionAndUpgradeConnection(c *gin.Context) (string, *websocket.Conn, error) {
	protocolHeader := c.Request.Header.Get("Sec-WebSocket-Protocol")
	cookie := strings.TrimPrefix(protocolHeader, "cookie-")
	if cookie == "" {
		return "", nil, errors.New("session missing")
	}

	userId, err := authenticateSession(cookie)
	if err != nil {
		return "", nil, err
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, http.Header{
		"Sec-WebSocket-Protocol": []string{"cookie-" + cookie},
	})
	if err != nil {
		return "", nil, err
	}

	return userId, conn, nil
}

func authenticateSession(cookie string) (string, error) {
	DOTNET_API_URL := getEnv("DotnetApiUrl", "http://localhost:5005")
	req, err := http.NewRequest("POST", DOTNET_API_URL+"/auth/validate-session", nil)
	if err != nil {
		return "", fmt.Errorf("error creating request: %v", err)
	}

	req.Header.Set("Cookie", ".AspNetCore.Cookies="+cookie)
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("error sending request: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("invalid session. Status code: %d", resp.StatusCode)
	}

	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("error reading response body: %v", err)
	}

	userId := string(body)
	if userId == "" {
		return "", fmt.Errorf("invalid user ID")
	}

	return userId, nil
}

func registerClient(userId string, conn *websocket.Conn) {
	hub.lock.Lock()
	defer hub.lock.Unlock()

	if hub.clients == nil {
		hub.clients = make(map[string]*websocket.Conn)
	}
	if hub.connectivityStatus == nil {
		hub.connectivityStatus = make(map[string]UserStatus)
	}
	if hub.userStatus == nil {
		hub.userStatus = make(map[string]UserStatus)
	}

	hub.clients[userId] = conn
	hub.connectivityStatus[userId] = StatusOnline

	if _, exists := hub.userStatus[userId]; !exists {
		hub.userStatus[userId] = StatusOnline
	}

	go broadcastStatusUpdate(userId, hub.connectivityStatus[userId])
}

func unmarshalPayload(event EventMessage, v interface{}) error {
	return json.Unmarshal(event.Payload, v)
}

func sendResponse(conn *websocket.Conn, eventType string, payload interface{}) error {
	response, err := json.Marshal(struct {
		EventType string      `json:"event_type"`
		Payload   interface{} `json:"payload"`
	}{
		EventType: eventType,
		Payload:   payload,
	})
	if err != nil {
		return err
	}
	return conn.WriteMessage(websocket.TextMessage, response)
}
func handleWebSocketMessages(userId string, conn *websocket.Conn) {
	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			fmt.Printf("WebSocket error for user %s: %v\n", userId, err)

			hub.lock.Lock()
			if currentConn, exists := hub.clients[userId]; exists && currentConn == conn {
				delete(hub.clients, userId)
				fmt.Printf("Removed connection for user %s from active clients\n", userId)
			}
			hub.lock.Unlock()

			go handleDisconnectionWithTimeout(userId, conn)
			return
		}

		var event EventMessage
		if err := json.Unmarshal(message, &event); err != nil {
			continue
		}

		if handler, exists := eventHandlers[event.EventType]; exists {
			handler(conn, event, userId)
		}
	}
}

func handleDisconnectionWithTimeout(userId string, conn *websocket.Conn) {
	fmt.Printf("Starting disconnection timeout handler for user %s\n", userId)

	timeout := time.After(ONLINE_TIMEOUT * time.Second)
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-timeout:
			fmt.Printf("Timeout reached for user %s, cleaning up status\n", userId)

			hub.lock.Lock()
			hasOtherConnections := false
			for id, _ := range hub.clients {
				if id == userId {
					hasOtherConnections = true
					break
				}
			}

			if !hasOtherConnections {
				delete(hub.connectivityStatus, userId)
				hub.lock.Unlock()
				broadcastStatusUpdate(userId, StatusOffline)
			} else {
				hub.lock.Unlock()
			}

			conn.Close()
			return

		case <-ticker.C:
			hub.lock.RLock()
			_, reconnected := hub.clients[userId]
			hub.lock.RUnlock()

			if reconnected {
				fmt.Printf("User %s has reconnected, aborting disconnection timeout\n", userId)
				return
			}
		}
	}
}

func broadcastStatusUpdate(userId string, status UserStatus) {
	guilds, err := fetchGuildMemberships(userId)
	if err != nil {
		fmt.Println("Error fetching guild memberships:", err)
		return
	}

	hub.lock.RLock()
	clients := hub.clients
	hub.lock.RUnlock()

	seenUsers := make(map[string]struct{})
	notifyCount := 0

	for _, members := range guilds {
		for _, targetUserId := range members {
			if targetUserId != userId {
				if _, exists := seenUsers[targetUserId]; !exists {
					if conn, ok := clients[targetUserId]; ok {
						sendResponse(conn, "UPDATE_USER_STATUS", UserStatusResponse{
							UserId:             userId,
							ConnectivityStatus: string(status),
						})
						seenUsers[targetUserId] = struct{}{}
						notifyCount++
					}
				}
			}
		}
	}

	fmt.Printf("Broadcasting status update to %d guilds for user %s. Total clients notified: %d\n", len(guilds), userId, notifyCount)
}

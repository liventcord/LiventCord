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
	"START_TYPING":       handleStartTyping,
	"STOP_TYPING":        handleStopTyping,
}

func handleWebSocket(c *gin.Context) {
	userId, conn, err := establishWebSocketConnection(c)
	if err != nil {
		return
	}

	registerClient(userId, conn)
	go handleWebSocketMessages(userId, conn)
}
func registerClient(userId string, conn *websocket.Conn) {
	hub.lock.Lock()
	defer hub.lock.Unlock()

	if hub.clients == nil {
		hub.clients = make(map[string]map[*WSConnection]bool)
	}
	if hub.connectivityStatus == nil {
		hub.connectivityStatus = make(map[string]UserStatus)
	}
	if hub.userStatus == nil {
		hub.userStatus = make(map[string]UserStatus)
	}

	ws := &WSConnection{Conn: conn}

	if connLookup == nil {
		connLookup = make(map[*websocket.Conn]*WSConnection)
	}
	connLookup[conn] = ws

	if _, exists := hub.clients[userId]; !exists {
		hub.clients[userId] = make(map[*WSConnection]bool)
	}

	hub.clients[userId][ws] = true

	hub.connectivityStatus[userId] = StatusOnline
	if _, exists := hub.userStatus[userId]; !exists {
		hub.userStatus[userId] = StatusOnline
	}

	go broadcastStatusUpdate(userId, hub.connectivityStatus[userId])
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
	req, err := http.NewRequest("POST", DOTNET_API_URL+"/auth/validate-token", nil)
	if err != nil {
		return "", fmt.Errorf("error creating request: %v", err)
	}

	req.Header.Set("Authorization", "Bearer "+cookie)
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("error sending request: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("invalid session. Status code: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("error reading response body: %v", err)
	}

	var parsed struct {
		UserID string `json:"userId"`
	}
	err = json.Unmarshal(body, &parsed)
	if err != nil {
		return "", fmt.Errorf("error parsing response JSON: %v", err)
	}

	userId := strings.TrimSpace(parsed.UserID)
	if userId == "" {
		return "", fmt.Errorf("empty user ID returned from API")
	}

	return userId, nil
}

func sendResponse(conn *websocket.Conn, eventType string, payload interface{}) error {
	ws, ok := connLookup[conn]
	if !ok {
		return fmt.Errorf("connection not found")
	}

	ws.Mutex.Lock()
	defer ws.Mutex.Unlock()

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

	err = ws.Conn.WriteMessage(websocket.TextMessage, response)
	if err != nil {
		fmt.Printf("WebSocket write error: %v\n", err)
		ws.Conn.Close()

		hub.lock.Lock()
		for userId, conns := range hub.clients {
			if _, exists := conns[ws]; exists {
				delete(conns, ws)
				if len(conns) == 0 {
					delete(hub.clients, userId)
					delete(hub.connectivityStatus, userId)
					broadcastStatusUpdate(userId, StatusOffline)
				}
				break
			}
		}
		hub.lock.Unlock()
		delete(connLookup, conn)
	}

	return err
}

func unmarshalPayload(event EventMessage, v interface{}) error {
	return json.Unmarshal(event.Payload, v)
}

func handleWebSocketMessages(userId string, conn *websocket.Conn) {
	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			fmt.Printf("WebSocket error for user %s: %v\n", userId, err)
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

	ws, ok := connLookup[conn]
	if !ok {
		fmt.Printf("Connection not found in lookup for user %s\n", userId)
		return
	}

	for {
		select {
		case <-timeout:
			fmt.Printf("Timeout reached for user %s, cleaning up status\n", userId)

			hub.lock.Lock()
			defer hub.lock.Unlock()

			conns, exists := hub.clients[userId]
			if !exists {
				return
			}

			// Remove this WSConnection
			delete(conns, ws)
			delete(connLookup, conn)

			if len(conns) == 0 {
				delete(hub.clients, userId)
				delete(hub.connectivityStatus, userId)
				broadcastStatusUpdate(userId, StatusOffline)
			} else {
				fmt.Printf("User %s still has %d active connections, keeping online\n", userId, len(conns))
			}

			ws.Conn.Close()
			return

		case <-ticker.C:
			hub.lock.RLock()
			conns, reconnected := hub.clients[userId]
			hub.lock.RUnlock()

			if reconnected && len(conns) > 0 {
				fmt.Printf("User %s has other connections, aborting disconnection timeout\n", userId)
				return
			}
		}
	}
}

func EmitToGuild(eventType string, payload interface{}, key string, userId string) {
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
					if conns, ok := clients[targetUserId]; ok {
						for c := range conns {
							sendResponse(c.Conn, eventType, payload)
						}
						seenUsers[targetUserId] = struct{}{}
						notifyCount++
					}
				}
			}
		}
	}

	fmt.Printf("Broadcasted %s to %d users\n", eventType, notifyCount)
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
					if conns, ok := clients[targetUserId]; ok {
						for c := range conns {
							sendResponse(c.Conn, "UPDATE_USER_STATUS", UserStatusResponse{
								UserId:             userId,
								ConnectivityStatus: string(status),
							})
						}
						seenUsers[targetUserId] = struct{}{}
						notifyCount++
					}
				}
			}
		}
	}

	fmt.Printf("Broadcasting status update to %d guilds for user %s. Total clients notified: %d\n", len(guilds), userId, notifyCount)
}

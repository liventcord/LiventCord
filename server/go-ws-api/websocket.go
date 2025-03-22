package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

const (
	StatusOnline    UserStatus = "online"
	StatusIdle      UserStatus = "idle"
	StatusOffline   UserStatus = "offline"
	StatusDND       UserStatus = "do-not-disturb"
	StatusInvisible UserStatus = "invisible"
)

var hub struct {
	clients            map[string]*websocket.Conn
	connectivityStatus map[string]UserStatus
	userStatus         map[string]UserStatus
	lock               sync.RWMutex
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
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
	cookie := strings.TrimPrefix(c.Request.Header.Get("Sec-WebSocket-Protocol"), "cookie-")
	if cookie == "" {
		return "", nil, errors.New("session missing")
	}

	userId, err := authenticateSession(cookie)
	if err != nil {
		return "", nil, err
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
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
}

func handleWebSocketMessages(userId string, conn *websocket.Conn) {
	defer cleanupWebSocket(userId, conn)

	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			return
		}

		var event EventMessage
		if json.Unmarshal(message, &event) != nil {
			continue
		}

		if handler, exists := eventHandlers[event.EventType]; exists {
			handler(conn, event, userId)
		}
	}
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
func cleanupWebSocket(userId string, conn *websocket.Conn) {
	hub.lock.Lock()
	defer hub.lock.Unlock()
	delete(hub.clients, userId)

	hub.connectivityStatus[userId] = Offline
	conn.Close()
}

func handleUpdateUserStatus(conn *websocket.Conn, event EventMessage, userId string) {
	var statusUpdate struct {
		Status string `json:"status"`
	}
	if err := unmarshalPayload(event, &statusUpdate); err != nil {
		fmt.Println("Error unmarshalling status update:", err)
		return
	}

	status := UserStatus(statusUpdate.Status)
	if isValidStatus(status) {
		hub.lock.Lock()
		hub.userStatus[userId] = status
		hub.lock.Unlock()
		fmt.Printf("User %s custom status updated to %s\n", userId, status)
	} else {
		fmt.Println("Invalid status:", statusUpdate.Status)
	}
}
func handleGetUserStatus(conn *websocket.Conn, event EventMessage, userId string) {
	var request struct {
		UserIds []string `json:"user_ids"`
	}
	if err := unmarshalPayload(event, &request); err != nil {
		fmt.Println("Error unmarshalling get status request:", err)
		return
	}

	var statusResponses []UserStatusResponse
	hub.lock.RLock()
	defer hub.lock.RUnlock()

	for _, id := range request.UserIds {

		UserStatus, exists := hub.userStatus[id]
		if !exists {
			UserStatus = StatusOffline
		}

		statusResponses = append(statusResponses, UserStatusResponse{
			UserId:             id,
			ConnectivityStatus: string(UserStatus),
		})
	}

	if err := sendResponse(conn, event.EventType, statusResponses); err != nil {
		fmt.Println("Error sending status response:", err)
	}
}

func isValidStatus(status UserStatus) bool {
	switch status {
	case Online, StatusInvisible, DoNotDisturb, Idling:
		return true
	}
	return false
}

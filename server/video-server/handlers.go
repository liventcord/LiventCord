package main

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/gorilla/websocket"
)

type UserStatus struct {
	ID         string `json:"id"`
	IsNoisy    bool   `json:"isNoisy"`
	IsMuted    bool   `json:"isMuted"`
	IsDeafened bool   `json:"isDeafened"`
}

func handleWS(w http.ResponseWriter, r *http.Request) {
	enableCORS(w, r)

	token := extractToken(r)
	if token == "" {
		http.Error(w, "Missing token", http.StatusUnauthorized)
		return
	}

	userID, err := authenticateSession(token)
	if err != nil {
		http.Error(w, "Unauthorized: "+err.Error(), http.StatusUnauthorized)
		return
	}

	conn, err := upgradeConnection(w, r)
	if err != nil {
		log.Println("[WS] WebSocket upgrade failed:", err)
		return
	}

	client := registerClient(userID, conn)
	defer cleanupConnection(client)

	existing := buildExistingUserList()
	sendEnvelope(client, "existingUserList", map[string]interface{}{
		"Guilds": existing,
	})

	go clientWriter(client)
	handleClientMessages(client)
}

// TODO: Make this only return users guilds
func buildExistingUserList() map[string][]UserStatus {
	hub.mu.RLock()
	defer hub.mu.RUnlock()

	result := make(map[string][]UserStatus)
	for roomID, clients := range hub.rooms {
		users := make([]UserStatus, 0, len(clients))

		for userID, client := range clients {
			if client == nil {
				continue
			}
			users = append(users, UserStatus{
				ID:         userID,
				IsNoisy:    client.IsNoisy,
				IsMuted:    client.IsMuted,
				IsDeafened: client.IsDeafened,
			})
		}

		result[roomID] = users
	}

	return result
}

func handleJoinRoom(client *Client, data json.RawMessage) {
	var p JoinRoomPayload
	if err := json.Unmarshal(data, &p); err != nil {
		log.Println("[WS] joinRoom payload parse failed:", err)
		return
	}
	if p.RoomID == "" {
		log.Println("[WS] joinRoom ignored (empty RoomID) from", client.ID)
		return
	}

	client.RoomID = p.RoomID
	log.Println("[WS] User", client.ID, "joined room", p.RoomID)

	registerToRoom(client)
	emitUserList(client)
	notifyUserConnect(client)

	sendEnvelope(client, "joined", map[string]string{})
}
func emitUserList(c *Client) {
	hub.mu.RLock()
	defer hub.mu.RUnlock()

	roomClients, exists := hub.rooms[c.RoomID]
	if !exists {
		return
	}

	users := make([]VoiceUser, 0, len(roomClients))
	for _, client := range roomClients {
		users = append(users, VoiceUser{
			ID:         client.ID,
			IsNoisy:    false,
			IsMuted:    false,
			IsDeafened: false,
		})
	}

	payload := UserList{
		List:      users,
		RtcUserId: c.ID,
	}

	sendJSON(c.Conn, Envelope{Event: "userList", Data: mustJSON(payload)})
}

func registerClient(userID string, conn *websocket.Conn) *Client {
	client := &Client{
		ID:   userID,
		Conn: conn,
		Send: make(chan []byte, 256),
	}
	log.Println("[WS] Client connected:", userID)

	hub.mu.Lock()
	hub.clients[userID] = client
	hub.mu.Unlock()

	return client
}

func handleClientMessages(client *Client) {
	for {
		_, msg, err := client.Conn.ReadMessage()
		if err != nil {
			log.Println("[WS] Read error, closing connection for:", client.ID, "error:", err)
			break
		}

		var env Envelope
		if err := json.Unmarshal(msg, &env); err != nil {
			log.Println("[WS] Invalid JSON from", client.ID, ":", err)
			continue
		}

		switch env.Event {
		case "joinRoom":
			handleJoinRoom(client, env.Data)
		case "data":
			handleDataEvent(client, env.Data)
		case "toggleMute":
			handleToggleMute(client)
		case "toggleDeafen":
			handleToggleDeafen(client)
		case "leaveRoom":
			handleLeaveRoom(client)
		case "ping":
		default:
			log.Println("[WS] Unknown event:", env.Event, "from", client.ID)
		}
	}
}

func handleToggleMute(client *Client) {
	hub.mu.Lock()
	if client.RoomID == "" {
		hub.mu.Unlock()
		log.Printf("[WS] User room id is empty")
		return
	}
	roomClients := hub.rooms[client.RoomID]
	if roomClients == nil {
		hub.mu.Unlock()
		return
	}

	client.IsMuted = !client.IsMuted

	status := map[string]interface{}{
		"id":         client.ID,
		"isNoisy":    client.IsNoisy,
		"isMuted":    client.IsMuted,
		"isDeafened": client.IsDeafened,
	}

	clientsToNotify := make([]*Client, 0, len(roomClients))
	for otherID := range roomClients {
		if otherClient, exists := hub.clients[otherID]; exists {
			clientsToNotify = append(clientsToNotify, otherClient)
		}
	}
	hub.mu.Unlock()

	for _, c := range clientsToNotify {
		sendEnvelope(c, "userStatusUpdate", status)
	}
}

func handleToggleDeafen(client *Client) {
	hub.mu.Lock()
	if client.RoomID == "" {
		hub.mu.Unlock()
		log.Printf("[WS] User room id is empty")
		return
	}
	roomClients := hub.rooms[client.RoomID]
	if roomClients == nil {
		hub.mu.Unlock()
		return
	}

	client.IsDeafened = !client.IsDeafened

	status := map[string]interface{}{
		"id":         client.ID,
		"isNoisy":    client.IsNoisy,
		"isMuted":    client.IsMuted,
		"isDeafened": client.IsDeafened,
	}

	clientsToNotify := make([]*Client, 0, len(roomClients))
	for otherID := range roomClients {
		if otherClient, exists := hub.clients[otherID]; exists {
			clientsToNotify = append(clientsToNotify, otherClient)
		}
	}
	hub.mu.Unlock()

	for _, c := range clientsToNotify {
		sendEnvelope(c, "userStatusUpdate", status)
	}
}

func handleLeaveRoom(client *Client) {
	if client.RoomID == "" {
		return
	}
	roomID := client.RoomID
	client.RoomID = ""
	unregisterFromRoom(client)
	notifyUserLeave(client, roomID)
	log.Println("[WS] User", client.ID, "left room", roomID)
}

func handleDataEvent(client *Client, data json.RawMessage) {
	var payload DataPayload
	if err := json.Unmarshal(data, &payload); err != nil {
		log.Println("[WS] data payload parse failed:", err)
		return
	}
	if payload.TargetID == "" {
		log.Println("[WS] data event missing targetId from", client.ID)
		return
	}

	signalData := buildSignalData(payload)
	if signalData == nil {
		return
	}

	forwardData(client.ID, payload.TargetID, signalData)
}

package main

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"github.com/gorilla/websocket"
)

type DataPayload struct {
	TargetID  string          `json:"targetId"`
	Type      string          `json:"type"`
	SDP       json.RawMessage `json:"sdp,omitempty"`
	Candidate json.RawMessage `json:"candidate,omitempty"`
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

	log.Println("[WS] Authenticated user:", userID)

	conn, err := upgradeConnection(w, r)
	if err != nil {
		log.Println("[WS] WebSocket upgrade failed:", err)
		return
	}

	client := registerClient(userID, conn)
	defer cleanupConnection(client)

	go clientWriter(client)

	emitAllConnectedUsers(client)

	handleClientMessages(client)
}

func extractToken(r *http.Request) string {
	if protocols, ok := r.Header["Sec-Websocket-Protocol"]; ok {
		for _, p := range protocols {
			if strings.HasPrefix(p, "cookie-") {
				return strings.TrimPrefix(p, "cookie-")
			}
		}
	}
	return r.URL.Query().Get("token")
}

func upgradeConnection(w http.ResponseWriter, r *http.Request) (*websocket.Conn, error) {
	var hdr http.Header
	if len(r.Header["Sec-Websocket-Protocol"]) > 0 {
		hdr = http.Header{}
		hdr.Set("Sec-WebSocket-Protocol", r.Header.Get("Sec-WebSocket-Protocol"))
	}
	return upgrader.Upgrade(w, r, hdr)
}

func registerClient(userID string, conn *websocket.Conn) *Client {
	client := &Client{
		ID:   userID,
		Conn: conn,
		Send: make(chan []byte, 256),
	}

	hub.mu.Lock()
	hub.clients[userID] = client
	hub.mu.Unlock()

	log.Println("[WS] Client connected:", userID)
	return client
}

func clientWriter(client *Client) {
	for msg := range client.Send {
		if err := client.Conn.WriteMessage(websocket.TextMessage, msg); err != nil {
			log.Println("[WS] Write error for", client.ID, ":", err)
			break
		}
	}
}

func emitAllConnectedUsers(client *Client) {
	hub.mu.RLock()
	allUsers := make([]string, 0, len(hub.clients))
	for id := range hub.clients {
		if id != client.ID {
			allUsers = append(allUsers, id)
		}
	}
	hub.mu.RUnlock()

	payload := UserList{
		List:      allUsers,
		RtcUserId: client.ID,
	}
	sendJSON(client.Conn, Envelope{Event: "userList", Data: mustJSON(payload)})
	log.Printf("[WS] Sent initial user list to %s (count: %d)", client.ID, len(allUsers))
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
		case "leaveRoom":
			handleLeaveRoom(client)
		case "ping":
		default:
			log.Println("[WS] Unknown event:", env.Event, "from", client.ID)
		}
	}
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

func buildSignalData(p DataPayload) []byte {
	data := map[string]interface{}{"type": p.Type}

	addOptionalJSON(p.SDP, "sdp", data)
	addOptionalJSON(p.Candidate, "candidate", data)

	out, err := json.Marshal(data)
	if err != nil {
		log.Println("[WS] Failed to marshal signal data:", err)
		return nil
	}
	return out
}

func addOptionalJSON(raw json.RawMessage, key string, target map[string]interface{}) {
	if raw == nil {
		return
	}
	var decoded interface{}
	if err := json.Unmarshal(raw, &decoded); err == nil {
		target[key] = decoded
	}
}

func sendEnvelope(client *Client, event string, data interface{}) {
	envelope := Envelope{
		Event: event,
		Data:  mustJSON(data),
	}
	msg, _ := json.Marshal(envelope)
	select {
	case client.Send <- msg:
	default:
		log.Println("[WS] Failed to send", event, "to", client.ID, "(channel full or closed)")
	}
}

func forwardData(fromID, targetID string, signalDataJSON []byte) {
	var signalData map[string]interface{}
	if err := json.Unmarshal(signalDataJSON, &signalData); err != nil {
		log.Println("[WS] Failed to unmarshal signalData for adding senderId:", err)
		return
	}
	signalData["senderId"] = fromID

	envelope := Envelope{
		Event: "data",
		Data:  mustJSON(signalData),
	}
	envelopeJSON, _ := json.Marshal(envelope)

	hub.mu.RLock()
	targetClient, exists := hub.clients[targetID]
	hub.mu.RUnlock()
	if !exists {
		log.Println("[WS] Target client not found:", targetID)
		return
	}

	select {
	case targetClient.Send <- envelopeJSON:
		log.Println("[WS] Forwarded data to", targetID)
	default:
		log.Println("[WS] Failed to send to", targetID, "- channel full or closed")
	}
}

func cleanupConnection(client *Client) {
	cleanupClient(client)
	close(client.Send)
	client.Conn.Close()
	log.Println("[WS] Client disconnected:", client.ID)
}

func unregisterFromRoom(client *Client) {
	hub.mu.Lock()
	defer hub.mu.Unlock()

	roomClients, exists := hub.rooms[client.RoomID]
	if !exists {
		return
	}

	delete(roomClients, client.ID)
	if len(roomClients) == 0 {
		delete(hub.rooms, client.RoomID)
	} else {
		hub.rooms[client.RoomID] = roomClients
	}
}

func notifyUserLeave(client *Client, roomID string) {
	hub.mu.RLock()
	roomClients, exists := hub.rooms[roomID]
	hub.mu.RUnlock()
	if !exists {
		return
	}

	data := map[string]string{"userId": client.ID}
	envelope := Envelope{
		Event: "userLeft",
		Data:  mustJSON(data),
	}
	msg, _ := json.Marshal(envelope)

	for _, c := range roomClients {
		if c.ID == client.ID {
			continue
		}
		select {
		case c.Send <- msg:
		default:
			log.Println("[WS] Failed to notify userLeft to", c.ID)
		}
	}
}

func enableCORS(w http.ResponseWriter, r *http.Request) {
	origin := r.Header.Get("Origin")
	if origin == "" {
		return
	}
	if _, ok := hub.allowedOrigins[origin]; ok {
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Vary", "Origin")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	}
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
	}
}
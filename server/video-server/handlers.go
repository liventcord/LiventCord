package main

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"github.com/gorilla/websocket"
)

func handleWS(w http.ResponseWriter, r *http.Request) {
	enableCORS(w, r)

	token := ""
	if protocols, ok := r.Header["Sec-Websocket-Protocol"]; ok && len(protocols) > 0 {
		for _, p := range protocols {
			if strings.HasPrefix(p, "cookie-") {
				token = strings.TrimPrefix(p, "cookie-")
				break
			}
		}
	}
	if token == "" {
		token = r.URL.Query().Get("token")
	}

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

	var responseHeader http.Header
	if len(r.Header["Sec-Websocket-Protocol"]) > 0 {
		responseHeader = http.Header{}
		responseHeader.Set("Sec-WebSocket-Protocol", r.Header.Get("Sec-WebSocket-Protocol"))
	}

	c, err := upgrader.Upgrade(w, r, responseHeader)
	if err != nil {
		log.Println("[WS] WebSocket upgrade failed:", err)
		return
	}

	client := &Client{
		ID:   userID,
		Conn: c,
		Send: make(chan []byte, 256),
	}

	hub.mu.Lock()
	hub.clients[userID] = client
	hub.mu.Unlock()

	log.Println("[WS] Client connected:", userID)

	go func() {
		for msg := range client.Send {
			err := client.Conn.WriteMessage(websocket.TextMessage, msg)
			if err != nil {
				log.Println("[WS] Write error for", userID, ":", err)
				break
			}
		}
	}()

	for {
		_, msg, err := client.Conn.ReadMessage()
		if err != nil {
			log.Println("[WS] Read error, closing connection for:", userID, "error:", err)
			break
		}

		log.Println("[WS] Received message from", userID, ":", string(msg))

		var env Envelope
		if err := json.Unmarshal(msg, &env); err != nil {
			log.Println("[WS] JSON unmarshal failed for", userID, ":", err)
			continue
		}

		switch env.Event {
		case "joinRoom":
			var p JoinRoomPayload
			if err := json.Unmarshal(env.Data, &p); err != nil {
				log.Println("[WS] joinRoom payload parse failed:", err)
				continue
			}
			if p.RoomID == "" {
				log.Println("[WS] joinRoom ignored (empty RoomID) from", userID)
				break
			}
			client.RoomID = p.RoomID
			log.Println("[WS] User", userID, "joined room", p.RoomID)
			registerToRoom(client)
			emitUserList(client)
			notifyUserConnect(client)

		case "data":
			var raw map[string]interface{}
			if err := json.Unmarshal(env.Data, &raw); err != nil {
				log.Println("[WS] data payload parse failed:", err)
				continue
			}
			target, _ := raw["targetId"].(string)
			log.Println("[WS] Forwarding data from", userID, "to", target, ":", string(env.Data))
			forwardData(target, env.Data)
		}
	}

	cleanupClient(client)
	close(client.Send)
	client.Conn.Close()
	log.Println("[WS] Client disconnected:", userID)
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

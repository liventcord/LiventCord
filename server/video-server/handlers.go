package main

import (
	"encoding/json"
	"net/http"
	"strings"
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

	var responseHeader http.Header
	if len(r.Header["Sec-Websocket-Protocol"]) > 0 {
		responseHeader = http.Header{}
		responseHeader.Set("Sec-WebSocket-Protocol", r.Header.Get("Sec-WebSocket-Protocol"))
	}

	c, err := upgrader.Upgrade(w, r, responseHeader)
	if err != nil {
		return
	}
	defer c.Close()

	client := &Client{
		ID:   userID,
		Conn: c,
	}

	hub.mu.Lock()
	hub.clients[userID] = client
	hub.mu.Unlock()

	for {
		_, msg, err := c.ReadMessage()
		if err != nil {
			break
		}

		var env Envelope
		if err := json.Unmarshal(msg, &env); err != nil {
			continue
		}

		switch env.Event {
		case "joinRoom":
			var p JoinRoomPayload
			if err := json.Unmarshal(env.Data, &p); err != nil {
				continue
			}
			if p.RoomID == "" {
				break
			}
			client.RoomID = p.RoomID
			registerToRoom(client)
			emitUserList(client)
			notifyUserConnect(client)

		case "data":
			var raw map[string]interface{}
			if err := json.Unmarshal(env.Data, &raw); err != nil {
				continue
			}
			target, _ := raw["targetId"].(string)
			forwardData(target, env.Data)
		}
	}

	cleanupClient(client)
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

package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/gorilla/websocket"
	"github.com/joho/godotenv"
)

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

func sendJSON(conn *websocket.Conn, env Envelope) {
	b, err := json.Marshal(env)
	if err != nil {
		return
	}
	_ = conn.WriteMessage(websocket.TextMessage, b)
}

func mustJSON(v interface{}) json.RawMessage {
	b, _ := json.Marshal(v)
	return b
}

func upgradeConnection(w http.ResponseWriter, r *http.Request) (*websocket.Conn, error) {
	var hdr http.Header
	if len(r.Header["Sec-Websocket-Protocol"]) > 0 {
		hdr = http.Header{}
		hdr.Set("Sec-WebSocket-Protocol", r.Header.Get("Sec-WebSocket-Protocol"))
	}
	return vcUpgrader.Upgrade(w, r, hdr)
}

func enableCORS(w http.ResponseWriter, r *http.Request) {
	origin := r.Header.Get("Origin")
	if origin == "" {
		return
	}
	if _, ok := vcHub.allowedOrigins[origin]; ok {
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Vary", "Origin")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, OPTIONS")
	}
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
	}
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
func unmarshalPayload(event EventMessage, v interface{}) error {
	return json.Unmarshal(event.Payload, v)
}

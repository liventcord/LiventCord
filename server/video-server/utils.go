package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"

	"github.com/gorilla/websocket"
)

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

func upgradeConnection(w http.ResponseWriter, r *http.Request) (*websocket.Conn, error) {
	var hdr http.Header
	if len(r.Header["Sec-Websocket-Protocol"]) > 0 {
		hdr = http.Header{}
		hdr.Set("Sec-WebSocket-Protocol", r.Header.Get("Sec-WebSocket-Protocol"))
	}
	return upgrader.Upgrade(w, r, hdr)
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

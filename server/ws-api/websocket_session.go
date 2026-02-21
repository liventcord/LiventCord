package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

type sessionCacheEntry struct {
	userID    string
	expiresAt time.Time
}

var (
	sessionCache = make(map[string]sessionCacheEntry)
	cacheMutex   sync.RWMutex
	cacheTTL     = 5 * time.Minute
)

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

	userId, err := authenticateSessionWithCache(cookie)
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

func authenticateSessionWithCache(cookie string) (string, error) {
	cacheMutex.RLock()
	entry, found := sessionCache[cookie]
	cacheMutex.RUnlock()

	if found && time.Now().Before(entry.expiresAt) {
		return entry.userID, nil
	}

	userId, err := authenticateSession(cookie)
	if err != nil {
		return "", err
	}

	cacheMutex.Lock()
	sessionCache[cookie] = sessionCacheEntry{
		userID:    userId,
		expiresAt: time.Now().Add(cacheTTL),
	}
	cacheMutex.Unlock()

	return userId, nil
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

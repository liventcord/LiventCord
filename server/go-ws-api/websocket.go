package main

import (
	"fmt"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"io"
	"net/http"
	"sync"
	"strings"
)

type Hub struct {
	clients map[string]*websocket.Conn
	lock    sync.RWMutex
}

var hub = Hub{
	clients: make(map[string]*websocket.Conn),
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

func handleWebSocket(c *gin.Context) {
	cookieHeader := c.Request.Header.Get("Sec-WebSocket-Protocol")
	cookie := strings.TrimPrefix(cookieHeader, "cookie-")

	if cookie == "" {
		fmt.Println("Error: Session missing")
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Session missing"})
		return
	}

	DOTNET_API_URL := getEnv("DotnetApiUrl", "http://localhost:5005")
	req, err := http.NewRequest("POST", DOTNET_API_URL+"/auth/validate-session", nil)
	if err != nil {
		fmt.Printf("Error creating request: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Internal server error"})
		return
	}

	req.Header.Set("Cookie", ".AspNetCore.Cookies="+cookie)
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		fmt.Printf("Error sending request: %v\n", err)
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Session invalid"})
		return
	}

	if resp.StatusCode != http.StatusOK {
		fmt.Printf("Invalid session. Status code: %d\n", resp.StatusCode)
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Session invalid"})
		return
	}

	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Println("Error reading response body:", err)
		return
	}
	userId := string(body)
	if userId == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Invalid user ID"})
		return
	}
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		fmt.Println("Error upgrading WebSocket:", err)
		c.JSON(http.StatusInternalServerError, gin.H{"message": "WebSocket upgrade failed"})
		return
	}
	hub.lock.Lock()
	hub.clients[userId] = conn
	hub.lock.Unlock()
	go func() {
		defer func() {
			hub.lock.Lock()
			delete(hub.clients, userId)
			hub.lock.Unlock()
			conn.Close()
			fmt.Println("WebSocket connection closed for user:", userId)
		}()
		for {
			_, _, err := conn.ReadMessage()
			if err != nil {
				fmt.Println("WebSocket read error:", err)
				return
			}
		}
	}()
	fmt.Println("WebSocket connection established for user:", userId)
}

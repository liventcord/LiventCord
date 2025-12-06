package main

import (
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const pingInterval = 30 * time.Second
const pingTimeout = 10 * time.Second

func startPingRoutine() {
	ticker := time.NewTicker(pingInterval)
	go func() {
		for range ticker.C {
			pingVcHubClients(vcHub)
			pingHubClients(&hub)
		}
	}()
}

// Ping for vcHub
func pingVcHubClients(h *VcHub) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	for userId, client := range h.clients {
		if client.Conn != nil {
			err := client.Conn.WriteControl(websocket.PingMessage, []byte{}, time.Now().Add(pingTimeout))
			if err != nil {
				println("Ping failed for user", userId, ":", err.Error())
			}
		}
	}
	for _, roomClients := range h.rooms {
		for _, client := range roomClients {
			if client.Conn != nil {
				err := client.Conn.WriteControl(websocket.PingMessage, []byte{}, time.Now().Add(pingTimeout))
				if err != nil {
					println("Ping failed for user", client.ID, ":", err.Error())
				}
			}
		}
	}
}

// Ping for hub
func pingHubClients(h *struct {
	clients            map[string]map[*WSConnection]bool
	connectivityStatus map[string]ConnectivityStatus
	userStatus         map[string]UserStatus
	lock               sync.RWMutex
}) {
	h.lock.RLock()
	defer h.lock.RUnlock()

	for userId, conns := range h.clients {
		for ws := range conns {
			if ws.Conn != nil {
				err := ws.Conn.WriteControl(websocket.PingMessage, []byte{}, time.Now().Add(pingTimeout))
				if err != nil {
					println("Ping failed for user", userId, ":", err.Error())
				}
			}
		}
	}
}

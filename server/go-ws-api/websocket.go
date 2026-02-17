package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

const ONLINE_TIMEOUT = 30

var upgrader = websocket.Upgrader{
	CheckOrigin:  func(r *http.Request) bool { return true },
	Subprotocols: []string{"cookie"},
}

var eventHandlers = map[string]func(*websocket.Conn, EventMessage, string){
	"UPDATE_USER_STATUS": handleUpdateUserStatus,
	"GET_USER_STATUS":    handleGetUserStatus,
	"START_TYPING":       handleStartTyping,
	"STOP_TYPING":        handleStopTyping,
}

func handleWebSocket(c *gin.Context) {
	userId, conn, err := establishWebSocketConnection(c)
	if err != nil {
		return
	}

	registerClient(userId, conn)
	go handleWebSocketMessages(userId, conn)
}

func registerClient(userId string, conn *websocket.Conn) {
	hub.lock.Lock()
	defer hub.lock.Unlock()

	if hub.clients == nil {
		hub.clients = make(map[string]map[*WSConnection]bool)
	}
	if hub.connectivityStatus == nil {
		hub.connectivityStatus = make(map[string]ConnectivityStatus)
	}
	if hub.userStatus == nil {
		hub.userStatus = make(map[string]UserStatus)
	}

	ws := &WSConnection{Conn: conn}

	if connLookup == nil {
		connLookup = make(map[*websocket.Conn]*WSConnection)
	}
	connLookup[conn] = ws

	if _, ok := hub.clients[userId]; !ok {
		hub.clients[userId] = make(map[*WSConnection]bool)
	}
	hub.clients[userId][ws] = true

	previousConnectivity := hub.connectivityStatus[userId]
	hub.connectivityStatus[userId] = Connected

	if _, exists := hub.userStatus[userId]; !exists {
		hub.userStatus[userId] = Online
	}

	effectiveStatus := hub.userStatus[userId]

	sendResponse(conn, "UPDATE_USER_STATUS", UserStatusResponse{
		UserId:             userId,
		ConnectivityStatus: string(effectiveStatus),
	})

	shouldBroadcast := previousConnectivity != Connected
	if shouldBroadcast {
		go broadcastStatusUpdate(userId, effectiveStatus)
	}
}

func sendResponse(conn *websocket.Conn, eventType string, payload interface{}) error {
	ws, ok := connLookup[conn]
	if !ok {
		return fmt.Errorf("connection not found")
	}

	ws.Mutex.Lock()
	defer ws.Mutex.Unlock()

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

	err = ws.Conn.WriteMessage(websocket.TextMessage, response)
	if err != nil {
		fmt.Printf("WebSocket write error: %v\n", err)
		ws.Conn.Close()

		hub.lock.Lock()

		for userId, conns := range hub.clients {
			if _, exists := conns[ws]; exists {
				delete(conns, ws)

				if len(conns) == 0 {
					hub.connectivityStatus[userId] = Disconnected

					delete(hub.clients, userId)

					go handleDisconnectionWithTimeout(userId)
				}

				break
			}
		}

		hub.lock.Unlock()
		delete(connLookup, conn)
	}

	return err
}

func handleWebSocketMessages(userId string, conn *websocket.Conn) {
	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			fmt.Printf("WebSocket error for user %s: %v\n", userId, err)

			hub.lock.Lock()
			ws, ok := connLookup[conn]
			if ok {
				if conns, exists := hub.clients[userId]; exists {
					delete(conns, ws)
					delete(connLookup, conn)

					if len(conns) == 0 {
						hub.connectivityStatus[userId] = Disconnected
						go handleDisconnectionWithTimeout(userId)
					} else {
						fmt.Printf("User %s still has %d active connections, staying online\n", userId, len(conns))
					}
				}
			}
			hub.lock.Unlock()

			conn.Close()
			return
		}

		var event EventMessage
		if err := json.Unmarshal(message, &event); err != nil {
			continue
		}

		if handler, exists := eventHandlers[event.EventType]; exists {
			handler(conn, event, userId)
		}
	}
}

func handleDisconnectionWithTimeout(userId string) {
	fmt.Printf("Starting disconnection timeout handler for user %s\n", userId)

	timeout := time.After(ONLINE_TIMEOUT * time.Second)
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-timeout:
			fmt.Printf("Timeout reached for user %s\n", userId)

			hub.lock.Lock()
			conns, exists := hub.clients[userId]
			stillDisconnected := !exists || len(conns) == 0

			if stillDisconnected {
				hub.connectivityStatus[userId] = Disconnected
				hub.lock.Unlock()

				effective := hub.userStatus[userId]
				broadcastStatusUpdate(userId, effective)

			} else {
				hub.lock.Unlock()
			}

			return

		case <-ticker.C:
			hub.lock.RLock()
			conns, exists := hub.clients[userId]
			hub.lock.RUnlock()

			if exists && len(conns) > 0 {
				fmt.Printf("User %s reconnected, aborting disconnection timeout\n", userId)
				return
			}
		}
	}
}

func EmitToGuild(eventType string, payload interface{}, key string, userId string) {
	hub.lock.RLock()
	clientsSnapshot := make(map[string]map[*WSConnection]bool, len(hub.clients))
	for uid, conns := range hub.clients {
		clientsSnapshot[uid] = conns
	}
	hub.lock.RUnlock()

	guilds, err := fetchGuildMemberships(userId)
	if err != nil {
		fmt.Println("Error fetching guild memberships:", err)
		return
	}

	alreadyNotified := make(map[string]struct{})

	for _, members := range guilds {
		for _, targetUserId := range members {
			if targetUserId == userId {
				continue
			}
			if _, notified := alreadyNotified[targetUserId]; notified {
				continue
			}

			if userConns, ok := clientsSnapshot[targetUserId]; ok {
				for c := range userConns {
					sendResponse(c.Conn, eventType, payload)
				}
				alreadyNotified[targetUserId] = struct{}{}
			}
		}
	}

	fmt.Printf("Broadcasted %s from user %s to %d users\n", eventType, userId, len(alreadyNotified))
}

func broadcastStatusUpdate(userId string, status UserStatus) {
	hub.lock.RLock()
	clientsSnapshot := make(map[string]map[*WSConnection]bool, len(hub.clients))
	for uid, conns := range hub.clients {
		clientsSnapshot[uid] = conns
	}
	hub.lock.RUnlock()

	guilds, err := fetchGuildMemberships(userId)
	if err != nil {
		fmt.Println("Error fetching guild memberships:", err)
		return
	}

	alreadyNotified := make(map[string]struct{})

	for _, members := range guilds {
		for _, targetUserId := range members {
			if targetUserId == userId {
				continue
			}
			if _, notified := alreadyNotified[targetUserId]; notified {
				continue
			}

			if userConns, ok := clientsSnapshot[targetUserId]; ok {
				resp := UserStatusResponse{
					UserId:             userId,
					ConnectivityStatus: string(status),
				}
				for c := range userConns {
					sendResponse(c.Conn, "UPDATE_USER_STATUS", resp)
				}
				alreadyNotified[targetUserId] = struct{}{}
			}
		}
	}

	fmt.Printf("Broadcasted status update for user %s to %d users\n", userId, len(alreadyNotified))
}

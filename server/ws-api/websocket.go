package main

import (
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = newWsUpgrader()

var eventHandlers = map[string]func(*websocket.Conn, EventMessage, string){
	"UPDATE_USER_STATUS": handleUpdateUserStatus,
	"GET_USER_STATUS":    handleGetUserStatus,
	"START_TYPING":       handleStartTyping,
	"STOP_TYPING":        handleStopTyping,
}

var disconnectTimers = struct {
	sync.Mutex
	timers map[string]*time.Timer
}{timers: make(map[string]*time.Timer)}

func handleWebSocket(c *gin.Context) {
	userId, conn, err := establishWebSocketConnection(c)
	if err != nil {
		return
	}

	registerClient(userId, conn)
	go handleWebSocketMessages(userId, conn)
}

func registerClient(userId string, conn *websocket.Conn) {
	disconnectTimers.Lock()
	if t, ok := disconnectTimers.timers[userId]; ok {
		t.Stop()
		delete(disconnectTimers.timers, userId)
	}
	disconnectTimers.Unlock()

	hub.lock.Lock()

	ws := &WSConnection{Conn: conn}
	hub.clients[userId] = append(hub.clients[userId], ws)

	if _, exists := hub.status[userId]; !exists {
		hub.status[userId] = Online
	}

	effectiveStatus := hub.status[userId]

	hub.lock.Unlock()

	writeToConn(ws, "UPDATE_USER_STATUS", UserStatusResponse{
		UserId: userId,
		Status: effectiveStatus,
	})

	go broadcastStatusUpdate(userId, effectiveStatus)
}

func removeConnection(userId string, conn *websocket.Conn) {
	hub.lock.Lock()

	conns := hub.clients[userId]
	for i, ws := range conns {
		if ws.Conn == conn {
			conns = append(conns[:i], conns[i+1:]...)
			break
		}
	}

	if len(conns) == 0 {
		delete(hub.clients, userId)
		hub.lock.Unlock()

		scheduleDisconnectBroadcast(userId)
	} else {
		hub.clients[userId] = conns
		hub.lock.Unlock()
	}
}

func scheduleDisconnectBroadcast(userId string) {
	disconnectTimers.Lock()
	defer disconnectTimers.Unlock()

	if t, ok := disconnectTimers.timers[userId]; ok {
		t.Stop()
	}

	disconnectTimers.timers[userId] = time.AfterFunc(30*time.Second, func() {
		disconnectTimers.Lock()
		delete(disconnectTimers.timers, userId)
		disconnectTimers.Unlock()

		hub.lock.Lock()
		_, stillConnected := hub.clients[userId]
		storedStatus := hub.status[userId]
		if !stillConnected {
			delete(hub.status, userId)
		}
		hub.lock.Unlock()

		if !stillConnected && storedStatus != StatusInvisible {
			go broadcastStatusUpdate(userId, StatusOffline)
		}
	})
}

func handleWebSocketMessages(userId string, conn *websocket.Conn) {
	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			removeConnection(userId, conn)
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

func marshalResponse(eventType string, payload interface{}) ([]byte, error) {
	return json.Marshal(struct {
		EventType string      `json:"event_type"`
		Payload   interface{} `json:"payload"`
	}{
		EventType: eventType,
		Payload:   payload,
	})
}

func writeToConn(ws *WSConnection, eventType string, payload interface{}) {
	response, err := marshalResponse(eventType, payload)
	if err != nil {
		fmt.Println("Error marshalling response:", err)
		return
	}
	ws.Mutex.Lock()
	defer ws.Mutex.Unlock()
	ws.Conn.WriteMessage(websocket.TextMessage, response)
}

func sendResponse(conn *websocket.Conn, eventType string, payload interface{}) {
	hub.lock.RLock()
	var ws *WSConnection
	for _, conns := range hub.clients {
		for _, c := range conns {
			if c.Conn == conn {
				ws = c
				break
			}
		}
		if ws != nil {
			break
		}
	}
	hub.lock.RUnlock()

	if ws == nil {
		return
	}
	writeToConn(ws, eventType, payload)
}

func broadcastStatusUpdate(userId string, status UserStatus) {
	hub.lock.RLock()
	snapshot := make(map[string][]*WSConnection, len(hub.clients))
	for uid, conns := range hub.clients {
		snapshot[uid] = conns
	}
	hub.lock.RUnlock()

	guilds, err := fetchGuildMemberships(userId)
	if err != nil {
		fmt.Println("Error fetching guild memberships:", err)
		return
	}

	resp := UserStatusResponse{UserId: userId, Status: status}
	notified := make(map[string]struct{})

	for _, members := range guilds {
		for _, targetUserId := range members {
			if targetUserId == userId {
				continue
			}
			if _, done := notified[targetUserId]; done {
				continue
			}
			if conns, ok := snapshot[targetUserId]; ok {
				for _, c := range conns {
					sendResponse(c.Conn, "UPDATE_USER_STATUS", resp)
				}
				notified[targetUserId] = struct{}{}
			}
		}
	}
}

func EmitToGuild(eventType string, payload interface{}, key string, userId string) {
	hub.lock.RLock()
	snapshot := make(map[string][]*WSConnection, len(hub.clients))
	for uid, conns := range hub.clients {
		snapshot[uid] = conns
	}
	hub.lock.RUnlock()

	guilds, err := fetchGuildMemberships(userId)
	if err != nil {
		fmt.Println("Error fetching guild memberships:", err)
		return
	}

	notified := make(map[string]struct{})

	for _, members := range guilds {
		for _, targetUserId := range members {
			if targetUserId == userId {
				continue
			}
			if _, done := notified[targetUserId]; done {
				continue
			}
			if conns, ok := snapshot[targetUserId]; ok {
				for _, c := range conns {
					sendResponse(c.Conn, eventType, payload)
				}
				notified[targetUserId] = struct{}{}
			}
		}
	}
}

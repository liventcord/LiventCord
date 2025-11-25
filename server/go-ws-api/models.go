package main

import (
	"encoding/json"
	"sync"

	"github.com/gorilla/websocket"
)

type EventMessage struct {
	EventType string          `json:"event_type"`
	Payload   json.RawMessage `json:"payload"`
}

type UserStatus string

const (
	Online       UserStatus = "online"
	Offline      UserStatus = "offline"
	DoNotDisturb UserStatus = "do-not-disturb"
	Idling       UserStatus = "idle"
)

type ConnectivityStatus string

const (
	Connected    ConnectivityStatus = "connected"
	Disconnected ConnectivityStatus = "disconnected"
)

type UserStatusResponse struct {
	UserId             string `json:"userId"`
	ConnectivityStatus string `json:"status"`
}

type WSConnection struct {
	Conn  *websocket.Conn
	Mutex sync.Mutex
}

var connLookup = make(map[*websocket.Conn]*WSConnection)

var hub struct {
	clients            map[string]map[*WSConnection]bool
	connectivityStatus map[string]ConnectivityStatus
	userStatus         map[string]UserStatus
	lock               sync.RWMutex
}
var vcHub = newHub()

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

type UserStatusResponse struct {
	UserId             string `json:"userId"`
	ConnectivityStatus string `json:"status"`
}

var hub struct {
	clients            map[string]*websocket.Conn
	connectivityStatus map[string]UserStatus
	userStatus         map[string]UserStatus
	lock               sync.RWMutex
}

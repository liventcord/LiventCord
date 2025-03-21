package main

import (
	"encoding/json"
	"github.com/gorilla/websocket"
	"sync"
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
	UserId string     `json:"userId"`
	Status UserStatus `json:"status"`
}

type Hub struct {
	clients map[string]*websocket.Conn
	status  map[string]UserStatus
	lock    sync.RWMutex
}

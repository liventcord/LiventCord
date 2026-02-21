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
	UserId string     `json:"userId"`
	Status UserStatus `json:"status"`
}

type WSConnection struct {
	Conn  *websocket.Conn
	Mutex sync.Mutex
}

type Hub struct {
	lock    sync.RWMutex
	clients map[string][]*WSConnection
	status  map[string]UserStatus
}

var hub = Hub{
	clients: make(map[string][]*WSConnection),
	status:  make(map[string]UserStatus),
}

type VcConnection struct {
	ID   string
	Conn *websocket.Conn
}

var vcHub = newHub()

type EventHandler func(conn *websocket.Conn, event EventMessage, userId string)

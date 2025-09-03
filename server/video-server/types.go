package main

import (
	"encoding/json"
	"net/http"
	"strings"
	"sync"

	"github.com/gorilla/websocket"
)

type SessionData struct {
	MuteAudio string `json:"muteAudio"`
	MuteVideo string `json:"muteVideo"`
}

type Client struct {
	ID     string
	Conn   *websocket.Conn
	RoomID string
	SessID string
	Send   chan []byte
}

type Hub struct {
	mu             sync.RWMutex
	rooms          map[string]map[string]*Client
	clients        map[string]*Client
	roomMembers    map[string][]string
	sessions       map[string]map[string]SessionData
	allowedOrigins map[string]struct{}
}

type Envelope struct {
	Event string          `json:"event"`
	Data  json.RawMessage `json:"data"`
}

type JoinRoomPayload struct {
	RoomID  string `json:"roomId"`
	GuildID string `json:"guildId"`
}

type UserConnect struct {
	SID string `json:"sid"`
}

type UserList struct {
	List      []string `json:"list"`
	RtcUserId string   `json:"rtcUserId"`
}

type UserDisconnect struct {
	SID string `json:"sid"`
}

func newHub() *Hub {
	return &Hub{
		rooms:       make(map[string]map[string]*Client),
		clients:     make(map[string]*Client),
		roomMembers: make(map[string][]string),
		sessions:    make(map[string]map[string]SessionData),
		allowedOrigins: map[string]struct{}{
			"http://localhost:5173":        {},
			"https://liventcord.github.io": {},
		},
	}
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		if origin == "" {
			return true
		}
		if idx := strings.Index(origin, "#"); idx >= 0 {
			origin = origin[:idx]
		}
		_, ok := hub.allowedOrigins[origin]
		return ok
	},
}

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

type VcClient struct {
	ID         string
	Conn       *websocket.Conn
	RoomID     string
	SessID     string
	Send       chan []byte
	IsNoisy    bool
	IsMuted    bool
	IsDeafened bool
}

type VcHub struct {
	mu             sync.RWMutex
	rooms          map[string]map[string]*VcClient
	clients        map[string]*VcClient
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
	List      []VoiceUser `json:"list"`
	RtcUserId string      `json:"rtcUserId"`
}

type UserDisconnect struct {
	SID string `json:"sid"`
}

func newHub() *VcHub {
	return &VcHub{
		rooms:       make(map[string]map[string]*VcClient),
		clients:     make(map[string]*VcClient),
		roomMembers: make(map[string][]string),
		sessions:    make(map[string]map[string]SessionData),
		allowedOrigins: map[string]struct{}{
			"http://localhost:3000":        {},
			"https://liventcord.github.io": {},
		},
	}
}

var vcUpgrader = websocket.Upgrader{
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
		_, ok := vcHub.allowedOrigins[origin]
		return ok
	},
}

type DataPayload struct {
	TargetID  string          `json:"targetId"`
	Type      string          `json:"type"`
	SDP       json.RawMessage `json:"sdp,omitempty"`
	Candidate json.RawMessage `json:"candidate,omitempty"`
}

type VoiceUser struct {
	ID         string `json:"id"`
	IsNoisy    bool   `json:"isNoisy"`
	IsMuted    bool   `json:"isMuted"`
	IsDeafened bool   `json:"isDeafened"`
}

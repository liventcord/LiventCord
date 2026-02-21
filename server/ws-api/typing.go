package main

import (
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type TypingEvent struct {
	UserId        string `json:"userId"`
	GuildId       string `json:"guildId,omitempty"`
	ChannelId     string `json:"channelId"`
	TypingStopped bool   `json:"typingStopped,omitempty"`
}

var typingStates = sync.Map{}
var typingTimeouts = sync.Map{}

const typingTimeoutSeconds = 5

func handleStartTyping(conn *websocket.Conn, event EventMessage, userId string) {
	var payload struct {
		ChannelId string `json:"channelId"`
		GuildId   string `json:"guildId,omitempty"`
	}
	if err := json.Unmarshal(event.Payload, &payload); err != nil {
		return
	}

	key := fmt.Sprintf("%s_%s", payload.ChannelId, payload.GuildId)

	state, _ := typingStates.LoadOrStore(key, make(map[string]bool))
	userMap := state.(map[string]bool)
	userMap[userId] = true
	typingStates.Store(key, userMap)

	typingTimeouts.Store(userId, time.Now().Add(time.Second*typingTimeoutSeconds))

	message := TypingEvent{
		UserId:    userId,
		GuildId:   payload.GuildId,
		ChannelId: payload.ChannelId,
	}

	EmitToGuild("START_TYPING", message, key, userId)

	go checkTypingTimeout(userId, key, payload.GuildId, payload.ChannelId)
}

func handleStopTyping(conn *websocket.Conn, event EventMessage, userId string) {
	var payload struct {
		ChannelId string `json:"channelId"`
		GuildId   string `json:"guildId,omitempty"`
	}
	if err := json.Unmarshal(event.Payload, &payload); err != nil {
		return
	}

	key := fmt.Sprintf("%s_%s", payload.ChannelId, payload.GuildId)

	if state, ok := typingStates.Load(key); ok {
		userMap := state.(map[string]bool)
		delete(userMap, userId)
		typingStates.Store(key, userMap)
	}

	typingTimeouts.Delete(userId)

	message := TypingEvent{
		UserId:        userId,
		GuildId:       payload.GuildId,
		ChannelId:     payload.ChannelId,
		TypingStopped: true,
	}

	EmitToGuild("STOP_TYPING", message, key, userId)
}

func checkTypingTimeout(userId, key string, guildId, channelId string) {
	time.Sleep(typingTimeoutSeconds * time.Second)

	if timeout, ok := typingTimeouts.Load(userId); ok {
		if time.Now().After(timeout.(time.Time)) {
			handleTimeoutStopTyping(userId, key, guildId, channelId)
		}
	}
}

func handleTimeoutStopTyping(userId, key string, guildId, channelId string) {
	if state, ok := typingStates.Load(key); ok {
		userMap := state.(map[string]bool)
		if _, exists := userMap[userId]; exists {
			delete(userMap, userId)
			typingStates.Store(key, userMap)
		}
	}

	typingTimeouts.Delete(userId)

	message := TypingEvent{
		UserId:        userId,
		GuildId:       guildId,
		ChannelId:     channelId,
		TypingStopped: true,
	}

	EmitToGuild("STOP_TYPING", message, key, userId)
}

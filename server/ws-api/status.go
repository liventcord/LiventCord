package main

import (
	"fmt"

	"github.com/gorilla/websocket"
)

// This file handles user status updates and retrievals in a WebSocket server.

const (
	StatusOnline    UserStatus = "online"
	StatusIdle      UserStatus = "idle"
	StatusOffline   UserStatus = "offline"
	StatusDND       UserStatus = "do-not-disturb"
	StatusInvisible UserStatus = "invisible"
)

func isValidStatus(status UserStatus) bool {
	switch status {
	case StatusOnline, StatusIdle, StatusDND, StatusInvisible, StatusOffline:
		return true
	}
	return false
}

func handleUpdateUserStatus(conn *websocket.Conn, event EventMessage, userId string) {
	var statusUpdate struct {
		Status string `json:"status"`
	}
	if err := unmarshalPayload(event, &statusUpdate); err != nil {
		fmt.Println("Error unmarshalling status update:", err)
		return
	}

	status := UserStatus(statusUpdate.Status)
	if isValidStatus(status) {
		hub.lock.Lock()
		hub.status[userId] = status
		hub.lock.Unlock()

		broadcastStatusUpdate(userId, status)

		fmt.Printf("User %s status updated to %s\n", userId, status)
	} else {
		fmt.Println("Invalid status:", statusUpdate.Status)
	}
}

func handleGetUserStatus(conn *websocket.Conn, event EventMessage, userId string) {
	var request struct {
		UserIds []string `json:"user_ids"`
	}
	if err := unmarshalPayload(event, &request); err != nil {
		fmt.Println("Error unmarshalling get status request:", err)
		return
	}

	// Collect statuses and the target WSConnection under a single lock, then
	// release before writing so sendResponse does not deadlock re-acquiring it.
	hub.lock.RLock()
	var statusResponses []UserStatusResponse
	for _, id := range request.UserIds {
		userStatus, exists := hub.status[id]
		if !exists {
			userStatus = StatusOffline
		}
		statusResponses = append(statusResponses, UserStatusResponse{
			UserId: id,
			Status: userStatus,
		})
	}
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
	writeToConn(ws, event.EventType, statusResponses)
}

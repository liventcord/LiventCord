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
		hub.userStatus[userId] = status
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

	var statusResponses []UserStatusResponse
	hub.lock.RLock()
	defer hub.lock.RUnlock()

	for _, id := range request.UserIds {
		UserStatus, exists := hub.userStatus[id]
		if !exists {
			UserStatus = StatusOffline
		}

		statusResponses = append(statusResponses, UserStatusResponse{
			UserId:             id,
			ConnectivityStatus: string(UserStatus),
		})
	}

	if err := sendResponse(conn, event.EventType, statusResponses); err != nil {
		fmt.Println("Error sending status response:", err)
	}
}

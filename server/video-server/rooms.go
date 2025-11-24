package main

import (
	"encoding/json"
	"log"
)

func registerToRoom(c *Client) {
	hub.mu.Lock()
	defer hub.mu.Unlock()
	if _, ok := hub.rooms[c.RoomID]; !ok {
		hub.rooms[c.RoomID] = make(map[string]*Client)
	}
	hub.rooms[c.RoomID][c.ID] = c
	hub.roomMembers[c.RoomID] = append(hub.roomMembers[c.RoomID], c.ID)
	log.Printf("[%s] New member joined: %s", c.RoomID, c.ID)
}

func notifyUserConnect(c *Client) {
	hub.mu.RLock()
	defer hub.mu.RUnlock()
	for id, other := range hub.rooms[c.RoomID] {
		if id == c.ID {
			continue
		}
		sendJSON(other.Conn, Envelope{Event: "userConnect", Data: mustJSON(UserConnect{SID: c.ID})})
	}
}

func cleanupClient(c *Client) {
	hub.mu.Lock()
	defer hub.mu.Unlock()
	if c.RoomID != "" {
		if _, ok := hub.rooms[c.RoomID]; ok {
			delete(hub.rooms[c.RoomID], c.ID)
		}
		idx := -1
		for i, id := range hub.roomMembers[c.RoomID] {
			if id == c.ID {
				idx = i
				break
			}
		}
		if idx >= 0 {
			hub.roomMembers[c.RoomID] = append(hub.roomMembers[c.RoomID][:idx], hub.roomMembers[c.RoomID][idx+1:]...)
		}
		for id, other := range hub.rooms[c.RoomID] {
			_ = id
			sendJSON(other.Conn, Envelope{Event: "userDisconnect", Data: mustJSON(UserDisconnect{SID: c.ID})})
		}
		if len(hub.rooms[c.RoomID]) == 0 {
			delete(hub.rooms, c.RoomID)
			delete(hub.roomMembers, c.RoomID)
		}
		log.Printf("[%s] Member left: %s", c.RoomID, c.ID)
	}
	delete(hub.clients, c.ID)
}

func notifyUserLeave(client *Client, roomID string) {
	hub.mu.RLock()
	roomClients, exists := hub.rooms[roomID]
	hub.mu.RUnlock()
	if !exists {
		return
	}

	data := map[string]string{"userId": client.ID}
	envelope := Envelope{
		Event: "userDisconnect",
		Data:  mustJSON(data),
	}
	msg, _ := json.Marshal(envelope)

	for _, c := range roomClients {
		if c.ID == client.ID {
			continue
		}
		select {
		case c.Send <- msg:
		default:
			log.Println("[WS] Failed to notify userDisconnect to", c.ID)
		}
	}
}

func unregisterFromRoom(client *Client) {
	hub.mu.Lock()
	defer hub.mu.Unlock()

	roomClients, exists := hub.rooms[client.RoomID]
	if !exists {
		return
	}

	delete(roomClients, client.ID)
	if len(roomClients) == 0 {
		delete(hub.rooms, client.RoomID)
	} else {
		hub.rooms[client.RoomID] = roomClients
	}
}

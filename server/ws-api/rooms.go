package main

import (
	"encoding/json"
	"log"
)

func registerToRoom(c *VcClient) {
	vcHub.mu.Lock()
	defer vcHub.mu.Unlock()
	if _, ok := vcHub.rooms[c.RoomID]; !ok {
		vcHub.rooms[c.RoomID] = make(map[string]*VcClient)
	}
	vcHub.rooms[c.RoomID][c.ID] = c
	vcHub.roomMembers[c.RoomID] = append(vcHub.roomMembers[c.RoomID], c.ID)
	log.Printf("[%s] New member joined: %s", c.RoomID, c.ID)
}

func notifyUserConnect(c *VcClient) {
	vcHub.mu.RLock()
	defer vcHub.mu.RUnlock()
	for id, other := range vcHub.rooms[c.RoomID] {
		if id == c.ID {
			continue
		}
		sendJSON(other.Conn, Envelope{Event: "userConnect", Data: mustJSON(UserConnect{SID: c.ID})})
	}
}

func cleanupClient(c *VcClient) {
	vcHub.mu.Lock()
	defer vcHub.mu.Unlock()
	if c.RoomID != "" {
		if _, ok := vcHub.rooms[c.RoomID]; ok {
			delete(vcHub.rooms[c.RoomID], c.ID)
		}
		idx := -1
		for i, id := range vcHub.roomMembers[c.RoomID] {
			if id == c.ID {
				idx = i
				break
			}
		}
		if idx >= 0 {
			vcHub.roomMembers[c.RoomID] = append(vcHub.roomMembers[c.RoomID][:idx], vcHub.roomMembers[c.RoomID][idx+1:]...)
		}
		for id, other := range vcHub.rooms[c.RoomID] {
			_ = id
			sendJSON(other.Conn, Envelope{Event: "userDisconnect", Data: mustJSON(UserDisconnect{SID: c.ID})})
		}
		if len(vcHub.rooms[c.RoomID]) == 0 {
			delete(vcHub.rooms, c.RoomID)
			delete(vcHub.roomMembers, c.RoomID)
		}
		log.Printf("[%s] Member left: %s", c.RoomID, c.ID)
	}
	delete(vcHub.clients, c.ID)
}

func notifyUserLeave(client *VcClient, roomID string) {
	vcHub.mu.RLock()
	roomClients, exists := vcHub.rooms[roomID]
	vcHub.mu.RUnlock()
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

func unregisterFromRoom(client *VcClient) {
	vcHub.mu.Lock()
	defer vcHub.mu.Unlock()

	roomClients, exists := vcHub.rooms[client.RoomID]
	if !exists {
		return
	}

	delete(roomClients, client.ID)
	if len(roomClients) == 0 {
		delete(vcHub.rooms, client.RoomID)
	} else {
		vcHub.rooms[client.RoomID] = roomClients
	}
}

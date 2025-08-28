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

func emitUserList(c *Client) {
	hub.mu.RLock()
	defer hub.mu.RUnlock()
	members := hub.roomMembers[c.RoomID]
	payload := UserList{
		List:      members,
		RtcUserId: c.ID,
	}
	sendJSON(c.Conn, Envelope{Event: "userList", Data: mustJSON(payload)})
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

func forwardData(senderID string, targetID string, data json.RawMessage) {
	if targetID == "" {
		for _, c := range hub.clients {
			if c.ID != senderID {
				c.Send <- data
			}
		}
		return
	}

	if c, ok := hub.clients[targetID]; ok && targetID != senderID {
		c.Send <- data
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

package main

import (
	"encoding/json"
	"log"

	"github.com/gorilla/websocket"
)

func buildSignalData(p DataPayload) []byte {
	data := map[string]interface{}{"type": p.Type}

	addOptionalJSON(p.SDP, "sdp", data)
	addOptionalJSON(p.Candidate, "candidate", data)

	out, err := json.Marshal(data)
	if err != nil {
		log.Println("[WS] Failed to marshal signal data:", err)
		return nil
	}
	return out
}

func addOptionalJSON(raw json.RawMessage, key string, target map[string]interface{}) {
	if raw == nil {
		return
	}
	var decoded interface{}
	if err := json.Unmarshal(raw, &decoded); err == nil {
		target[key] = decoded
	}
}

func sendEnvelope(client *Client, event string, data interface{}) {
	envelope := Envelope{
		Event: event,
		Data:  mustJSON(data),
	}
	msg, _ := json.Marshal(envelope)
	select {
	case client.Send <- msg:
	default:
		log.Println("[WS] Failed to send", event, "to", client.ID, "(channel full or closed)")
	}
}

func forwardData(fromID, targetID string, signalDataJSON []byte) {
	var signalData map[string]interface{}
	if err := json.Unmarshal(signalDataJSON, &signalData); err != nil {
		log.Println("[WS] Failed to unmarshal signalData for adding senderId:", err)
		return
	}
	signalData["senderId"] = fromID

	envelope := Envelope{
		Event: "data",
		Data:  mustJSON(signalData),
	}
	envelopeJSON, _ := json.Marshal(envelope)

	hub.mu.RLock()
	targetClient, exists := hub.clients[targetID]
	hub.mu.RUnlock()
	if !exists {
		log.Println("[WS] Target client not found:", targetID)
		return
	}

	select {
	case targetClient.Send <- envelopeJSON:
		log.Println("[WS] Forwarded data to", targetID)
	default:
		log.Println("[WS] Failed to send to", targetID, "- channel full or closed")
	}
}

func cleanupConnection(client *Client) {
	cleanupClient(client)
	close(client.Send)
	client.Conn.Close()
	log.Println("[WS] Client disconnected:", client.ID)
}

func clientWriter(client *Client) {
	for msg := range client.Send {
		if err := client.Conn.WriteMessage(websocket.TextMessage, msg); err != nil {
			log.Println("[WS] Write error for", client.ID, ":", err)
			break
		}
	}
}

package main

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"net/url"
	"strings"

	"github.com/go-redis/redis/v8"
	"github.com/gorilla/websocket"
)

var redisClient *redis.Client
var ctx = context.Background()

func initRedisClient(redisURL string) error {
	options, err := parseRedisURL(redisURL)
	if err != nil {
		return fmt.Errorf("error parsing Redis URL: %v", err)
	}

	redisClient = redis.NewClient(options)
	_, err = redisClient.Ping(ctx).Result()
	if err != nil {
		return fmt.Errorf("error connecting to Redis: %v", err)
	}

	return nil
}

func consumeMessagesFromRedis() {
	streamName := "event_stream"
	lastID := "0"

	for {
		messages, err := redisClient.XRead(ctx, &redis.XReadArgs{
			Streams: []string{streamName, lastID},
			Block:   0,
			Count:   1,
		}).Result()
		if err != nil {
			fmt.Println("Error reading from Redis stream:", err)
			return
		}
		fmt.Println("Messages received from Redis:", messages)
		for _, msg := range messages {
			for _, xMessage := range msg.Messages {
				eventType, ok := xMessage.Values["EventType"].(string)
				if !ok {
					fmt.Println("Error: EventType field is missing or invalid")
					continue
				}
				rawPayload, ok := xMessage.Values["Payload"].(string)
				if !ok {
					fmt.Println("Error: Payload field is missing or invalid")
					continue
				}
				eventMessage := EventMessage{
					EventType: eventType,
					Payload:   json.RawMessage(rawPayload),
				}
				userIDsStr, ok := xMessage.Values["UserIDs"].(string)
				if !ok {
					fmt.Println("Error: UserIDs field is missing or invalid")
					continue
				}
				var userIDs []string
				err = json.Unmarshal([]byte(userIDsStr), &userIDs)
				if err != nil {
					fmt.Println("Error unmarshalling UserIDs:", err)
					continue
				}
				hub.lock.RLock()
				for _, userId := range userIDs {
					conn, ok := hub.clients[userId]
					if ok {
						payload, err := json.Marshal(eventMessage)
						if err != nil {
							fmt.Println("Error marshalling message:", err)
							continue
						}
						err = conn.WriteMessage(websocket.TextMessage, payload)
						if err != nil {
							fmt.Println("Error sending message to WebSocket client:", err)
							conn.Close()
							hub.lock.Lock()
							delete(hub.clients, userId)
							hub.lock.Unlock()
						}
					}
				}
				hub.lock.RUnlock()
			}
			lastID = messages[len(messages)-1].Messages[len(messages[len(messages)-1].Messages)-1].ID
		}
	}
}

func parseRedisURL(redisURL string) (*redis.Options, error) {
	parsedURL, err := url.Parse(redisURL)
	if err != nil {
		return nil, err
	}

	options := &redis.Options{}

	options.Addr = parsedURL.Host
	if parsedURL.Scheme == "rediss" {
		options.TLSConfig = &tls.Config{}
	}

	if parsedURL.User != nil {
		password, _ := parsedURL.User.Password()
		options.Password = password

		username := parsedURL.User.Username()
		if username != "" {
			options.Username = username
		}
	}

	hostParts := strings.Split(parsedURL.Host, ":")
	if len(hostParts) > 0 {
		options.Addr = hostParts[0]
	}
	if len(hostParts) > 1 {
		options.Addr = hostParts[0] + ":" + hostParts[1]
	}

	return options, nil
}

package main

import (
	"context"
	"encoding/json"
)

func fetchGuildMemberships(userId string) (map[string][]string, error) {
	ctx := context.Background()
	guildKeysPattern := "guild_memberships:*"
	iter := redisClient.Scan(ctx, 0, guildKeysPattern, 100).Iterator()
	memberships := make(map[string][]string)

	for iter.Next(ctx) {
		guildKey := iter.Val()
		keyType, err := redisClient.Type(ctx, guildKey).Result()
		if err != nil || keyType != "string" {
			continue
		}

		rawValue, err := redisClient.Get(ctx, guildKey).Result()
		if err != nil {
			continue
		}

		var guildMembers []string
		if err := json.Unmarshal([]byte(rawValue), &guildMembers); err != nil {
			continue
		}

		for _, id := range guildMembers {
			if id == userId {
				guildID := guildKey[len("guild_memberships:"):]
				memberships[guildID] = guildMembers
				break
			}
		}
	}

	if err := iter.Err(); err != nil {
		return nil, err
	}

	return memberships, nil
}

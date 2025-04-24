package main

import (
	"log"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
)

func main() {
	loadConfig()
	port := getEnv("Port", "8080")
	hostname := getEnv("Host", "0.0.0.0")
	appMode := getEnv("AppMode", "debug")
	redisURI := getEnv("RedisURI", "redis://localhost:6379")

	router := gin.Default()

	if appMode == "debug" {
		gin.SetMode(gin.DebugMode)
	} else {
		gin.SetMode(gin.ReleaseMode)
	}

	router.GET("/ws", handleWebSocket)
	router.GET("/", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status": "Service is running",
		})
	})

	options, err := parseRedisURL(redisURI)
	if err != nil {
		log.Fatalf("Error parsing Redis URL: %v", err)
	}
	redisClient = redis.NewClient(options)

	if redisClient != nil {
		go consumeMessagesFromRedis()
	}
	if err := initRedisClient(redisURI); err != nil {
		log.Fatalf("Failed to initialize Redis client: %v", err)
	}

	router.Run(hostname + ":" + port)
}

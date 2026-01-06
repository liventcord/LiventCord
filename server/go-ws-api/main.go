package main

import (
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"github.com/liventcord/liventcord/server/telemetry"
)

func main() {
	loadConfig()
	port := getEnv("Port", "8080")
	hostname := getEnv("Host", "0.0.0.0")
	appMode := getEnv("AppMode", "debug")
	redisURI := getEnv("RedisURI", "redis://localhost:6379")
	r := gin.Default()

	if appMode == "debug" {
		gin.SetMode(gin.DebugMode)
	} else {
		gin.SetMode(gin.ReleaseMode)
	}
	r.GET("/ws", handleWebSocket)
	r.GET("/", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status": "Service is running",
		})
	})
	r.GET("/video-ws", func(c *gin.Context) {
		HandleWS(c.Writer, c.Request)
	})

	startPingRoutine()

	telemetry.Init()

	adminPassword := getEnv("AdminPassword", "")

	if adminPassword != "" {
		r.GET("/health",
			AdminAuthMiddleware(adminPassword),
			telemetry.HealthHandler("WS Api", nil, nil, func() int {
				return len(hub.userStatus)
			}),
		)
	}

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

	r.Run(hostname + ":" + port)
}

func AdminAuthMiddleware(adminPassword string) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" || parts[1] != adminPassword {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}

		c.Next()
	}
}

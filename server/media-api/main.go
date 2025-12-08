package main

import (
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync/atomic"

	"github.com/liventcord/server/telemetry"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

var (
	servedFilesSinceStartup int64
)

func main() {

	gin.SetMode(gin.ReleaseMode)
	r := gin.Default()

	err := godotenv.Load()
	if err != nil {
		fmt.Println("Warning: Could not load .env file:", err)
	}

	adminPassword := getEnv("AdminPassword", "")
	if adminPassword == "" {
		log.Panic("AdminPassword not set. Cannot start server.")
	}

	r.Use(cors([]string{"*"}))

	r.GET("/", func(c *gin.Context) {
		c.String(http.StatusOK, "LiventCord media api is working.")
	})

	initializeProxy(r, adminPassword)
	initializeYtStream(r)

	host := getEnv("HOST", "0.0.0.0")
	port := getEnv("PORT", "5000")

	address := fmt.Sprintf("%s:%s", host, port)
	log.Printf("Server running on %s\n", address)
	r.Run(address)
}

func initializeProxy(r *gin.Engine, adminPassword string) {
	cfg := LoadConfig()
	settings := NewMediaCacheSettings(cfg)
	initializer := NewMediaStorageInitializer(settings, nil)
	initializer.Initialize()
	controller := NewMediaProxyController(settings)

	storageStatus := initializer.GetStorageStatus()
	telemetry.Init()

	admin := r.Group("/", AdminAuthMiddleware(adminPassword))

	admin.GET("/health",
		telemetry.HealthHandler("Media Proxy Api", storageStatus, nil, func() int {
			return int(atomic.LoadInt64(&servedFilesSinceStartup))
		}),
	)

	admin.GET("/api/proxy/media", func(c *gin.Context) {
		controller.GetMedia(c)
		newCount := atomic.AddInt64(&servedFilesSinceStartup, 1)
		fmt.Println("New servedFilesSinceStartup:", newCount)
	})

	admin.POST("/api/proxy/metadata", controller.FetchMetadata)

	admin.GET("/attachments/:attachmentId/preview", GetVideoAttachmentPreview)
}

func cors(allowedOrigins []string) gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		for _, allowedOrigin := range allowedOrigins {
			if origin == allowedOrigin || allowedOrigin == "*" {
				c.Header("Access-Control-Allow-Origin", origin)
				c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
				c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
				c.Header("Access-Control-Allow-Credentials", "true")
				break
			}
		}
		if c.Request.Method == http.MethodOptions {
			c.Status(http.StatusOK)
			return
		}
		c.Next()
	}
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

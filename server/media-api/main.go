package main

import (
	"fmt"
	"log"
	"net/http"

	"github.com/liventcord/server/telemetry"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

var (
	servedFilesSinceStartup int
)

func main() {

	gin.SetMode(gin.ReleaseMode)
	r := gin.Default()

	r.GET("/attachments/:attachmentId/preview", GetVideoAttachmentPreview)
	r.GET("/", func(c *gin.Context) {
		c.String(http.StatusOK, "LiventCord YT stream api is working.")
	})

	initializeProxy(r)

	initializeYtStream(r)

	host := getEnv("HOST", "0.0.0.0")
	port := getEnv("PORT", "5000")

	address := fmt.Sprintf("%s:%s", host, port)
	log.Printf("Server running on %s\n", address)
	r.Run(address)
}

func initializeProxy(r *gin.Engine) {
	err := godotenv.Load()
	if err != nil {
		fmt.Println("Warning: Could not load .env file:", err)
	}

	cfg := LoadConfig()
	settings := NewMediaCacheSettings(cfg)
	initializer := NewMediaStorageInitializer(settings, nil)
	initializer.Initialize()
	controller := NewMediaProxyController(settings)

	r.Use(cors([]string{"*"}))

	storageStatus := initializer.GetStorageStatus()
	telemetry.Init()

	adminPassword := getEnv("AdminPassword", "")

	if adminPassword != "" {
		r.GET("/health",
			AdminAuthMiddleware(adminPassword),
			telemetry.HealthHandler("Media Proxy Api", storageStatus, nil, func() int {
				return servedFilesSinceStartup
			}),
		)
	}

	r.GET("/api/proxy/media",
		AdminAuthMiddleware(adminPassword),
		func(c *gin.Context) {
			controller.GetMedia(c)
			servedFilesSinceStartup++
			fmt.Println("New servedFilesSinceStartup: ", servedFilesSinceStartup)
		},
	)

	r.POST("/api/proxy/metadata",
		AdminAuthMiddleware(adminPassword),
		controller.FetchMetadata,
	)
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
		if authHeader != adminPassword {
			c.AbortWithStatusJSON(401, gin.H{"error": "Unauthorized"})
			return
		}
		c.Next()
	}
}

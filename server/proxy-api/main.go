package main

import (
	"fmt"
	"os"

	"github.com/liventcord/liventcord/server/telemetry"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

var (
	servedFilesSinceStartup int
)

func main() {
	err := godotenv.Load()
	if err != nil {
		fmt.Println("Warning: Could not load .env file:", err)
	}

	cfg := LoadConfig()
	settings := NewMediaCacheSettings(cfg)
	initializer := NewMediaStorageInitializer(settings, nil)
	initializer.Initialize()
	controller := NewMediaProxyController(settings)

	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowAllOrigins:  true,
		AllowMethods:     []string{"GET", "POST", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	r.GET("/", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status": "Proxy service is running",
		})
	})
	storageStatus := initializer.GetStorageStatus()
	telemetry.Init()

	loadConfig()
	adminPassword := getEnv("AdminPassword", "")

	if adminPassword != "" {
		r.GET("/health",
			AdminAuthMiddleware(adminPassword),
			telemetry.HealthHandler("Proxy Api", storageStatus, nil, func() int {
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

	host := os.Getenv("HOST")
	if host == "" {
		host = "0.0.0.0"
	}
	port := os.Getenv("PORT")
	if port == "" {
		port = "5000"
	}

	address := fmt.Sprintf("%s:%s", host, port)
	r.Run(address)
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

func getEnv(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}
func loadConfig() {
	if err := godotenv.Load(); err != nil {
		fmt.Println("Error loading .env file")
	}
}

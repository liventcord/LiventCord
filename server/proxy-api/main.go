package main

import (
	"fmt"
	"os"
	"runtime"
	"sync/atomic"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/shirou/gopsutil/v3/mem"
)

var (
	startTime               time.Time
	servedFilesSinceStartup uint64
)

func main() {
	err := godotenv.Load()
	if err != nil {
		fmt.Println("Warning: Could not load .env file:", err)
	}

	startTime = time.Now()

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

	r.GET("/health", func(c *gin.Context) {
		uptime := humanReadableDuration(time.Since(startTime))
		var m runtime.MemStats
		runtime.ReadMemStats(&m)

		vmStat, err := mem.VirtualMemory()
		var systemMemory gin.H
		if err == nil {
			systemMemory = gin.H{
				"total":       humanReadableBytes(vmStat.Total),
				"used":        humanReadableBytes(vmStat.Used),
				"usedPercent": fmt.Sprintf("%.2f%%", vmStat.UsedPercent),
			}
		} else {
			systemMemory = gin.H{"error": err.Error()}
		}

		storageStatus := initializer.GetStorageStatus()

		c.JSON(200, gin.H{
			"service": "Proxy service",
			"status":  "running",
			"uptime":  uptime,
			"config":  fmt.Sprintf("Media Limit: %.0f GB", float64(cfg.ExternalMediaLimit)/(1024*1024*1024)),
			"memory": gin.H{
				"go_alloc":       humanReadableBytes(m.Alloc),
				"go_total_alloc": humanReadableBytes(m.TotalAlloc),
				"go_sys":         humanReadableBytes(m.Sys),
				"num_gc":         m.NumGC,
				"system":         systemMemory,
			},
			"goroutines":              runtime.NumGoroutine(),
			"servedFilesSinceStartup": atomic.LoadUint64(&servedFilesSinceStartup),
			"storageStatus":           storageStatus,
		})
	})

	r.GET("/api/proxy/media", func(c *gin.Context) {
		controller.GetMedia(c)
		atomic.AddUint64(&servedFilesSinceStartup, 1)
	})

	r.POST("/api/proxy/metadata", controller.FetchMetadata)

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

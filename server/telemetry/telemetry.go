package telemetry

import (
	"fmt"
	"runtime"
	"sync/atomic"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/mem"
)

var (
	StartTime               time.Time
	ServedFilesSinceStartup *uint64
)

func Init(servedFiles *uint64) {
	StartTime = time.Now()
	if servedFiles == nil {
		servedFiles = new(uint64)
	}
	ServedFilesSinceStartup = servedFiles
}

func HumanReadableBytes(bytes uint64) string {
	const (
		KB = 1024
		MB = KB * 1024
		GB = MB * 1024
	)
	switch {
	case bytes >= GB:
		return fmt.Sprintf("%.2f GB", float64(bytes)/float64(GB))
	case bytes >= MB:
		return fmt.Sprintf("%.2f MB", float64(bytes)/float64(MB))
	case bytes >= KB:
		return fmt.Sprintf("%.2f KB", float64(bytes)/float64(KB))
	default:
		return fmt.Sprintf("%d B", bytes)
	}
}

func HumanReadableDuration(d time.Duration) string {
	hours := int(d.Hours())
	minutes := int(d.Minutes()) % 60
	if hours >= 24 {
		days := hours / 24
		hours = hours % 24
		return fmt.Sprintf("%dd %dh", days, hours)
	}
	return fmt.Sprintf("%dh %dm", hours, minutes)
}

// Your existing HealthHandler with CPU usage added
func HealthHandler(
	serviceName string,
	storageStatus map[string]interface{},
	externalMediaLimit *int64,
	getUsersCount func() int,
) gin.HandlerFunc {
	return func(c *gin.Context) {
		uptime := HumanReadableDuration(time.Since(StartTime))

		var m runtime.MemStats
		runtime.ReadMemStats(&m)

		vmStat, err := mem.VirtualMemory()
		var systemMemory gin.H
		if err == nil {
			systemMemory = gin.H{
				"total":       HumanReadableBytes(vmStat.Total),
				"used":        HumanReadableBytes(vmStat.Used),
				"usedPercent": fmt.Sprintf("%.2f%%", vmStat.UsedPercent),
			}
		} else {
			systemMemory = gin.H{"error": err.Error()}
		}

		// Get CPU usage percentage over 500ms interval
		cpuPercents, err := cpu.Percent(500*time.Millisecond, false)
		var cpuUsage string
		if err == nil && len(cpuPercents) > 0 {
			cpuUsage = fmt.Sprintf("%.2f%%", cpuPercents[0])
		} else if err != nil {
			cpuUsage = fmt.Sprintf("error: %v", err)
		} else {
			cpuUsage = "N/A"
		}

		response := gin.H{
			"service": serviceName,
			"status":  "running",
			"uptime":  uptime,
			"memory": gin.H{
				"go_sys": HumanReadableBytes(m.Sys),
				"num_gc": m.NumGC,
				"system": systemMemory,
			},
			"cpuUsagePercent":         cpuUsage, // <--- Added CPU usage here
			"goroutines":              runtime.NumGoroutine(),
			"servedFilesSinceStartup": atomic.LoadUint64(ServedFilesSinceStartup),
		}

		if storageStatus != nil {
			response["storageStatus"] = storageStatus
		}

		if externalMediaLimit != nil {
			response["config"] = fmt.Sprintf("Media Limit: %.0f GB", float64(*externalMediaLimit)/(1024*1024*1024))
		}
		usersCount := 0
		if getUsersCount != nil {
			usersCount = getUsersCount()
		}
		if usersCount > 0 {
			response["usersCount"] = usersCount
		}
		c.JSON(200, response)
	}
}

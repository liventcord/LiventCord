package main

import (
	"fmt"
	"github.com/gin-gonic/gin"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sort"
	"time"
	"sync"
)

const cacheHeader = "public, max-age=31536000, immutable"

func getCachePath(videoID string) string {
	return filepath.Join("cache", videoID+".cache")
}

func getAudioStream(videoID string) (string, error) {
    tempCookies := "/tmp/cookies.txt"
    err := exec.Command("cp", "/etc/secrets/cookies.txt", tempCookies).Run()
    if err != nil {
        return "", fmt.Errorf("failed to copy cookies file.")
    }

    cmd := exec.Command("yt-dlp", "--cookies", tempCookies, "-f", "bestaudio[ext=m4a]/bestaudio[height<=480]", "--get-url", "https://www.youtube.com/watch?v="+videoID)
    output, err := cmd.CombinedOutput()
    if err != nil {
        log.Printf("yt-dlp command failed.")
        return "", fmt.Errorf("yt-dlp error.")
    }
    return strings.TrimSpace(string(output)), nil
}



func handleRangeRequest(c *gin.Context, data []byte) {
	c.Header("Accept-Ranges", "bytes")
	c.Header("Cache-Control", cacheHeader)

	rangeHeader := c.GetHeader("Range")
	if rangeHeader == "" {
		c.Header("Content-Type", "audio/mp4")
		c.Header("Content-Length", fmt.Sprintf("%d", len(data)))
		c.Status(http.StatusOK)
		c.Writer.Write(data)
		return
	}

	var start, end int
	size := len(data)
	if _, err := fmt.Sscanf(rangeHeader, "bytes=%d-%d", &start, &end); err != nil {
		end = size - 1
	}

	if start < 0 || end >= size || start > end {
		c.Status(http.StatusRequestedRangeNotSatisfiable)
		return
	}

	chunk := data[start : end+1]
	contentRange := fmt.Sprintf("bytes %d-%d/%d", start, end, size)
	c.Header("Content-Range", contentRange)
	c.Header("Content-Length", fmt.Sprintf("%d", len(chunk)))
	c.Header("Content-Type", "audio/mp4")
	c.Status(http.StatusPartialContent)
	c.Writer.Write(chunk)
}

func proxyStreamWithCache(c *gin.Context, videoID string) {
	cachePath := getCachePath(videoID)

	if _, err := os.Stat(cachePath); err == nil {
		log.Println("[CACHE] Serving from disk:", videoID)
		f, err := os.Open(cachePath)
		if err != nil {
			log.Println("[ERROR] Failed to read cache file:", err)
			c.Status(http.StatusInternalServerError)
			return
		}
		defer f.Close()
		http.ServeContent(c.Writer, c.Request, videoID, time.Now(), f)
		return
	}

	log.Println("[DEBUG] Fetching stream URL for:", videoID)
	audioURL, err := getAudioStream(videoID)
	if err != nil {
		log.Println("[ERROR] Failed to get stream URL:", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to retrieve audio stream: %v", err)})
		return
	}

	log.Println("[DEBUG] Fetched YouTube audio URL:", audioURL)

	client := &http.Client{}
	req, err := http.NewRequest("GET", audioURL, nil)
	if err != nil {
		log.Println("[ERROR] Failed to create HTTP request:", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create request"})
		return
	}

	rangeHeader := c.GetHeader("Range")
	if rangeHeader != "" {
		req.Header.Set("Range", rangeHeader)
		log.Println("[DEBUG] Forwarding Range request:", rangeHeader)
	}

	resp, err := client.Do(req)
	if err != nil {
		log.Println("[ERROR] Failed to fetch audio stream:", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch audio stream"})
		return
	}
	defer resp.Body.Close()

	for key, values := range resp.Header {
		c.Writer.Header()[key] = values
	}
	
	c.Header("Cache-Control", cacheHeader)
	c.Status(resp.StatusCode)

	tmpPath := cachePath + ".tmp"
	f, err := os.Create(tmpPath)
	if err != nil {
		log.Println("[ERROR] Failed to create cache file:", err)
		f = nil
	} else {
		defer func() {
			f.Close()
			if err == nil {
				os.Rename(tmpPath, cachePath)
				log.Println("[CACHE] Stored on disk:", videoID)
			} else {
				os.Remove(tmpPath)
			}
		}()
	}

	writer := io.MultiWriter(c.Writer)
	if f != nil {
		writer = io.MultiWriter(c.Writer, f)
	}

	written, err := io.Copy(writer, resp.Body)
	if err != nil {
		log.Println("[ERROR] Error streaming audio:", err)
		return
	}

	log.Printf("[DEBUG] Successfully streamed %d bytes\n", written)
}

func cleanCache(maxSize int64) {
    cacheDir := "cache"
    files, err := os.ReadDir(cacheDir)
    if err != nil {
        log.Println("[ERROR] Failed to read cache directory:", err)
        return
    }

    var totalSize int64
    var fileList []os.FileInfo

    for _, file := range files {
        fi, err := file.Info()
        if err != nil {
            continue
        }
        totalSize += fi.Size()
        fileList = append(fileList, fi)
    }

    if totalSize > maxSize {
        log.Println("[CACHE] Cache limit exceeded, deleting old files...")
        sort.Slice(fileList, func(i, j int) bool {
            return fileList[i].ModTime().Before(fileList[j].ModTime())
        })

        for _, file := range fileList {
            os.Remove(filepath.Join(cacheDir, file.Name()))
            totalSize -= file.Size()
            if totalSize < maxSize {
                break
            }
        }
    }
}

var urlCache = sync.Map{}

func getCachedAudioStream(videoID string) (string, error) {
    if url, ok := urlCache.Load(videoID); ok {
        return url.(string), nil
    }

    url, err := getAudioStream(videoID)
    if err == nil {
        urlCache.Store(videoID, url)
        go func() {
            time.Sleep(5 * time.Minute)
            urlCache.Delete(videoID)
        }()
    }
    return url, err
}

func startCacheCleaner(interval time.Duration, maxSize int64) {
    ticker := time.NewTicker(interval)
    go func() {
        for range ticker.C {
            cleanCache(maxSize)
        }
    }()
}


func main() {
	os.MkdirAll("cache", os.ModePerm)
	CACHE_LIMIT_GB := 0.5
	go startCacheCleaner(5*time.Minute, int64(CACHE_LIMIT_GB*1024*1024*1024))
	gin.SetMode(gin.ReleaseMode)
	router := gin.Default()

	corsDomains := os.Getenv("CORS_DOMAINS")
	if corsDomains != "" {
		router.Use(gin.Logger())
		allowedOrigins := strings.Split(corsDomains, ",")
		router.Use(cors(allowedOrigins))
	}

	router.GET("/stream/audio/:videoID", func(c *gin.Context) {
		videoID := c.Param("videoID")
		cachePath := getCachePath(videoID)

		if _, err := os.Stat(cachePath); err == nil {
			log.Println("[CACHE] Serving from disk:", videoID)
			data, err := os.ReadFile(cachePath)
			if err != nil {
				log.Println("[ERROR] Failed to read cache file:", err)
				c.Status(http.StatusInternalServerError)
				return
			}
			handleRangeRequest(c, data)
			return
		}

		proxyStreamWithCache(c, videoID)
	})

	router.HEAD("/stream/audio/:videoID", func(c *gin.Context) {
		videoID := c.Param("videoID")
		cachePath := getCachePath(videoID)

		if fi, err := os.Stat(cachePath); err == nil {
			c.Header("Content-Type", "audio/mp4")
			c.Header("Content-Length", fmt.Sprintf("%d", fi.Size()))
			c.Header("Cache-Control", cacheHeader)
			log.Println("[CACHE] HEAD request served from disk:", videoID)
			c.Status(http.StatusOK)
			return
		}

		audioURL, err := getAudioStream(videoID)
		if err != nil {
			log.Println("[ERROR] HEAD request: failed to get stream URL:", err)
			c.Status(http.StatusNotFound)
			return
		}

		client := &http.Client{}
		req, err := http.NewRequest("HEAD", audioURL, nil)
		if err != nil {
			c.Status(http.StatusNotFound)
			return
		}
		resp, err := client.Do(req)
		if err != nil || resp.StatusCode != http.StatusOK {
			c.Status(http.StatusNotFound)
			return
		}
		for key, values := range resp.Header {
			for _, value := range values {
				c.Writer.Header().Add(key, value)
			}
		}
		c.Status(http.StatusOK)
	})

	log.Println("Server running on :8080")
	router.Run(":8080")
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

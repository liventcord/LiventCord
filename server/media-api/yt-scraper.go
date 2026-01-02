package main

import (
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

func getYTAudioURL(videoURL string) (string, error) {
	tempCookies := "/tmp/cookies.txt"
	if _, err := os.Stat("/etc/secrets/cookies.txt"); err == nil {
		exec.Command("cp", "/etc/secrets/cookies.txt", tempCookies).Run()
	}

	args := []string{"-f", "bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio", "--hls-prefer-native", "--get-url", videoURL}
	if _, err := os.Stat(tempCookies); err == nil {
		args = append([]string{"--cookies", tempCookies}, args...)
	}

	cmd := exec.Command("yt-dlp", args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("yt-dlp failed: %v", err)
	}

	for _, line := range strings.Split(strings.TrimSpace(string(output)), "\n") {
		if strings.HasPrefix(line, "http://") || strings.HasPrefix(line, "https://") {
			return line, nil
		}
	}

	return "", fmt.Errorf("no valid URL found")
}

func ytStreamHandler(c *gin.Context) {
	videoID := c.Query("id")
	if videoID == "" {
		c.JSON(400, gin.H{"error": "Missing video id"})
		return
	}

	videoURL := fmt.Sprintf("https://www.youtube.com/watch?v=%s", videoID)
	cachePath, err := GetYouTubeCachePath(videoID)
	if err != nil {
		fmt.Printf("Invalid track ID: %v", err)
		return
	}
	isGet := c.Request.Method == "GET"

	if fi, err := os.Stat(cachePath); err == nil {
		if isGet {
			HandleRangeRequest(c, cachePath, YouTube)
			return
		}
		c.Header("Content-Type", "audio/mp4")
		c.Header("Content-Length", fmt.Sprintf("%d", fi.Size()))
		c.Header("Accept-Ranges", "bytes")
		c.Header("Cache-Control", CacheHeader)
		c.Status(200)
		return
	}

	if !isGet {
		reqURL, err := getYTAudioURL(videoURL)
		if err != nil {
			c.Status(404)
			return
		}
		c.Header("Content-Type", "audio/mp4")
		c.Header("Accept-Ranges", "bytes")
		c.Header("Cache-Control", CacheHeader)
		c.Status(200)
		c.Writer.Write([]byte(reqURL))
		return
	}

	reqURL, err := getYTAudioURL(videoURL)
	if err != nil {
		c.Status(404)
		return
	}

	c.Header("Content-Type", "audio/mp4")
	c.Header("Accept-Ranges", "bytes")
	c.Header("Cache-Control", CacheHeader)
	c.Status(200)

	go StartBackgroundDownload(videoURL, getYTAudioURL)

	resp, err := http.Get(reqURL)
	if err != nil {
		return
	}
	defer resp.Body.Close()

	buf := make([]byte, 32*1024)
	for {
		n, err := resp.Body.Read(buf)
		if n > 0 {
			c.Writer.Write(buf[:n])
			c.Writer.Flush()
		}
		if err != nil {
			break
		}
	}
}

func initializeYtStream(r *gin.Engine) {
	os.MkdirAll("cache", os.ModePerm)
	go StartCacheCleaner(5*time.Minute, int64(0.5*1024*1024*1024))
	r.GET("/stream/audio/youtube", ytStreamHandler)
	r.HEAD("/stream/audio/youtube", ytStreamHandler)
}

package main

import (
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

func getYTAudioURL(videoID string) (string, error) {
	if _, err := sanitizeYouTubeID(videoID); err != nil {
		return "", err
	}

	videoURL := "https://www.youtube.com/watch?v=" + videoID
	tempCookies := "/tmp/cookies.txt"

	if _, err := os.Stat("/etc/secrets/cookies.txt"); err == nil {
		exec.Command("cp", "/etc/secrets/cookies.txt", tempCookies).Run()
	}

	args := []string{
		"-f", "bestaudio[acodec=opus][abr<=160]/bestaudio[acodec=opus]/bestaudio",
		"--hls-prefer-native",
		"--get-url",
		videoURL,
	}

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

	return "", errors.New("no valid audio URL found")
}

func ytStreamHandler(c *gin.Context) {
	videoID := c.Query("id")
	if videoID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing video id"})
		return
	}

	if _, err := sanitizeYouTubeID(videoID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid video id"})
		return
	}

	cachePath, err := GetYouTubeCachePath(videoID)
	if err != nil {
		c.Status(http.StatusBadRequest)
		return
	}

	isGet := c.Request.Method == http.MethodGet

	if fi, err := os.Stat(cachePath); err == nil {
		if isGet {
			HandleRangeRequest(c, videoID, YouTube)
			return
		}
		c.Header("Content-Type", "audio/mp4")
		c.Header("Content-Length", fmt.Sprintf("%d", fi.Size()))
		c.Header("Accept-Ranges", "bytes")
		c.Header("Cache-Control", CacheHeader)
		c.Status(http.StatusOK)
		return
	}

	audioURL, err := getYTAudioURL(videoID)
	if err != nil {
		c.Status(http.StatusNotFound)
		return
	}

	c.Header("Content-Type", "audio/mp4")
	c.Header("Accept-Ranges", "bytes")
	c.Header("Cache-Control", CacheHeader)
	c.Status(http.StatusOK)

	if !isGet {
		c.Writer.Write([]byte(audioURL))
		return
	}

	go StartBackgroundDownload(videoID, getYTAudioURL)

	resp, err := http.Get(audioURL)
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

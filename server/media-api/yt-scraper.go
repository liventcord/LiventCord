package main

import (
	"context"
	"errors"
	"fmt"
	"io"
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
		"--no-playlist",
		"--no-warnings",
		"--skip-download",
		"--format-sort-force",
		"-f", "bestaudio[acodec=opus][abr<=160]/bestaudio",
		"--get-url",
		videoURL,
	}

	if _, err := os.Stat(tempCookies); err == nil {
		args = append([]string{"--cookies", tempCookies}, args...)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "yt-dlp", args...)

	stdout, _ := cmd.StdoutPipe()
	stderr, _ := cmd.StderrPipe()

	if err := cmd.Start(); err != nil {
		return "", err
	}

	outBytes, _ := io.ReadAll(stdout)
	errBytes, _ := io.ReadAll(stderr)

	err := cmd.Wait()

	if ctx.Err() == context.DeadlineExceeded {
		return "", fmt.Errorf("yt-dlp timeout after 20s, stderr: %s", string(errBytes))
	}

	if err != nil {
		return "", fmt.Errorf("yt-dlp error: %v, stderr: %s", err, string(errBytes))
	}

	for _, line := range strings.Split(strings.TrimSpace(string(outBytes)), "\n") {
		if strings.HasPrefix(line, "http://") || strings.HasPrefix(line, "https://") {
			return line, nil
		}
	}

	return "", errors.New("yt-dlp returned no url")
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

	if !isGet {
		c.Status(http.StatusNotFound)
		return
	}

	audioURL, err := getYTAudioURL(videoID)
	if err != nil {
		c.Error(err)
		c.Status(http.StatusBadGateway)
		return
	}

	c.Header("Content-Type", "audio/mp4")
	c.Header("Accept-Ranges", "bytes")
	c.Header("Cache-Control", CacheHeader)
	c.Status(http.StatusOK)

	go StartBackgroundDownload(videoID, getYTAudioURL)

	resp, err := http.Get(audioURL)
	if err != nil {
		c.Error(err)
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
			if err != io.EOF {
				c.Error(err)
			}
			break
		}
	}
}

func initializeYtStream(r *gin.Engine) {
	os.MkdirAll("cache", os.ModePerm)
	go StartCacheCleaner(5*time.Minute, int64(0.5*1024*1024*1024))
	r.GET("/stream/audio/youtube", ytStreamHandler)
	r.HEAD("/stream/audio/youtube", func(c *gin.Context) {
		videoID := c.Query("id")
		if videoID == "" {
			c.Status(http.StatusBadRequest)
			return
		}
		cachePath, err := GetYouTubeCachePath(videoID)
		if err != nil {
			c.Status(http.StatusNotFound)
			return
		}
		if fi, err := os.Stat(cachePath); err == nil {
			c.Header("Content-Length", fmt.Sprintf("%d", fi.Size()))
			c.Header("Accept-Ranges", "bytes")
			c.Header("Cache-Control", CacheHeader)
			c.Status(http.StatusOK)
			return
		}
		c.Status(http.StatusNotFound)
	})
}

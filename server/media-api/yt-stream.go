package main

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

const cacheHeader = "public, max-age=31536000, immutable"

type downloadStatus struct {
	inProgress bool
	mu         sync.Mutex
}

var downloadTracker = make(map[string]*downloadStatus)
var downloadMutex sync.Mutex

func getCachePath(videoURL string) string {
	hash := sha256.Sum256([]byte(videoURL))
	return filepath.Join("cache", hex.EncodeToString(hash[:])+".cache")
}

func getAudioStream(videoURL string) (string, error) {
	tempCookies := "/tmp/cookies.txt"

	if _, err := os.Stat("/etc/secrets/cookies.txt"); err == nil {
		exec.Command("cp", "/etc/secrets/cookies.txt", tempCookies).Run()
	}

	args := []string{
		"-f", "bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio",
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

	lines := strings.Split(strings.TrimSpace(string(output)), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "http://") || strings.HasPrefix(line, "https://") {
			return line, nil
		}
	}

	return "", fmt.Errorf("no valid URL found")
}

func downloadToCache(videoURL, cachePath string) error {
	audioURL, err := getAudioStream(videoURL)
	if err != nil {
		return err
	}

	client := &http.Client{Timeout: 30 * time.Minute}
	resp, err := client.Get(audioURL)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("upstream returned %d", resp.StatusCode)
	}

	tmpPath := cachePath + ".tmp"
	f, err := os.Create(tmpPath)
	if err != nil {
		return err
	}
	defer f.Close()

	if _, err := io.Copy(f, resp.Body); err != nil {
		os.Remove(tmpPath)
		return err
	}

	return os.Rename(tmpPath, cachePath)
}

func startBackgroundDownload(videoURL, cachePath string) {
	downloadMutex.Lock()
	status, exists := downloadTracker[videoURL]
	if !exists {
		status = &downloadStatus{}
		downloadTracker[videoURL] = status
	}
	downloadMutex.Unlock()

	status.mu.Lock()
	if status.inProgress {
		status.mu.Unlock()
		return
	}
	status.inProgress = true
	status.mu.Unlock()

	go func() {
		defer func() {
			status.mu.Lock()
			status.inProgress = false
			status.mu.Unlock()
		}()

		if err := downloadToCache(videoURL, cachePath); err != nil {
			log.Printf("Background download failed: %v", err)
		}
	}()
}

func proxyWithRangeSupport(c *gin.Context, videoURL string) {
	audioURL, err := getAudioStream(videoURL)
	if err != nil {
		c.Status(http.StatusBadGateway)
		return
	}

	req, err := http.NewRequest("GET", audioURL, nil)
	if err != nil {
		c.Status(http.StatusInternalServerError)
		return
	}

	if rangeHeader := c.GetHeader("Range"); rangeHeader != "" {
		req.Header.Set("Range", rangeHeader)
	}

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		c.Status(http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	for k, vals := range resp.Header {
		for _, v := range vals {
			c.Writer.Header().Add(k, v)
		}
	}
	c.Header("Cache-Control", cacheHeader)
	c.Status(resp.StatusCode)

	io.Copy(c.Writer, resp.Body)
}

func handleRangeRequest(c *gin.Context, cachePath string) {
	f, err := os.Open(cachePath)
	if err != nil {
		c.Status(http.StatusInternalServerError)
		return
	}
	defer f.Close()

	fi, err := f.Stat()
	if err != nil {
		c.Status(http.StatusInternalServerError)
		return
	}

	c.Header("Accept-Ranges", "bytes")
	c.Header("Cache-Control", cacheHeader)
	c.Header("Content-Type", "audio/mp4")

	rangeHeader := c.GetHeader("Range")
	if rangeHeader == "" {
		c.Header("Content-Length", fmt.Sprintf("%d", fi.Size()))
		c.Status(http.StatusOK)
		io.Copy(c.Writer, f)
		return
	}

	var start, end int64
	size := fi.Size()

	if n, _ := fmt.Sscanf(rangeHeader, "bytes=%d-%d", &start, &end); n < 2 {
		end = size - 1
	}

	if start < 0 || end >= size || start > end {
		c.Status(http.StatusRequestedRangeNotSatisfiable)
		return
	}

	f.Seek(start, 0)
	length := end - start + 1

	c.Header("Content-Range", fmt.Sprintf("bytes %d-%d/%d", start, end, size))
	c.Header("Content-Length", fmt.Sprintf("%d", length))
	c.Status(http.StatusPartialContent)

	io.CopyN(c.Writer, f, length)
}

func cleanCache(maxSize int64) {
	cacheDir := "cache"
	files, err := os.ReadDir(cacheDir)
	if err != nil {
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

func startCacheCleaner(interval time.Duration, maxSize int64) {
	ticker := time.NewTicker(interval)
	go func() {
		for range ticker.C {
			cleanCache(maxSize)
		}
	}()
}

func initializeYtStream(r *gin.Engine) {
	os.MkdirAll("cache", os.ModePerm)
	go startCacheCleaner(5*time.Minute, int64(0.5*1024*1024*1024))

	r.GET("/stream/audio", streamHandler)
	r.HEAD("/stream/audio", streamHandler)
}

func streamHandler(c *gin.Context) {
	videoURL := c.Query("url")
	if videoURL == "" || !strings.HasPrefix(videoURL, "http") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid or missing url parameter"})
		return
	}

	cachePath := getCachePath(videoURL)
	isGet := c.Request.Method == http.MethodGet

	if fi, err := os.Stat(cachePath); err == nil {
		if isGet {
			handleRangeRequest(c, cachePath)
			return
		}
		c.Header("Content-Type", "audio/mp4")
		c.Header("Content-Length", fmt.Sprintf("%d", fi.Size()))
		c.Header("Accept-Ranges", "bytes")
		c.Header("Cache-Control", cacheHeader)
		c.Status(http.StatusOK)
		return
	}

	audioURL, err := getAudioStream(videoURL)
	if err != nil {
		c.Status(http.StatusNotFound)
		return
	}

	if !isGet {
		req, err := http.NewRequest("GET", audioURL, nil)
		if err != nil {
			c.Status(http.StatusNotFound)
			return
		}
		req.Header.Set("Range", "bytes=0-0")

		client := &http.Client{Timeout: 10 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			c.Status(http.StatusNotFound)
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusPartialContent {
			c.Header("Content-Type", "audio/mp4")
			if contentLength := resp.Header.Get("Content-Length"); contentLength != "" {
				c.Header("Content-Length", contentLength)
			}
			if contentRange := resp.Header.Get("Content-Range"); contentRange != "" {
				var start, end, total int
				if _, err := fmt.Sscanf(contentRange, "bytes %d-%d/%d", &start, &end, &total); err == nil {
					c.Header("Content-Length", fmt.Sprintf("%d", total))
				}
			}
			c.Header("Accept-Ranges", "bytes")
			c.Header("Cache-Control", cacheHeader)
			c.Status(http.StatusOK)
			return
		}
		c.Status(http.StatusNotFound)
		return
	}

	startBackgroundDownload(videoURL, cachePath)
	proxyWithRangeSupport(c, videoURL)
}

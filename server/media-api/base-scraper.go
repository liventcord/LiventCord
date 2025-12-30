package main

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"
	"crypto/sha256"
	"github.com/gin-gonic/gin"
)

const CacheHeader = "public, max-age=31536000, immutable"

type DownloadStatus struct {
	InProgress bool
	Mu         sync.Mutex
}

var downloadTracker = make(map[string]*DownloadStatus)
var downloadMutex sync.Mutex

func GetCachePath(url string) string {
	hash := sha256Sum(url)
	return filepath.Join("cache", hash+".cache")
}

func sha256Sum(text string) string {
	h := sha256.Sum256([]byte(text))
	return fmt.Sprintf("%x", h[:])
}

func StartBackgroundDownload(url, cachePath string, downloader func(string) (string, error)) {
	downloadMutex.Lock()
	status, exists := downloadTracker[url]
	if !exists {
		status = &DownloadStatus{}
		downloadTracker[url] = status
	}
	downloadMutex.Unlock()

	status.Mu.Lock()
	if status.InProgress {
		status.Mu.Unlock()
		return
	}
	status.InProgress = true
	status.Mu.Unlock()

	go func() {
		defer func() {
			status.Mu.Lock()
			status.InProgress = false
			status.Mu.Unlock()
		}()

		if err := DownloadToCache(url, cachePath, downloader); err != nil {
			log.Printf("Background download failed: %v", err)
		}
	}()
}

func DownloadToCache(url, cachePath string, downloader func(string) (string, error)) error {
	audioURL, err := downloader(url)
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

func HandleRangeRequest(c *gin.Context, cachePath string) {
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
	c.Header("Cache-Control", CacheHeader)
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

func ProxyWithRangeSupport(c *gin.Context, url string, downloader func(string) (string, error)) {
	audioURL, err := downloader(url)
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
	c.Header("Cache-Control", CacheHeader)
	c.Status(resp.StatusCode)

	io.Copy(c.Writer, resp.Body)
}

func CleanCache(maxSize int64) {
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

func StartCacheCleaner(interval time.Duration, maxSize int64) {
	ticker := time.NewTicker(interval)
	go func() {
		for range ticker.C {
			CleanCache(maxSize)
		}
	}()
}

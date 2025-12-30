package main

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

func getSpotifyAudioURL(spotifyURL, cachePath string) error {
	debug := true
	if debug {
		fmt.Printf("[DEBUG] Preparing to download Spotify track: %s\n", spotifyURL)
	}

	tmpDir := filepath.Dir(cachePath)
	outputPattern := tmpDir
	args := []string{
		spotifyURL,
		"--output", outputPattern,
		"--format", "mp3",
		"--overwrite", "force",
	}

	if debug {
		fmt.Printf("[DEBUG] Running command: spotdl %s\n", strings.Join(args, " "))
	}

	cmd := exec.Command("spotdl", args...)
	output, err := cmd.CombinedOutput()
	if debug {
		fmt.Printf("[DEBUG] spotdl full output:\n%s\n", string(output))
	}

	if err != nil {
		return fmt.Errorf("spotdl command failed: %v\nOutput:\n%s", err, string(output))
	}

	var downloadedFile string
	err = filepath.Walk(tmpDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() && strings.HasSuffix(strings.ToLower(info.Name()), ".mp3") {
			downloadedFile = path
			return errors.New("found")
		}

		return nil
	})
	if err != nil {
		return fmt.Errorf("failed scanning output dir: %v", err)
	}

	if downloadedFile == "" {
		if debug {
			fmt.Println("[DEBUG] No downloaded file found. Output directory contents:")
			_ = filepath.Walk(tmpDir, func(path string, info os.FileInfo, err error) error {
				if err == nil {
					fmt.Println(" -", path)
				}
				return nil
			})
		}
		return fmt.Errorf("no downloaded file found in output dir")
	}

	if debug {
		fmt.Printf("[DEBUG] Renaming downloaded file: %s -> %s\n", downloadedFile, cachePath)
	}

	if err := os.Rename(downloadedFile, cachePath); err != nil {
		return fmt.Errorf("failed to move file to cache: %v", err)
	}

	if debug {
		fmt.Println("[DEBUG] Download and caching complete")
	}

	return nil
}

func spotifyStreamHandler(c *gin.Context) {
	trackID := c.Query("id")
	if trackID == "" {
		c.JSON(400, gin.H{"error": "Missing Spotify track id"})
		return
	}

	spotifyURL := fmt.Sprintf("https://open.spotify.com/track/%s", trackID)
	cachePath := filepath.Join("cache", trackID+".mp3")
	isGet := c.Request.Method == "GET"

	if _, err := os.Stat(cachePath); os.IsNotExist(err) {
		fmt.Printf("Cache miss for track %s, downloading...\n", trackID)
		if err := getSpotifyAudioURL(spotifyURL, cachePath); err != nil {
			fmt.Printf("Error downloading track: %v\n", err)
			c.Status(404)
			return
		}
	} else {
		fmt.Printf("Cache hit for track %s\n", trackID)
	}

	if isGet {
		HandleRangeRequest(c, cachePath)
		return
	}

	c.Header("Content-Type", "audio/mpeg")
	c.Header("Content-Length", fmt.Sprintf("%d", getFileSize(cachePath)))
	c.Header("Accept-Ranges", "bytes")
	c.Header("Cache-Control", CacheHeader)
	c.Status(200)
}

func initializeSpotifyStream(r *gin.Engine) {
	os.MkdirAll("cache", os.ModePerm)
	go StartCacheCleaner(5*time.Minute, int64(0.5*1024*1024*1024))
	r.GET("/stream/audio/spotify", spotifyStreamHandler)
	r.HEAD("/stream/audio/spotify", spotifyStreamHandler)
}

func getFileSize(path string) int64 {
	fi, err := os.Stat(path)
	if err != nil {
		return 0
	}
	return fi.Size()
}

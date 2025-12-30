package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

func ensureSpotifyScraper() error {
	venvPath := "venv"
	venvBin := filepath.Join(venvPath, "bin", "spotify-scraper")

	if _, err := os.Stat(venvBin); err == nil {
		return nil
	}

	fmt.Println("Setting up Python virtual environment and installing spotify-scraper...")

	pythonExec, err := exec.LookPath("python3")
	if err != nil {
		return fmt.Errorf("python3 is not installed")
	}

	cmd := exec.Command(pythonExec, "-m", "venv", venvPath)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to create venv: %v", err)
	}

	pipPath := filepath.Join(venvPath, "bin", "pip")
	cmd = exec.Command(pipPath, "install", "--upgrade", "pip")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to upgrade pip: %v", err)
	}

	cmd = exec.Command(pipPath, "install", "spotify-scraper")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to install spotify-scraper: %v", err)
	}

	return nil
}

func getSpotifyAudioURL(spotifyURL, cachePath string) error {
	if err := ensureSpotifyScraper(); err != nil {
		return err
	}

	tmpDir := filepath.Dir(cachePath)
	venvScraper := filepath.Join("venv", "bin", "spotify-scraper")
	args := []string{"download", "track", "--force", "-o", tmpDir, spotifyURL}

	cmd := exec.Command(venvScraper, args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("spotify-scraper failed: %v, output: %s", err, string(output))
	}

	files, err := os.ReadDir(tmpDir)
	if err != nil {
		return fmt.Errorf("failed to list temp dir: %v", err)
	}

	var mp3File string
	for _, f := range files {
		if !f.IsDir() && strings.HasSuffix(f.Name(), ".mp3") {
			mp3File = filepath.Join(tmpDir, f.Name())
			break
		}
	}

	if mp3File == "" {
		return fmt.Errorf("no mp3 file found in output dir")
	}

	os.Rename(mp3File, cachePath)
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
		if err := getSpotifyAudioURL(spotifyURL, cachePath); err != nil {
			c.Status(404)
			return
		}
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

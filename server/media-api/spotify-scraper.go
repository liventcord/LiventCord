package main

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

const (
	cacheDirectory = "cache"
	debugMode      = true
)

func validatePathInBase(targetPath, basePath string) (string, error) {
	absTarget, err := filepath.Abs(targetPath)
	if err != nil {
		return "", err
	}
	absBase, err := filepath.Abs(basePath)
	if err != nil {
		return "", err
	}
	if !strings.HasPrefix(absTarget, absBase+string(os.PathSeparator)) {
		return "", errors.New("path outside base directory")
	}
	return absTarget, nil
}

func logDebug(format string, args ...interface{}) {
	if debugMode {
		fmt.Printf("[DEBUG] "+format+"\n", args...)
	}
}

func ensureDirectory(path string) error {
	absPath, err := filepath.Abs(path)
	if err != nil {
		return err
	}
	return os.MkdirAll(absPath, 0755)
}

func findDownloadedMP3(directory string) (string, error) {
	var downloadedFile string

	err := filepath.WalkDir(directory, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		if d.IsDir() {
			return nil
		}

		validPath, err := validatePathInBase(path, directory)
		if err != nil {
			return nil
		}

		if strings.HasSuffix(strings.ToLower(d.Name()), ".mp3") {
			downloadedFile = validPath
			return errors.New("found")
		}

		return nil
	})

	if err != nil && err.Error() != "found" {
		return "", fmt.Errorf("failed scanning output dir: %v", err)
	}

	if downloadedFile == "" {
		logDebug("No downloaded file found. Output directory contents:")
		filepath.WalkDir(directory, func(path string, d fs.DirEntry, err error) error {
			if err == nil {
				logDebug(" - %s", path)
			}
			return nil
		})
		return "", errors.New("no downloaded file found in output dir")
	}

	return downloadedFile, nil
}

func executeSpotDL(spotifyURL, outputDir string) error {
	args := []string{
		spotifyURL,
		"--output", outputDir,
		"--format", "mp3",
		"--overwrite", "force",
	}

	logDebug("Running command: spotdl %s", strings.Join(args, " "))

	cmd := exec.Command("spotdl", args...)
	output, err := cmd.CombinedOutput()

	logDebug("spotdl full output:\n%s", string(output))

	if err != nil {
		return fmt.Errorf("spotdl command failed: %v\nOutput:\n%s", err, string(output))
	}

	return nil
}

func getSpotifyAudioURL(spotifyURL, cachePath string) error {
	logDebug("Preparing to download Spotify track: %s", spotifyURL)

	validCachePath, err := validatePathInBase(cachePath, cacheDirectory)
	if err != nil {
		return fmt.Errorf("invalid cache path: %v", err)
	}

	cacheDir := filepath.Dir(validCachePath)

	if err := ensureDirectory(cacheDir); err != nil {
		return err
	}

	if err := executeSpotDL(spotifyURL, cacheDir); err != nil {
		return err
	}

	downloadedFile, err := findDownloadedMP3(cacheDir)
	if err != nil {
		return err
	}

	logDebug("Renaming downloaded file: %s -> %s", downloadedFile, validCachePath)

	if err := os.Rename(downloadedFile, validCachePath); err != nil {
		return fmt.Errorf("failed to move file to cache: %v", err)
	}

	logDebug("Download and caching complete")

	return nil
}

func getFileSize(path string) int64 {
	validPath, err := validatePathInBase(path, cacheDirectory)
	if err != nil {
		return 0
	}

	fi, err := os.Stat(validPath)
	if err != nil {
		return 0
	}

	if fi.IsDir() {
		return 0
	}

	return fi.Size()
}

func downloadIfNeeded(spotifyURL, cachePath string) error {
	if _, err := os.Stat(cachePath); os.IsNotExist(err) {
		return getSpotifyAudioURL(spotifyURL, cachePath)
	}
	return nil
}

func setAudioHeaders(c *gin.Context, cachePath string) {
	c.Header("Content-Type", "audio/mpeg")
	c.Header("Content-Length", strconv.FormatInt(getFileSize(cachePath), 10))
	c.Header("Accept-Ranges", "bytes")
	c.Header("Cache-Control", CacheHeader)
}

func spotifyStreamHandler(c *gin.Context) {
	rawID := c.Query("id")
	if rawID == "" {
		c.JSON(400, gin.H{"error": "missing spotify track id"})
		return
	}

	trackID, err := sanitizeSpotifyID(rawID)
	if err != nil {
		c.JSON(400, gin.H{"error": "invalid track id"})
		return
	}

	cachePath, err := safeCachePath(trackID)
	if err != nil {
		c.JSON(400, gin.H{"error": "invalid path"})
		return
	}

	spotifyURL := "https://open.spotify.com/track/" + trackID

	if err := downloadIfNeeded(spotifyURL, cachePath); err != nil {
		c.Status(404)
		return
	}

	isGet := c.Request.Method == "GET"

	if isGet {
		HandleRangeRequest(c, cachePath, Spotify)
		return
	}

	setAudioHeaders(c, cachePath)
	c.Status(200)
}

func initializeSpotifyStream(r *gin.Engine) {
	if err := ensureDirectory(cacheDirectory); err != nil {
		fmt.Printf("Failed to create cache directory: %v\n", err)
		return
	}

	go StartCacheCleaner(5*time.Minute, int64(0.5*1024*1024*1024))

	r.GET("/stream/audio/spotify", spotifyStreamHandler)
	r.HEAD("/stream/audio/spotify", spotifyStreamHandler)
}

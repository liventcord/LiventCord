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

	run := func(args []string) (string, string, error) {
		if _, err := os.Stat(tempCookies); err == nil {
			args = append([]string{"--cookies", tempCookies}, args...)
		}

		ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
		defer cancel()

		cmd := exec.CommandContext(ctx, "yt-dlp", args...)
		stdout, _ := cmd.StdoutPipe()
		stderr, _ := cmd.StderrPipe()

		if err := cmd.Start(); err != nil {
			return "", "", err
		}

		outBytes, _ := io.ReadAll(stdout)
		errBytes, _ := io.ReadAll(stderr)
		err := cmd.Wait()

		if ctx.Err() == context.DeadlineExceeded {
			return "", string(errBytes), fmt.Errorf("yt-dlp timeout")
		}

		return string(outBytes), string(errBytes), err
	}

	tryArgs := []string{
		"--no-playlist",
		"--no-warnings",
		"--skip-download",
		"--format-sort-force",
		"-f", "bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio",
		"--get-url",
		videoURL,
	}

	out, errOut, err := run(tryArgs)
	if err == nil {
		for _, line := range strings.Split(strings.TrimSpace(out), "\n") {
			if strings.HasPrefix(line, "http") {
				return line, nil
			}
		}
	}

	if !strings.Contains(errOut, "Requested format is not available") {
		return "", fmt.Errorf("yt-dlp error: %v, stderr: %s", err, errOut)
	}

	listOut, _, err := run([]string{"--no-playlist", "--list-formats", videoURL})
	if err != nil {
		return "", err
	}

	bestFormat := ""
	bestScore := -1

	for _, line := range strings.Split(listOut, "\n") {
		fields := strings.Fields(line)
		if len(fields) < 6 {
			continue
		}

		formatID := fields[0]
		if !strings.Contains(line, "audio only") {
			continue
		}

		score := 0
		if strings.Contains(line, "m4a") {
			score += 100
		}
		if strings.Contains(line, "webm") {
			score += 50
		}

		for _, f := range fields {
			if strings.HasSuffix(f, "k") {
				v := strings.TrimSuffix(f, "k")
				if n, e := fmt.Sscanf(v, "%d", &score); n == 1 && e == nil {
					score += score
				}
			}
		}

		if score > bestScore {
			bestScore = score
			bestFormat = formatID
		}
	}

	if bestFormat == "" {
		return "", errors.New("no usable audio format found")
	}

	finalOut, finalErrOut, err := run([]string{
		"--no-playlist",
		"--no-warnings",
		"--skip-download",
		"-f", bestFormat,
		"--get-url",
		videoURL,
	})

	if err != nil {
		return "", fmt.Errorf("yt-dlp fallback error: %v, stderr: %s", err, finalErrOut)
	}

	for _, line := range strings.Split(strings.TrimSpace(finalOut), "\n") {
		if strings.HasPrefix(line, "http") {
			return line, nil
		}
	}

	return "", errors.New("yt-dlp fallback returned no url")
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

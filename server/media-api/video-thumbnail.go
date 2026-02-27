package main

import (
	"bytes"
	"crypto/sha256"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	ffmpeg "github.com/u2takey/ffmpeg-go"
)

var CacheDirectory = "./cache"
var CFMediaWorkerUrl string
var MainServerUrl string
var validID = regexp.MustCompile(`^[a-zA-Z0-9_-]+$`)

func init() {
	godotenv.Load()
	CFMediaWorkerUrl = os.Getenv("CloudflareMediaWorkerUrl")
	MainServerUrl = getEnv("MainServerUrl", "http://localhost:5005")
	if CFMediaWorkerUrl == "" {
		fmt.Println("CloudflareMediaWorkerUrl environment variable not set. will use main server: ", MainServerUrl)
	} else {
		fmt.Println("Will use server ", CFMediaWorkerUrl, " for fetching attachments")
	}
}

func GetVideoAttachmentPreview(c *gin.Context) {
	servedFilesSinceStartup++
	attachmentId := c.Param("attachmentId")

	if !isValidAttachmentId(attachmentId) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid attachmentId."})
		return
	}

	hash := sha256.Sum256([]byte(attachmentId))
	previewCacheFilePath := filepath.Join(CacheDirectory, fmt.Sprintf("%x_preview.webp", hash))

	data, err := getFileFromCacheOrDatabase(previewCacheFilePath, func() ([]byte, error) {
		videoBytes, contentType, fileName, err := fetchAttachmentFromWorker(attachmentId)
		if err != nil {
			return nil, err
		}

		if fileName == "" {
			return nil, errors.New("file name is missing")
		}

		if !isVideoContent(contentType) && !isVideoContent(fileName) {
			return nil, errors.New("file is not a video")
		}

		thumbnailBytes, err := generateVideoThumbnail(videoBytes)
		if err != nil {
			return nil, errors.New("failed to generate thumbnail: " + err.Error())
		}

		return thumbnailBytes, nil
	})

	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			c.JSON(http.StatusNotFound, gin.H{"error": "file not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Data(http.StatusOK, "image/webp", data)
}

func fetchAttachmentFromWorker(attachmentId string) ([]byte, string, string, error) {
	baseURL := CFMediaWorkerUrl
	if baseURL == "" {
		baseURL = MainServerUrl
	}

	url := fmt.Sprintf("%s/attachments/%s", strings.TrimRight(baseURL, "/"), attachmentId)

	client := &http.Client{
		Timeout: 30 * time.Second,
	}

	resp, err := client.Get(url)
	if err != nil {
		return nil, "", "", errors.New("failed to fetch attachment: " + err.Error())
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, "", "", errors.New("file not found")
	}

	if resp.StatusCode != http.StatusOK {
		return nil, "", "", errors.New("failed to fetch attachment: status " + resp.Status)
	}

	videoBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, "", "", errors.New("failed to read attachment: " + err.Error())
	}

	contentType := resp.Header.Get("Content-Type")
	fileName := resp.Header.Get("Content-Disposition")

	if fileName != "" {
		if strings.Contains(fileName, "filename=") {
			parts := strings.Split(fileName, "filename=")
			if len(parts) > 1 {
				fileName = strings.Trim(parts[1], "\"")
			}
		}
	}

	return videoBytes, contentType, fileName, nil
}

func isValidAttachmentId(id string) bool {
	return validID.MatchString(id)
}

func getFileFromCacheOrDatabase(cachePath string, fetchFunc func() ([]byte, error)) ([]byte, error) {
	if data, err := os.ReadFile(cachePath); err == nil {
		return data, nil
	}

	data, err := fetchFunc()
	if err != nil {
		return nil, err
	}

	if err := os.MkdirAll(CacheDirectory, os.ModePerm); err != nil {
		return nil, err
	}

	if err := os.WriteFile(cachePath, data, 0644); err != nil {
		return nil, err
	}

	return data, nil
}

func isVideoContent(contentTypeOrFileName string) bool {
	videoExtensions := []string{".mp4", ".webm", ".ogg", ".avi", ".mov", ".wmv", ".flv", ".mkv", ".3gp", ".quicktime"}
	videoMimeTypes := []string{"video/mp4", "video/webm", "video/ogg", "video/avi", "video/quicktime", "video/x-msvideo", "video/x-ms-wmv", "video/x-flv", "video/x-matroska", "video/3gpp"}

	lower := strings.ToLower(contentTypeOrFileName)

	for _, mimeType := range videoMimeTypes {
		if strings.Contains(lower, mimeType) {
			return true
		}
	}

	for _, ext := range videoExtensions {
		if strings.HasSuffix(lower, ext) {
			return true
		}
	}

	return false
}

func generateVideoThumbnail(videoBytes []byte) ([]byte, error) {
	tmpFile, err := os.CreateTemp("", "video-*")
	if err != nil {
		return nil, err
	}
	defer os.Remove(tmpFile.Name())
	if _, err := tmpFile.Write(videoBytes); err != nil {
		return nil, err
	}
	tmpFile.Close()

	outBuf := &bytes.Buffer{}
	err = ffmpeg.Input(tmpFile.Name()).
		Output("pipe:1", ffmpeg.KwArgs{
			"vframes":           "1",
			"format":            "webp",
			"lossless":          "0",
			"compression_level": "4",
		}).
		WithOutput(outBuf).
		Run()
	if err != nil {
		return nil, err
	}

	return outBuf.Bytes(), nil
}

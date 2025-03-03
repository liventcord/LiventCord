package main

import (
	"io"
	"log"
	"net/http"
	"os/exec"
	"strings"

	"github.com/gin-gonic/gin"
)

func getAudioStream(videoID string) (string, error) {
	cmd := exec.Command("yt-dlp", "-f", "bestaudio[ext=m4a]", "--get-url", "https://www.youtube.com/watch?v="+videoID)
	output, err := cmd.Output()
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(output)), nil
}

func main() {
	router := gin.Default()

	router.GET("/stream/audio/:videoID", func(c *gin.Context) {
		videoID := c.Param("videoID")

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to retrieve audio stream: %v", err)})
			return
		}
		
		resp, err := http.Get(audioURL)
		log.Println(videoID);
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch audio stream"})
			return
		}
		defer resp.Body.Close()

		c.Header("Content-Type", "audio/mp4")
		c.Header("Transfer-Encoding", "chunked")

		_, err = io.Copy(c.Writer, resp.Body)
		if err != nil {
			log.Println("Error streaming audio:", err)
		}
	})

	log.Println("Server running on :8080")
	router.Run(":8080")
}


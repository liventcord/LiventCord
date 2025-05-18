package main

import (
	"bytes"
	"crypto/md5"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"image"
	"net/http"
	"os"
	"strings"
	"time"
)

const blacklistDurationHours = 1

func generateETag(filePath string) string {
	b, _ := os.ReadFile(filePath)
	h := md5.Sum(b)
	return base64.StdEncoding.EncodeToString(h[:])
}

func isRedirect(status int) bool {
	return status == http.StatusFound ||
		status == http.StatusMovedPermanently ||
		status == http.StatusSeeOther ||
		status == http.StatusTemporaryRedirect ||
		status == http.StatusPermanentRedirect
}

func getFileName(resp *http.Response, url string) string {
	cd := resp.Header.Get("Content-Disposition")
	if cd != "" {
		if strings.Contains(cd, "filename=") {
			parts := strings.Split(cd, "filename=")
			return strings.Trim(parts[1], "\" ")
		}
	}
	u := strings.Split(url, "/")
	return u[len(u)-1]
}
func parseUrl(url string) (string, string) {
	u, _ := http.NewRequest("GET", url, nil)
	domain := u.URL.Scheme + "://" + u.URL.Host
	routePath := strings.ToLower(u.URL.Path)
	return domain, routePath
}

func sendMediaUrlsToMainServer(mainServerUrl string, mediaUrl MediaUrl) error {
	if mainServerUrl == "" {
		return nil
	}
	b, _ := json.Marshal(mediaUrl)
	_, err := http.Post(mainServerUrl+"/api/media", "application/json", bytes.NewReader(b))
	return err
}

func sendHtmlToMainServer(mainServerUrl, url, htmlStr string) error {
	if mainServerUrl == "" {
		return nil
	}
	meta := extractMetadataFromHtml(url, htmlStr)
	b, _ := json.Marshal(meta)
	resp, err := http.Post(mainServerUrl+"/api/metadata", "application/json", bytes.NewReader(b))
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode == 403 {
		return nil
	}
	return nil
}

func humanReadableBytes(bytes uint64) string {
	const (
		KB = 1024
		MB = KB * 1024
		GB = MB * 1024
	)

	switch {
	case bytes >= GB:
		return fmt.Sprintf("%.2f GB", float64(bytes)/float64(GB))
	case bytes >= MB:
		return fmt.Sprintf("%.2f MB", float64(bytes)/float64(MB))
	case bytes >= KB:
		return fmt.Sprintf("%.2f KB", float64(bytes)/float64(KB))
	default:
		return fmt.Sprintf("%d B", bytes)
	}
}
func humanReadableDuration(d time.Duration) string {
	hours := int(d.Hours())
	minutes := int(d.Minutes()) % 60

	if hours >= 24 {
		days := hours / 24
		hours = hours % 24
		return fmt.Sprintf("%dd %dh", days, hours)
	}
	return fmt.Sprintf("%dh %dm", hours, minutes)
}

// Blacklist
func (c *MediaProxyController) addToBlacklist(url string) {
	c.blacklistLock.Lock()
	defer c.blacklistLock.Unlock()
	c.blacklistedUrls[url] = time.Now()
	_ = c.saveBlacklist()
}

func (c *MediaProxyController) loadBlacklistedUrls() {
	b, err := os.ReadFile(c.blacklistPath)
	if err == nil {
		temp := make(map[string]string)
		if err := json.Unmarshal(b, &temp); err == nil {
			for url, tStr := range temp {
				if t, err := time.Parse(time.RFC3339, tStr); err == nil {
					c.blacklistedUrls[url] = t
				}
			}
		}
	}
}

func (c *MediaProxyController) saveBlacklist() error {
	temp := make(map[string]string)
	for url, t := range c.blacklistedUrls {
		temp[url] = t.Format(time.RFC3339)
	}
	b, err := json.MarshalIndent(temp, "", "  ")
	if err == nil {
		return os.WriteFile(c.blacklistPath, b, 0644)
	}
	return err
}
func (c *MediaProxyController) isUrlBlacklisted(url string) bool {
	c.blacklistLock.Lock()
	defer c.blacklistLock.Unlock()
	blacklistTime, ok := c.blacklistedUrls[url]
	if !ok {
		return false
	}

	if time.Since(blacklistTime) > time.Duration(blacklistDurationHours)*time.Hour {
		delete(c.blacklistedUrls, url)
		_ = c.saveBlacklist()
		return false
	}
	return true
}

func getImageDimension(path string, width bool) int {
	f, err := os.Open(path)
	if err != nil {
		return 0
	}
	defer f.Close()
	img, _, err := image.DecodeConfig(f)
	if err != nil {
		return 0
	}
	if width {
		return img.Width
	}
	return img.Height
}

func firstNonEmpty(a, b string) string {
	if a != "" {
		return a
	}
	return b
}

func getCurrentDir() string {
	d, _ := os.Getwd()
	return d
}

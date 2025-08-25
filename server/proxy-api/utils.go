package main

import (
	"bytes"
	"crypto/md5"
	"encoding/base64"
	"encoding/json"
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

func postWithAuth(url string, body []byte) error {
	req, err := http.NewRequest("POST", url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", os.Getenv("AdminPassword"))

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode == 403 {
		return nil
	}
	return nil
}

func sendMediaUrlsToMainServer(mainServerUrl string, mediaUrl MediaUrl) error {
	if mainServerUrl == "" {
		return nil
	}
	b, _ := json.Marshal(mediaUrl)
	return postWithAuth(mainServerUrl+"/api/media", b)
}

func sendHtmlToMainServer(mainServerUrl, url, htmlStr string) error {
	if mainServerUrl == "" {
		return nil
	}
	meta := extractMetadataFromHtml(url, htmlStr)
	b, _ := json.Marshal(meta)
	return postWithAuth(mainServerUrl+"/api/metadata", b)
}

// Blacklist
func (c *MediaProxyController) addToBlacklist(url string) {
	c.blacklistLock.Lock()
	defer c.blacklistLock.Unlock()
	c.blacklistedUrls[url] = time.Now()
	_ = c.saveBlacklist()
}

func (c *MediaProxyController) loadBlacklistedUrls() {
	add_to_blacklist(c.blacklistedUrlsEnv)
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

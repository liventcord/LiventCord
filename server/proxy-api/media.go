package main

import (
	"crypto/md5"
	"encoding/base64"
	"errors"
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

func NewMediaProxyController(settings *MediaCacheSettings) *MediaProxyController {
	blacklistPath := filepath.Join(settings.CacheDirectory, "blacklisted_urls.json")
	c := &MediaProxyController{
		httpClient: &http.Client{
			Timeout: time.Minute,
		},
		cacheDirectory:  settings.CacheDirectory,
		storageLimit:    settings.StorageLimitBytes,
		blacklistPath:   blacklistPath,
		mainServerUrl:   settings.MainServerUrl,
		blacklistedUrls: make(map[string]time.Time),
	}
	c.initHttpClient()
	c.loadBlacklistedUrls()
	return c
}

func (c *MediaProxyController) initHttpClient() {
	c.httpClient.Transport = &http.Transport{
		Proxy: http.ProxyFromEnvironment,
	}
}

func (c *MediaProxyController) GetMedia(ctx *gin.Context) {
	url := ctx.Query("url")
	if url == "" {
		ctx.String(http.StatusBadRequest, "URL parameter is required.")
		return
	}
	if c.isUrlBlacklisted(url) {
		ctx.String(http.StatusBadRequest, "URL is blacklisted.")
		return
	}

	filePath := c.getCacheFilePath(url)

	if _, err := os.Stat(filePath); err == nil {
		c.handleFileResponse(ctx, filePath)
		return
	}

	ch := make(chan error, 1)
	_, loaded := c.downloadTasks.LoadOrStore(filePath, ch)
	if !loaded {
		go func() {
			defer c.downloadTasks.Delete(filePath)
			err := c.downloadFile(url, filePath)
			ch <- err
			close(ch)
		}()
	}

	err := <-ch
	if err != nil {
		ctx.String(http.StatusBadGateway, "Download failed.")
		return
	}
	if _, err := os.Stat(filePath); err == nil {
		c.handleFileResponse(ctx, filePath)
	} else {
		ctx.String(http.StatusBadGateway, "File missing after download.")
	}
}

func (c *MediaProxyController) handleFileResponse(ctx *gin.Context, filePath string) {
	ctx.Header("Access-Control-Allow-Origin", "*")
	ctx.Header("Access-Control-Allow-Methods", "GET, OPTIONS")
	ctx.Header("Access-Control-Allow-Headers", "Range, If-None-Match, Content-Type")

	if ctx.Request.Method == "OPTIONS" {
		ctx.Status(204)
		return
	}

	fileInfo, _ := os.Stat(filePath)
	lastModified := fileInfo.ModTime().UTC().Format(http.TimeFormat)
	etag := generateETag(filePath)
	ctx.Header("Cache-Control", "public, max-age=31536000")
	ctx.Header("Last-Modified", lastModified)
	ctx.Header("ETag", etag)
	if ctx.GetHeader("If-None-Match") == etag {
		ctx.Status(304)
		return
	}
	rangeHeader := ctx.GetHeader("Range")
	if rangeHeader != "" {
		c.handleRangeRequest(ctx, filePath)
		return
	}
	mType := mime.TypeByExtension(filepath.Ext(filePath))
	if mType == "" {
		mType = "application/octet-stream"
	}
	ctx.FileAttachment(filePath, filepath.Base(filePath))
}

func (c *MediaProxyController) handleRangeRequest(ctx *gin.Context, filePath string) {
	ctx.Header("Access-Control-Allow-Origin", "*")
	ctx.Header("Access-Control-Allow-Methods", "GET, OPTIONS")
	ctx.Header("Access-Control-Allow-Headers", "Range, If-None-Match, Content-Type")

	if ctx.Request.Method == "OPTIONS" {
		ctx.Status(204)
		return
	}

	fileInfo, _ := os.Stat(filePath)
	fileLength := fileInfo.Size()
	rangeHeader := ctx.GetHeader("Range")
	re := regexp.MustCompile(`bytes=(\d+)-(\d*)`)
	matches := re.FindStringSubmatch(rangeHeader)
	if len(matches) < 2 {
		ctx.String(416, "Invalid Range")
		return
	}
	start, _ := strconv.ParseInt(matches[1], 10, 64)
	end := fileLength - 1
	if matches[2] != "" {
		end, _ = strconv.ParseInt(matches[2], 10, 64)
	}
	if start >= fileLength || end >= fileLength {
		ctx.Status(416)
		return
	}
	contentLength := end - start + 1
	contentRange := "bytes " + strconv.FormatInt(start, 10) + "-" + strconv.FormatInt(end, 10) + "/" + strconv.FormatInt(fileLength, 10)
	ctx.Status(206)
	ctx.Header("Content-Range", contentRange)
	ctx.Header("Content-Length", strconv.FormatInt(contentLength, 10))
	f, _ := os.Open(filePath)
	defer f.Close()
	f.Seek(start, 0)
	io.CopyN(ctx.Writer, f, contentLength)
}

func (c *MediaProxyController) saveResponseToFile(r *http.Response, filePath string) error {
	tmpPath := filePath + ".tmp"
	f, err := os.Create(tmpPath)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = io.Copy(f, r.Body)
	if err != nil {
		return err
	}
	f.Close()
	return os.Rename(tmpPath, filePath)
}

func (c *MediaProxyController) enforceStorageLimit() {
	files, err := os.ReadDir(c.cacheDirectory)
	if err != nil {
		return
	}

	type fileInfo struct {
		entry os.DirEntry
		info  os.FileInfo
	}

	var regularFiles []fileInfo

	for _, file := range files {
		if file.Name() == "blacklisted_urls.json" || file.IsDir() {
			continue
		}
		info, err := file.Info()
		if err != nil {
			continue
		}
		regularFiles = append(regularFiles, fileInfo{file, info})
	}

	sort.Slice(regularFiles, func(i, j int) bool {
		return regularFiles[i].info.ModTime().Before(regularFiles[j].info.ModTime())
	})

	var total int64
	for _, f := range regularFiles {
		total += f.info.Size()
	}

	for total > c.storageLimit && len(regularFiles) > 0 {
		oldest := regularFiles[0]
		total -= oldest.info.Size()
		os.Remove(filepath.Join(c.cacheDirectory, oldest.entry.Name()))
		regularFiles = regularFiles[1:]
	}
}

func (c *MediaProxyController) getCacheFilePath(url string) string {
	h := md5.Sum([]byte(url))
	encoded := base64.RawURLEncoding.EncodeToString(h[:])
	return filepath.Join(c.cacheDirectory, strings.ToLower(encoded))
}

func (c *MediaProxyController) downloadFile(url, filePath string) error {
	const maxRedirects = 5
	redirects := 0
	println("Starting download:", url)
	for redirects < maxRedirects {
		req, _ := http.NewRequest("GET", url, nil)
		resp, err := c.httpClient.Do(req)
		if err != nil {
			println("Download error for", url, ":", err.Error())
			c.addToBlacklist(url)
			return err
		}
		defer resp.Body.Close()

		if isRedirect(resp.StatusCode) {
			newUrl := resp.Header.Get("Location")
			if newUrl == "" {
				println("Download error for", url, ": empty redirect URL")
				c.addToBlacklist(url)
				return errors.New("empty redirect URL")
			}
			if c.isUrlBlacklisted(newUrl) {
				println("Download error for", url, ": redirect URL is blacklisted:", newUrl)
				return errors.New("redirect URL is blacklisted")
			}
			url = newUrl
			println("Redirecting to:", url)
			redirects++
			continue
		}

		contentType := resp.Header.Get("Content-Type")
		if strings.Contains(contentType, "text/html") {
			body, _ := io.ReadAll(resp.Body)
			_ = sendHtmlToMainServer(c.mainServerUrl, url, string(body))
			println("Downloaded HTML content from:", url)
			return nil
		}

		if !c.isValidMediaContentType(contentType) {
			println("Download error for", url, ": invalid media type:", contentType)
			c.addToBlacklist(url)
			return errors.New("invalid media type: " + contentType)
		}

		c.enforceStorageLimit()

		err = c.saveResponseToFile(resp, filePath)
		if err != nil {
			println("Download error saving file for", url, ":", err.Error())
			c.addToBlacklist(url)
			return err
		}

		println("Successfully downloaded:", url)
		mediaUrl := MediaUrl{
			Url:      url,
			IsImage:  strings.HasPrefix(contentType, "image/"),
			IsVideo:  strings.HasPrefix(contentType, "video/"),
			FileSize: resp.ContentLength,
			Width:    getImageDimension(filePath, true),
			Height:   getImageDimension(filePath, false),
			FileName: getFileName(resp, url),
		}
		_ = sendMediaUrlsToMainServer(c.mainServerUrl, mediaUrl)
		return nil
	}
	println("Download error for", url, ": Too many redirects")
	c.addToBlacklist(url)
	return errors.New("Too many redirects")
}

func (c *MediaProxyController) isValidMediaContentType(contentType string) bool {
	ct := strings.ToLower(contentType)
	if ct == "" {
		return false
	}
	if strings.HasPrefix(ct, "text/") ||
		ct == "application/json" ||
		ct == "application/xml" ||
		ct == "application/javascript" {
		return false
	}
	if strings.HasPrefix(ct, "image/") ||
		strings.HasPrefix(ct, "video/") ||
		strings.HasPrefix(ct, "audio/") {
		return true
	}
	return false
}

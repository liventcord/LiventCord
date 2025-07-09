package main

import (
	"crypto/md5"
	"encoding/base64"
	"errors"
	"io"
	"mime"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

const (
	MaxFileSizeBytes       = 50 * 1024 * 1024
	MaxConcurrentDownloads = 5
)

var downloadSemaphore = make(chan struct{}, MaxConcurrentDownloads)

func NewMediaProxyController(settings *MediaCacheSettings) *MediaProxyController {
	blacklistPath := filepath.Join(settings.CacheDirectory, "blacklisted_urls.json")
	blacklistedUrlsEnv := os.Getenv("AddToBlacklist")
	c := &MediaProxyController{
		httpClient: &http.Client{
			Timeout: time.Minute,
		},
		cacheDirectory:     settings.CacheDirectory,
		storageLimit:       settings.StorageLimitBytes,
		blacklistPath:      blacklistPath,
		blacklistedUrlsEnv: blacklistedUrlsEnv,
		mainServerUrl:      settings.MainServerUrl,
		blacklistedUrls:    make(map[string]time.Time),
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

func isAllowedHTTPS(rawurl string) bool {
	parsed, err := url.Parse(rawurl)
	if err != nil {
		return false
	}

	if strings.ToLower(parsed.Scheme) != "https" {
		return false
	}

	host := parsed.Hostname()

	ip := net.ParseIP(host)
	if ip != nil {
		if ip.IsLoopback() || ip.IsPrivate() {
			return false
		}
		return true
	}

	ips, err := net.LookupIP(host)
	if err != nil {
		return false
	}

	for _, resolvedIP := range ips {
		if resolvedIP.IsLoopback() || resolvedIP.IsPrivate() {
			return false
		}
	}

	return true
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

	mType := mime.TypeByExtension(filepath.Ext(filePath))
	if mType == "" {
		mType = "application/octet-stream"
	}

	ctx.Status(206)
	ctx.Header("Content-Range", contentRange)
	ctx.Header("Content-Length", strconv.FormatInt(contentLength, 10))
	ctx.Header("Content-Type", mType)

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

func (c *MediaProxyController) GetMedia(ctx *gin.Context) {
	url := strings.TrimSpace(ctx.Query("url"))
	url = strings.Trim(url, `"`)

	if !isAllowedHTTPS(url) {
		ctx.String(http.StatusBadRequest, "URL rejected")
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
			downloadSemaphore <- struct{}{}
			defer func() { <-downloadSemaphore }()

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

// ---- Download logic ----

func (c *MediaProxyController) downloadFile(url, filePath string) error {
	if !isAllowedHTTPS(url) {
		return errors.New("URL is not allowed")
	}

	const maxRedirects = 5
	redirects := 0
	for redirects < maxRedirects {
		req, _ := http.NewRequest("GET", url, nil)
		resp, err := c.httpClient.Do(req)
		if err != nil {
			c.addToBlacklist(url)
			return err
		}
		defer resp.Body.Close()

		if isRedirect(resp.StatusCode) {
			newUrl := resp.Header.Get("Location")
			if newUrl == "" || c.isUrlBlacklisted(newUrl) {
				c.addToBlacklist(url)
				return errors.New("invalid or blacklisted redirect")
			}
			url = newUrl
			redirects++
			continue
		}

		contentType := resp.Header.Get("Content-Type")
		if strings.Contains(contentType, "text/html") {
			body, _ := io.ReadAll(io.LimitReader(resp.Body, 1000*1024)) // Limit to 100 KB
			_ = sendHtmlToMainServer(c.mainServerUrl, url, string(body))
			return nil
		}

		if !c.isValidMediaContentType(contentType) {
			c.addToBlacklist(url)
			return errors.New("invalid media type: " + contentType)
		}

		if resp.ContentLength > MaxFileSizeBytes {
			c.addToBlacklist(url)
			return errors.New("file too large")
		}

		err = c.saveLimitedResponseToFile(io.LimitReader(resp.Body, MaxFileSizeBytes+1), filePath)
		if err != nil {
			c.addToBlacklist(url)
			return err
		}

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
	c.addToBlacklist(url)
	return errors.New("too many redirects")
}
func (c *MediaProxyController) saveLimitedResponseToFile(reader io.Reader, filePath string) error {
	out, err := os.Create(filePath)
	if err != nil {
		return err
	}
	defer out.Close()

	written, err := io.Copy(out, reader)
	if err != nil {
		return err
	}
	if written > MaxFileSizeBytes {
		return errors.New("file exceeds allowed size")
	}
	return nil
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

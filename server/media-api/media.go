package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	"mime"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

const (
	MaxFileSizeBytes       = 50 * 1024 * 1024
	MaxConcurrentDownloads = 5
	MaxRedirects           = 10
)

var downloadSemaphore = make(chan struct{}, MaxConcurrentDownloads)

func NewMediaProxyController(settings *MediaCacheSettings) *MediaProxyController {
	c := &MediaProxyController{
		httpClient: &http.Client{
			Timeout: time.Minute,
			CheckRedirect: func(req *http.Request, via []*http.Request) error {
				return http.ErrUseLastResponse
			},
		},
		cacheDirectory:     settings.CacheDirectory,
		storageLimit:       settings.StorageLimitBytes,
		blacklistPath:      filepath.Join(settings.CacheDirectory, "blacklisted_urls.json"),
		blacklistedUrlsEnv: os.Getenv("AddToBlacklist"),
		mainServerUrl:      settings.MainServerUrl,
		blacklistedUrls:    make(map[string]time.Time),
	}

	c.initHttpClient()
	c.loadBlacklistedUrls()
	c.enforceStorageLimit()

	return c
}

func (c *MediaProxyController) initHttpClient() {
	c.httpClient.Transport = &http.Transport{
		Proxy:                 http.ProxyFromEnvironment,
		MaxIdleConns:          100,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   10 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
		DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
			host, port, err := net.SplitHostPort(addr)
			if err != nil {
				return nil, err
			}

			if ip := net.ParseIP(host); ip != nil && !isSafeIP(ip) {
				return nil, fmt.Errorf("blocked unsafe IP: %s", ip.String())
			}

			return (&net.Dialer{}).DialContext(ctx, network, net.JoinHostPort(host, port))
		},
	}
}

func isAllowedHTTPS(rawurl string) bool {
	parsed, err := url.Parse(rawurl)
	if err != nil || strings.ToLower(parsed.Scheme) != "https" {
		return false
	}

	host := parsed.Hostname()
	if host == "" || strings.HasPrefix(host, "xn--") {
		return false
	}

	if ip := net.ParseIP(host); ip != nil {
		return isSafeIP(ip)
	}

	return true
}

func isSafeIP(ip net.IP) bool {
	return !ip.IsLoopback() &&
		!ip.IsPrivate() &&
		!ip.IsLinkLocalUnicast() &&
		!ip.IsLinkLocalMulticast() &&
		!ip.IsMulticast() &&
		!(ip.To16() != nil && ip.To4() == nil && ip[0]&0xfe == 0xfc)
}

func (c *MediaProxyController) handleFileResponse(ctx *gin.Context, filePath string) {
	fileInfo, err := os.Stat(filePath)
	if err != nil {
		ctx.String(http.StatusNotFound, "File not found")
		return
	}

	ctx.Header("Access-Control-Allow-Origin", "*")
	ctx.Header("Cache-Control", "public, max-age=31536000")
	ctx.Header("Last-Modified", fileInfo.ModTime().UTC().Format(http.TimeFormat))

	etag := generateETag(filePath)
	ctx.Header("ETag", etag)

	if ctx.GetHeader("If-None-Match") == etag {
		ctx.Status(304)
		return
	}

	if rangeHeader := ctx.GetHeader("Range"); rangeHeader != "" {
		c.handleRangeRequest(ctx, filePath, fileInfo)
		return
	}

	mType := mime.TypeByExtension(filepath.Ext(filePath))
	if mType == "" {
		mType = "application/octet-stream"
	}

	ctx.Header("Content-Type", mType)
	ctx.File(filePath)
}

func (c *MediaProxyController) handleRangeRequest(ctx *gin.Context, filePath string, fileInfo os.FileInfo) {
	fileLength := fileInfo.Size()
	rangeHeader := ctx.GetHeader("Range")

	re := regexp.MustCompile(`bytes=(\d+)-(\d*)`)
	matches := re.FindStringSubmatch(rangeHeader)
	if len(matches) < 2 {
		ctx.Status(416)
		return
	}

	start, _ := strconv.ParseInt(matches[1], 10, 64)
	end := fileLength - 1

	if matches[2] != "" {
		if parsedEnd, err := strconv.ParseInt(matches[2], 10, 64); err == nil {
			end = parsedEnd
		}
	}

	if start >= fileLength || end >= fileLength || start > end {
		ctx.Status(416)
		return
	}

	contentLength := end - start + 1
	mType := mime.TypeByExtension(filepath.Ext(filePath))
	if mType == "" {
		mType = "application/octet-stream"
	}

	ctx.Status(206)
	ctx.Header("Content-Range", fmt.Sprintf("bytes %d-%d/%d", start, end, fileLength))
	ctx.Header("Content-Length", strconv.FormatInt(contentLength, 10))
	ctx.Header("Content-Type", mType)

	f, err := os.Open(filePath)
	if err != nil {
		return
	}
	defer f.Close()

	f.Seek(start, 0)
	io.CopyN(ctx.Writer, f, contentLength)
}

func (c *MediaProxyController) GetMedia(ctx *gin.Context) {
	urlStr := strings.TrimSpace(strings.Trim(ctx.Query("url"), `"`))

	if err := validateURL(urlStr); err != nil {
		ctx.String(http.StatusBadRequest, "Invalid URL: "+err.Error())
		return
	}

	if c.isUrlBlacklisted(urlStr) {
		ctx.String(http.StatusBadRequest, "URL blacklisted")
		return
	}

	filePath := c.getCacheFilePath(urlStr)

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

			resp, finalURL, err := c.fetchWithRedirects(urlStr, MaxRedirects)
			if err != nil {
				ch <- err
				close(ch)
				return
			}
			defer resp.Body.Close()

			_, err = c.handleMediaResponse(resp, finalURL, filePath)
			ch <- err
			close(ch)
		}()
	}

	if err := <-ch; err != nil {
		ctx.String(http.StatusBadGateway, "Download failed: "+err.Error())
		return
	}

	c.handleFileResponse(ctx, filePath)
}

func (c *MediaProxyController) handleMediaResponse(resp *http.Response, urlStr, filePath string) (*MediaUrl, error) {
	contentType := resp.Header.Get("Content-Type")

	if strings.Contains(contentType, "text/html") {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 1000*1024))
		sendHtmlToMainServer(c.mainServerUrl, urlStr, string(body))
		return nil, nil
	}

	if !c.isValidMediaContentType(contentType, resp.Header) {
		return nil, fmt.Errorf("invalid media type: %s", contentType)
	}

	if resp.ContentLength > MaxFileSizeBytes {
		return nil, errors.New("file too large")
	}

	if err := c.saveLimitedResponseToFile(io.LimitReader(resp.Body, MaxFileSizeBytes+1), filePath); err != nil {
		return nil, err
	}

	mediaUrl := &MediaUrl{
		Url:      urlStr,
		IsImage:  strings.HasPrefix(contentType, "image/"),
		IsVideo:  strings.HasPrefix(contentType, "video/"),
		FileSize: resp.ContentLength,
		Width:    getImageDimension(filePath, true),
		Height:   getImageDimension(filePath, false),
		FileName: getFileName(resp, urlStr),
	}

	sendMediaUrlsToMainServer(c.mainServerUrl, *mediaUrl)
	return mediaUrl, nil
}

func (c *MediaProxyController) saveLimitedResponseToFile(reader io.Reader, filePath string) error {
	tmpPath := filePath + ".tmp"
	out, err := os.Create(tmpPath)
	if err != nil {
		return err
	}
	defer out.Close()

	written, err := io.Copy(out, reader)
	if err != nil {
		os.Remove(tmpPath)
		return err
	}

	if written > MaxFileSizeBytes {
		os.Remove(tmpPath)
		return errors.New("file exceeds size limit")
	}

	if err := out.Close(); err != nil {
		os.Remove(tmpPath)
		return err
	}

	return os.Rename(tmpPath, filePath)
}

func (c *MediaProxyController) isValidMediaContentType(contentType string, header http.Header) bool {
	ct := strings.ToLower(contentType)

	if ct == "" ||
		strings.HasPrefix(ct, "text/") ||
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

	cd := header.Get("Content-Disposition")
	return cd != "" && strings.Contains(cd, "filename=")
}

func (c *MediaProxyController) fetchWithRedirects(urlStr string, maxRedirects int) (*http.Response, string, error) {
	visited := make(map[string]bool)

	for i := 0; i < maxRedirects; i++ {
		if visited[urlStr] {
			return nil, urlStr, errors.New("redirect loop detected")
		}
		visited[urlStr] = true

		if !isAllowedHTTPS(urlStr) || c.isUrlBlacklisted(urlStr) {
			return nil, urlStr, errors.New("URL not allowed")
		}

		req, err := http.NewRequest("GET", urlStr, nil)
		if err != nil {
			return nil, urlStr, err
		}

		req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
		req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8")
		req.Header.Set("Accept-Language", "en-US,en;q=0.9")
		req.Header.Set("Accept-Encoding", "gzip, deflate, br")
		req.Header.Set("Connection", "keep-alive")
		req.Header.Set("Upgrade-Insecure-Requests", "1")

		resp, err := c.httpClient.Do(req)
		if err != nil {
			return nil, urlStr, err
		}

		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			return resp, urlStr, nil
		}

		if resp.StatusCode >= 300 && resp.StatusCode < 400 {
			location := resp.Header.Get("Location")
			resp.Body.Close()

			if location == "" {
				return nil, urlStr, errors.New("redirect without Location")
			}

			base, _ := url.Parse(urlStr)
			redirect, _ := url.Parse(location)
			urlStr = base.ResolveReference(redirect).String()
			continue
		}

		resp.Body.Close()
		return nil, urlStr, fmt.Errorf("HTTP %d", resp.StatusCode)
	}

	return nil, urlStr, errors.New("too many redirects")
}

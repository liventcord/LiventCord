package main

import (
	"io"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"golang.org/x/net/html"
)

func extractMetadataFromHtml(url, htmlStr string) *Metadata {
	doc, err := html.Parse(strings.NewReader(htmlStr))
	if err != nil {
		return &Metadata{}
	}
	var f func(*html.Node, map[string]string)
	meta := make(map[string]string)
	f = func(n *html.Node, meta map[string]string) {
		if n.Type == html.ElementNode {
			if n.Data == "title" && n.FirstChild != nil {
				meta["title"] = n.FirstChild.Data
			}
			if n.Data == "meta" {
				property := ""
				name := ""
				content := ""
				for _, attr := range n.Attr {
					if attr.Key == "property" {
						property = attr.Val
					}
					if attr.Key == "name" {
						name = attr.Val
					}
					if attr.Key == "content" {
						content = attr.Val
					}
				}
				if property != "" {
					meta[property] = content
				}
				if name != "" {
					meta[name] = content
				}
			}
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			f(c, meta)
		}
	}
	f(doc, meta)
	domain, _ := parseUrl(url)
	return &Metadata{
		Title:       firstNonEmpty(meta["title"], meta["og:title"]),
		Description: firstNonEmpty(meta["description"], meta["og:description"]),
		SiteName:    firstNonEmpty(meta["og:site_name"], domain),
		Image:       firstNonEmpty(meta["og:image"], meta["twitter:image"]),
		Url:         firstNonEmpty(meta["og:url"], url),
		Type:        meta["og:type"],
		Keywords:    meta["keywords"],
		Author:      meta["author"],
	}
}

func (c *MediaProxyController) FetchMetadata(ctx *gin.Context) {
	var urls []string
	_ = ctx.BindJSON(&urls)
	var resp []MetadataWithMedia
	for _, url := range urls {
		url = strings.TrimSpace(url)
		request, _ := http.NewRequest("GET", url, nil)
		resp2, err := c.httpClient.Do(request)
		if err != nil {
			resp = append(resp, MetadataWithMedia{nil, &Metadata{}})
			continue
		}
		defer resp2.Body.Close()
		contentType := resp2.Header.Get("Content-Type")
		media := c.isValidMediaContentType(contentType)
		var meta *Metadata
		var mediaUrl *MediaUrl
		if strings.Contains(contentType, "text/html") {
			body, _ := io.ReadAll(resp2.Body)
			meta = extractMetadataFromHtml(url, string(body))
		}
		if media {
			filePath := c.getCacheFilePath(url)
			_ = c.saveResponseToFile(resp2, filePath)
			mediaUrl = &MediaUrl{
				Url:      url,
				IsImage:  strings.HasPrefix(contentType, "image/"),
				IsVideo:  strings.HasPrefix(contentType, "video/"),
				FileSize: resp2.ContentLength,
				Width:    getImageDimension(filePath, true),
				Height:   getImageDimension(filePath, false),
				FileName: getFileName(resp2, url),
			}
		}
		resp = append(resp, MetadataWithMedia{mediaUrl, meta})
	}
	ctx.JSON(200, resp)
}

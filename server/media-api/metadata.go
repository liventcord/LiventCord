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
	if err := ctx.BindJSON(&urls); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	results := make([]MetadataWithMedia, 0, len(urls))

	for _, urlStr := range urls {
		if err := validateURL(urlStr); err != nil {
			continue
		}

		resp, finalURL, err := c.fetchWithRedirects(urlStr, MaxRedirects)
		if err != nil {
			continue
		}

		filePath := c.getCacheFilePath(finalURL)
		contentType := resp.Header.Get("Content-Type")

		var mediaUrl *MediaUrl
		var meta *Metadata

		if strings.Contains(contentType, "text/html") {
			body, _ := io.ReadAll(io.LimitReader(resp.Body, 1000*1024))
			meta = extractMetadataFromHtml(finalURL, string(body))
			resp.Body.Close()
		} else {
			mediaUrl, _ = c.handleMediaResponse(resp, finalURL, filePath)
			resp.Body.Close()
		}

		results = append(results, MetadataWithMedia{mediaUrl, meta})
	}

	ctx.JSON(http.StatusOK, results)
}

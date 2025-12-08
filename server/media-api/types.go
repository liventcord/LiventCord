package main

import (
	"net/http"
	"sync"
	"time"
)

type MediaCacheSettings struct {
	CacheDirectory    string
	StorageLimitBytes int64
	MainServerUrl     string
}
type MediaUrl struct {
	Url      string `json:"url"`
	IsImage  bool   `json:"isImage"`
	IsVideo  bool   `json:"isVideo"`
	FileName string `json:"fileName"`
	FileSize int64  `json:"fileSize"`
	Width    int    `json:"width"`
	Height   int    `json:"height"`
}

type Metadata struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	SiteName    string `json:"siteName"`
	Image       string `json:"image"`
	Url         string `json:"url"`
	Type        string `json:"type"`
	Keywords    string `json:"keywords"`
	Author      string `json:"author"`
}
type MediaProxyController struct {
	httpClient         *http.Client
	cacheDirectory     string
	storageLimit       int64
	mainServerUrl      string
	blacklistPath      string
	blacklistedUrlsEnv string
	downloadTasks      sync.Map
	blacklistLock      sync.Mutex
	blacklistedUrls    map[string]time.Time
}
type AppConfig struct {
	ExternalMediaLimit int64
	MainServerUrl      string
}

func (m *Metadata) IsEmpty() bool {
	return m.Title == "" && m.Description == "" && m.SiteName == "" &&
		m.Image == "" && m.Url == "" && m.Type == "" && m.Keywords == "" && m.Author == ""
}

type UrlMetadata struct {
	Metadata
	Id        int       `json:"id"`
	Domain    string    `json:"domain"`
	RoutePath string    `json:"routePath"`
	CreatedAt time.Time `json:"createdAt"`
}

type MetadataWithMedia struct {
	MediaUrl *MediaUrl `json:"mediaUrl"`
	Metadata *Metadata `json:"metadata"`
}

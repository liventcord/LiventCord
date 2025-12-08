package main

import (
	"crypto/md5"
	"encoding/base64"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

func (c *MediaProxyController) enforceStorageLimit() {
	files, err := os.ReadDir(c.cacheDirectory)
	if err != nil {
		return
	}

	type fileInfo struct {
		name string
		size int64
		time time.Time
	}

	var regularFiles []fileInfo
	var total int64

	for _, file := range files {
		if file.Name() == "blacklisted_urls.json" || file.IsDir() {
			continue
		}

		info, err := file.Info()
		if err != nil {
			continue
		}

		regularFiles = append(regularFiles, fileInfo{
			name: file.Name(),
			size: info.Size(),
			time: info.ModTime(),
		})
		total += info.Size()
	}

	if total <= c.storageLimit {
		return
	}

	sort.Slice(regularFiles, func(i, j int) bool {
		return regularFiles[i].time.Before(regularFiles[j].time)
	})

	for _, f := range regularFiles {
		if total <= c.storageLimit {
			break
		}
		os.Remove(filepath.Join(c.cacheDirectory, f.name))
		total -= f.size
	}
}

func (c *MediaProxyController) getCacheFilePath(urlStr string) string {
	h := md5.Sum([]byte(urlStr))
	encoded := base64.RawURLEncoding.EncodeToString(h[:])
	return filepath.Join(c.cacheDirectory, strings.ToLower(encoded))
}

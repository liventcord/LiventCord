package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

func LoadConfig() *AppConfig {
	limit, err := strconv.ParseInt(os.Getenv("ExternalMediaLimit"), 10, 64)
	if err != nil || limit == 0 {
		limit = 10
	}

	url := os.Getenv("MainServerUrl")
	if url == "" {
		url = "http://localhost:5005"
	}

	return &AppConfig{
		ExternalMediaLimit: limit * 1024 * 1024 * 1024,
		MainServerUrl:      url,
	}
}
func NewMediaCacheSettings(cfg *AppConfig) *MediaCacheSettings {
	cacheDir := filepath.Join(getCurrentDir(), "MediaCache")
	_ = os.MkdirAll(cacheDir, 0755)

	return &MediaCacheSettings{
		CacheDirectory:    cacheDir,
		StorageLimitBytes: cfg.ExternalMediaLimit,
		MainServerUrl:     cfg.MainServerUrl,
	}
}

type MediaStorageInitializer struct {
	mediaCacheSettings *MediaCacheSettings
	configuration      map[string]string
}

func NewMediaStorageInitializer(mediaCacheSettings *MediaCacheSettings, configuration map[string]string) *MediaStorageInitializer {
	return &MediaStorageInitializer{
		mediaCacheSettings: mediaCacheSettings,
		configuration:      configuration,
	}
}

func (m *MediaStorageInitializer) Initialize() {
	if _, err := os.Stat(m.mediaCacheSettings.CacheDirectory); os.IsNotExist(err) {
		_ = os.MkdirAll(m.mediaCacheSettings.CacheDirectory, 0755)
	}
	m.ReportStorageStatus()
}
func (m *MediaStorageInitializer) GetFolderSize(folderPath string) int64 {
	var totalSize int64

	err := filepath.Walk(folderPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if !info.IsDir() {
			totalSize += info.Size()
		}
		return nil
	})

	if err != nil {
		return 0
	}

	return totalSize
}

func (m *MediaStorageInitializer) GetStorageStatus() map[string]interface{} {
	folderSize := m.GetFolderSize(m.mediaCacheSettings.CacheDirectory)
	fmt.Printf("Folder size for: %s is: %d bytes\n", m.mediaCacheSettings.CacheDirectory, folderSize)

	limitInGB := float64(m.mediaCacheSettings.StorageLimitBytes) / (1024 * 1024 * 1024)
	folderSizeInGB := float64(folderSize) / (1024 * 1024 * 1024)
	limitReached := folderSizeInGB >= limitInGB

	return map[string]interface{}{
		"folderSizeGB":   folderSizeInGB,
		"storageLimitGB": limitInGB,
		"limitReached":   limitReached,
	}
}

func (m *MediaStorageInitializer) ReportStorageStatus() {
	status := m.GetStorageStatus()

	folderSizeGB := status["folderSizeGB"].(float64)
	storageLimitGB := status["storageLimitGB"].(float64)

	barLength := 40
	filledLength := int(float64(barLength) * (folderSizeGB / storageLimitGB))
	if filledLength > barLength {
		filledLength = barLength
	}
	emptyLength := barLength - filledLength
	progressBar := strings.Repeat("=", filledLength) + strings.Repeat("-", emptyLength)

	fmt.Printf("External media storage folder size: %.2f GB / %.2f GB\n", folderSizeGB, storageLimitGB)
	fmt.Println("[" + progressBar + "]")

	if status["limitReached"].(bool) {
		fmt.Println("⚠️  Warning: Storage limit reached or exceeded.")
	}
}

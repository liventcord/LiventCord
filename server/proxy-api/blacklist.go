package main

import (
	"encoding/json"
	"os"
)

func add_to_blacklist(blacklistedUrlsEnv string) {
	blacklistFile := "blacklisted_urls.json"

	if blacklistedUrlsEnv == "" {
		return
	}

	var addUrls []string
	err := json.Unmarshal([]byte(blacklistedUrlsEnv), &addUrls)
	if err != nil {
		panic(err)
	}

	var blacklistedUrls []string
	blacklistData, err := os.ReadFile(blacklistFile)
	if err == nil {
		err = json.Unmarshal(blacklistData, &blacklistedUrls)
		if err != nil {
			panic(err)
		}
	}

	existing := make(map[string]bool)
	for _, url := range blacklistedUrls {
		existing[url] = true
	}

	for _, url := range addUrls {
		if !existing[url] {
			blacklistedUrls = append(blacklistedUrls, url)
			existing[url] = true
		}
	}

	outData, err := json.MarshalIndent(blacklistedUrls, "", "  ")
	if err != nil {
		panic(err)
	}

	err = os.WriteFile(blacklistFile, outData, 0644)
	if err != nil {
		panic(err)
	}
}

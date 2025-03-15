package main

import (
	"fmt"
	"github.com/joho/godotenv"
	"os"
)

func loadConfig() {
	if err := godotenv.Load(); err != nil {
		fmt.Println("Error loading .env file")
	}
}

func getEnv(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}

package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"time"
)

var hub = newHub()

func main() {
	host := os.Getenv("HOST")
	if host == "" {
		host = "0.0.0.0"
	}
	port := os.Getenv("PORT")
	if port == "" {
		port = "5000"
	}
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		resp := map[string]string{"status": "RTC server is running"}
		json.NewEncoder(w).Encode(resp)
	})
	http.HandleFunc("/ws", handleWS)

	s := &http.Server{
		Addr:              ":5010",
		ReadHeaderTimeout: 5 * time.Second,
	}
	log.Println("Starting server on port 5010")
	log.Fatal(s.ListenAndServe())
}

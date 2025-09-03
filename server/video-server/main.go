package main

import (
	"encoding/json"
	"log"
	"net/http"
	"time"
)

var hub = newHub()

func main() {
	host := getEnv("HOST", "0.0.0.0")
	port := getEnv("PORT", "5010")
	addr := host + ":" + port

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		resp := map[string]string{"status": "RTC server is running"}
		json.NewEncoder(w).Encode(resp)
	})
	http.HandleFunc("/ws", handleWS)

	s := &http.Server{
		Addr:              addr,
		ReadHeaderTimeout: 5 * time.Second,
	}
	log.Printf("Starting server on %s\n", addr)
	log.Fatal(s.ListenAndServe())
}

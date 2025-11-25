package main

import (
	"database/sql"
	"log"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"
)

type HitInfo struct {
	Count int
}

var (
	hits   = make(map[string]*HitInfo)
	hitsMu sync.Mutex
	db     *sql.DB
)

func handleHitlogs(r *gin.Engine) {
	if getEnv("EnableHitlogs", "false") != "true" {
		log.Println("Hitlogs disabled")
		return
	}
	log.Println("Hitlogs enabled")

	var err error
	db, err = sql.Open("postgres", getEnv("PostgresURI", "postgres://postgres@localhost:5432/hitlogs"))
	if err != nil {
		panic(err)
	}

	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS hits (
			ip TEXT NOT NULL,
			timestamp TIMESTAMP NOT NULL,
			count INT NOT NULL
		)
	`)
	if err != nil {
		panic(err)
	}

	r.GET("/track", trackHit)

	go periodicFlush(30 * time.Second)

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-quit
		log.Println("Shutdown signal, flushing hits")
		flushHits()
		os.Exit(0)
	}()
}

func trackHit(c *gin.Context) {
	ip := c.ClientIP()
	hitsMu.Lock()
	if hi := hits[ip]; hi != nil {
		hi.Count++
	} else {
		hits[ip] = &HitInfo{Count: 1}
	}
	hitsMu.Unlock()
	c.Status(200)
}

func periodicFlush(d time.Duration) {
	for range time.Tick(d) {
		flushHits()
	}
}

func flushHits() {
	hitsMu.Lock()
	if len(hits) == 0 {
		hitsMu.Unlock()
		return
	}
	copyHits := hits
	hits = make(map[string]*HitInfo)
	hitsMu.Unlock()

	tx, err := db.Begin()
	if err != nil {
		log.Println("DB begin error:", err)
		return
	}

	stmt, err := tx.Prepare(`
		INSERT INTO hits (ip, timestamp, count)
		VALUES ($1, $2, $3)
	`)
	if err != nil {
		log.Println("DB prepare error:", err)
		tx.Rollback()
		return
	}

	ts := time.Now()
	for ip, hi := range copyHits {
		if _, err := stmt.Exec(ip, ts, hi.Count); err != nil {
			log.Println("DB exec error for IP", ip, ":", err)
			tx.Rollback()
			return
		}
	}

	stmt.Close()
	if err := tx.Commit(); err != nil {
		log.Println("DB commit error:", err)
		return
	}

	log.Printf("Flushed %d IPs at %s", len(copyHits), ts.Format(time.RFC3339))
}

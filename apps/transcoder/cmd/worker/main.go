package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"

	"lms/transcoder/internal/config"
	"lms/transcoder/internal/db"
	"lms/transcoder/internal/s3"
	"lms/transcoder/internal/worker"
)

func main() {
	log.Println("==================================================")
	log.Println("🚀 Starting LMS Video Transcoder Worker (Go + FFmpeg)")
	log.Println("==================================================")

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// 1. Load Configuration
	cfg := config.Load()

	// 2. Connect to PostgreSQL
	database, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("[Main] Failed to connect to PostgreSQL: %v", err)
	}
	defer database.Close()

	// 3. Connect to MinIO S3
	s3Client, err := s3.New(ctx, cfg)
	if err != nil {
		log.Fatalf("[Main] Failed to initialize S3 client: %v", err)
	}

	// 4. Create and start Worker
	w := worker.New(cfg, database, s3Client)
	defer w.Close()

	// 5. Handle graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	go func() {
		<-sigChan
		log.Println("[Main] Received termination signal. Initiating graceful shutdown...")
		cancel()
	}()

	// 6. Run consumer loop
	if err := w.Start(ctx); err != nil {
		log.Fatalf("[Main] Worker error: %v", err)
	}

	log.Println("[Main] Transcoder Worker gracefully stopped.")
}

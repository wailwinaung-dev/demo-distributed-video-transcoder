package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	DatabaseURL     string
	RedisAddr       string
	RedisQueue      string
	S3Endpoint      string
	S3AccessKey     string
	S3SecretKey     string
	S3RawBucket     string
	S3StreamBucket  string
	S3ForcePathStyle bool
}

func Load() *Config {
	// Attempt to load .env from current directory or app directory
	_ = godotenv.Load(".env")

	cfg := &Config{
		DatabaseURL:     getEnv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/lms_demo?schema=public"),
		RedisAddr:       getEnv("REDIS_ADDR", "localhost:6379"),
		RedisQueue:      getEnv("REDIS_QUEUE", "video_transcode_queue"),
		S3Endpoint:      getEnv("S3_ENDPOINT", "http://localhost:9000"),
		S3AccessKey:     getEnv("S3_ACCESS_KEY", "minioadmin"),
		S3SecretKey:     getEnv("S3_SECRET_KEY", "minioadmin"),
		S3RawBucket:     getEnv("S3_RAW_BUCKET", "lms-raw-uploads"),
		S3StreamBucket:  getEnv("S3_STREAM_BUCKET", "lms-stream-media"),
		S3ForcePathStyle: getEnv("S3_FORCE_PATH_STYLE", "true") == "true",
	}

	log.Printf("[Config] S3 Endpoint: %s, Raw Bucket: %s, Stream Bucket: %s", cfg.S3Endpoint, cfg.S3RawBucket, cfg.S3StreamBucket)
	log.Printf("[Config] Redis Queue: %s at %s", cfg.RedisQueue, cfg.RedisAddr)

	return cfg
}

func getEnv(key, fallback string) string {
	if val, ok := os.LookupEnv(key); ok && val != "" {
		return val
	}
	return fallback
}

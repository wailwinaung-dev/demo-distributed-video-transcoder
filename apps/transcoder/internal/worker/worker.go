package worker

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/redis/go-redis/v9"
	"lms/transcoder/internal/config"
	"lms/transcoder/internal/db"
	"lms/transcoder/internal/ffmpeg"
	"lms/transcoder/internal/s3"
)

type JobPayload struct {
	VideoID string `json:"videoId"`
	RawKey  string `json:"rawKey"`
}

type Worker struct {
	cfg *config.Config
	rdb *redis.Client
	db  *db.Database
	s3  *s3.S3Client
	ff  *ffmpeg.Transcoder
}

func New(cfg *config.Config, database *db.Database, s3Client *s3.S3Client) *Worker {
	rdb := redis.NewClient(&redis.Options{
		Addr: cfg.RedisAddr,
	})

	return &Worker{
		cfg: cfg,
		rdb: rdb,
		db:  database,
		s3:  s3Client,
		ff:  ffmpeg.New(),
	}
}

func (w *Worker) Start(ctx context.Context) error {
	log.Printf("[Worker] Listening for transcode jobs on Redis queue '%s' at %s...", w.cfg.RedisQueue, w.cfg.RedisAddr)

	for {
		select {
		case <-ctx.Done():
			log.Println("[Worker] Shutting down transcode listener...")
			return nil
		default:
			// Blocking pop from Redis with 3-second timeout
			res, err := w.rdb.BRPop(ctx, 3*time.Second, w.cfg.RedisQueue).Result()
			if err != nil {
				if err == redis.Nil || ctx.Err() != nil {
					continue
				}
				log.Printf("[Worker] Redis BRPop error: %v", err)
				time.Sleep(1 * time.Second)
				continue
			}

			if len(res) < 2 {
				continue
			}

			payloadJSON := res[1]
			log.Printf("[Worker] 📥 Received new transcode job: %s", payloadJSON)

			var job JobPayload
			if err := json.Unmarshal([]byte(payloadJSON), &job); err != nil {
				log.Printf("[Worker] Error parsing job payload: %v", err)
				continue
			}

			if err := w.processJob(ctx, job); err != nil {
				log.Printf("[Worker] ❌ Failed to process video %s: %v", job.VideoID, err)
				_ = w.db.SetVideoFailed(context.Background(), job.VideoID, err.Error())
			}
		}
	}
}

func (w *Worker) processJob(ctx context.Context, job JobPayload) error {
	startTime := time.Now()
	log.Println("--------------------------------------------------------------------------------")
	log.Printf("[Worker] ⚙️  [Job Started] Video ID: %s (Raw Key: %s)", job.VideoID, job.RawKey)
	log.Println("--------------------------------------------------------------------------------")

	// 1. Update status to PROCESSING in PostgreSQL
	log.Printf("[Worker] ⏳ [Step 1/6] Updating video status to 'PROCESSING' in PostgreSQL...")
	if err := w.db.UpdateVideoStatus(ctx, job.VideoID, "PROCESSING"); err != nil {
		return fmt.Errorf("failed to set PROCESSING status: %w", err)
	}
	_ = w.db.UpdateVideoProgress(ctx, job.VideoID, 0)
	log.Printf("[Worker] ↳ Video %s status set to PROCESSING (0%%)", job.VideoID)

	// 2. Setup temporary local workspace
	workDir := filepath.Join(os.TempDir(), "lms_transcode", job.VideoID)
	outDir := filepath.Join(workDir, "output")
	sourcePath := filepath.Join(workDir, "source.mp4")

	if err := os.MkdirAll(outDir, 0755); err != nil {
		return fmt.Errorf("failed to create workdir %s: %w", workDir, err)
	}
	defer func() {
		log.Printf("[Worker] 🧹 Cleaning up temporary workspace: %s", workDir)
		_ = os.RemoveAll(workDir)
	}()

	// 3. Download raw video from MinIO S3
	log.Printf("[Worker] 📥 [Step 2/6] Downloading raw video from s3://%s/%s ...", w.cfg.S3RawBucket, job.RawKey)
	if err := w.s3.DownloadFile(ctx, w.cfg.S3RawBucket, job.RawKey, sourcePath); err != nil {
		return fmt.Errorf("failed to download source video from S3: %w", err)
	}

	// 4. Probe video duration
	log.Printf("[Worker] 🔍 [Step 3/6] Probing video duration and streams via ffprobe...")
	duration, err := w.ff.GetVideoDuration(ctx, sourcePath)
	if err != nil {
		return fmt.Errorf("failed to probe video duration: %w", err)
	}
	mins := int(duration) / 60
	secs := int(duration) % 60
	log.Printf("[Worker] ↳ Probed Video Duration: %02dm%02ds (%.2f seconds)", mins, secs, duration)

	_ = w.db.UpdateVideoProgress(ctx, job.VideoID, 5)

	// 5. Generate AES-128 Encryption Key & Key Info file
	log.Printf("[Worker] 🔐 Generating 16-byte AES-128 encryption key and IV...")
	aesKey := make([]byte, 16)
	if _, err := rand.Read(aesKey); err != nil {
		return fmt.Errorf("failed to generate random AES key: %w", err)
	}
	aesIv := make([]byte, 16)
	if _, err := rand.Read(aesIv); err != nil {
		return fmt.Errorf("failed to generate random IV: %w", err)
	}

	keyHex := hex.EncodeToString(aesKey)
	ivHex := hex.EncodeToString(aesIv)

	// Save key and IV to PostgreSQL
	if err := w.db.SaveVideoEncryptionKey(ctx, job.VideoID, keyHex, ivHex); err != nil {
		return fmt.Errorf("failed to save encryption key to database: %w", err)
	}

	// Write local enc.key for FFmpeg
	encKeyPath := filepath.Join(workDir, "enc.key")
	if err := os.WriteFile(encKeyPath, aesKey, 0600); err != nil {
		return fmt.Errorf("failed to write enc.key file: %w", err)
	}

	// Write key_info.txt (Line 1: Key URL, Line 2: Local key path, Line 3: IV hex)
	keyInfoPath := filepath.Join(workDir, "key_info.txt")
	keyURI := fmt.Sprintf("http://localhost:4000/api/videos/keys/%s", job.VideoID)
	keyInfoContent := fmt.Sprintf("%s\n%s\n%s\n", keyURI, encKeyPath, ivHex)
	if err := os.WriteFile(keyInfoPath, []byte(keyInfoContent), 0600); err != nil {
		return fmt.Errorf("failed to write key_info.txt: %w", err)
	}
	log.Printf("[Worker] 🔑 Encryption key generated and registered: %s", keyURI)

	// 6. Generate Multi-Bitrate Encrypted HLS ladder (360p, 720p, 1080p + master.m3u8)
	log.Printf("[Worker] 🎬 [Step 4/6] Transcoding HLS adaptive ladder (360p, 720p, 1080p) with AES-128 encryption...")
	err = w.ff.GenerateHLS(ctx, sourcePath, outDir, keyInfoPath, duration, func(pct int) {
		_ = w.db.UpdateVideoProgress(ctx, job.VideoID, pct)
	})
	if err != nil {
		return fmt.Errorf("failed during HLS generation: %w", err)
	}

	// 6. Generate Storyboard Sprites & WebVTT
	log.Printf("[Worker] 🖼️  [Step 5/6] Generating seekbar hover Storyboard Sprites & WebVTT cues...")
	_ = w.db.UpdateVideoProgress(ctx, job.VideoID, 88)
	if err := w.ff.GenerateStoryboard(ctx, sourcePath, outDir, duration); err != nil {
		log.Printf("[Worker] Warning: Storyboard generation had non-fatal error: %v", err)
	}

	// 7. Upload all generated stream files to MinIO
	log.Printf("[Worker] ☁️  [Step 6/6] Uploading stream directory to s3://%s/%s/ ...", w.cfg.S3StreamBucket, job.VideoID)
	_ = w.db.UpdateVideoProgress(ctx, job.VideoID, 95)
	if err := w.s3.UploadDirectory(ctx, w.cfg.S3StreamBucket, job.VideoID, outDir); err != nil {
		return fmt.Errorf("failed to upload stream media to S3: %w", err)
	}

	// 8. Mark video as READY in PostgreSQL
	hlsMasterKey := fmt.Sprintf("%s/master.m3u8", job.VideoID)
	vttKey := fmt.Sprintf("%s/storyboard.vtt", job.VideoID)

	if err := w.db.SetVideoReady(ctx, job.VideoID, hlsMasterKey, vttKey); err != nil {
		return fmt.Errorf("failed to set video READY: %w", err)
	}

	elapsed := time.Since(startTime)
	log.Println("--------------------------------------------------------------------------------")
	log.Printf("[Worker] ✨ Video %s marked READY in PostgreSQL (100%%)!", job.VideoID)
	log.Printf("[Worker] 🎯 Master Playlist: %s | Storyboard VTT: %s", hlsMasterKey, vttKey)
	log.Printf("[Worker] ⏱️  Total Pipeline Duration: %s", elapsed.Round(time.Millisecond))
	log.Println("--------------------------------------------------------------------------------")
	return nil
}

func (w *Worker) Close() {
	_ = w.rdb.Close()
}

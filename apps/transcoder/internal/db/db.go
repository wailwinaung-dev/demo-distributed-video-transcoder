package db

import (
	"context"
	"fmt"
	"log"
	"net/url"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Database struct {
	pool *pgxpool.Pool
}

func cleanPostgresURL(rawURL string) string {
	u, err := url.Parse(rawURL)
	if err != nil {
		return rawURL
	}
	q := u.Query()
	q.Del("schema") // remove Prisma-specific query parameter
	if q.Get("sslmode") == "" {
		q.Set("sslmode", "disable")
	}
	u.RawQuery = q.Encode()
	return u.String()
}

func Connect(ctx context.Context, databaseURL string) (*Database, error) {
	cleanedURL := cleanPostgresURL(databaseURL)
	pool, err := pgxpool.New(ctx, cleanedURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to postgres: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("failed to ping postgres: %w", err)
	}

	log.Println("[DB] Successfully connected to PostgreSQL")
	return &Database{pool: pool}, nil
}

func (d *Database) Close() {
	d.pool.Close()
}

func (d *Database) UpdateVideoStatus(ctx context.Context, videoID string, status string) error {
	query := `
		UPDATE "videos"
		SET "status" = $1::"VideoStatus", "updatedAt" = NOW()
		WHERE "id" = $2
	`
	_, err := d.pool.Exec(ctx, query, status, videoID)
	if err != nil {
		return fmt.Errorf("failed to update video status: %w", err)
	}
	return nil
}

func (d *Database) UpdateVideoProgress(ctx context.Context, videoID string, progress int) error {
	query := `
		UPDATE "videos"
		SET "progress" = $1, "updatedAt" = NOW()
		WHERE "id" = $2
	`
	_, err := d.pool.Exec(ctx, query, progress, videoID)
	if err != nil {
		return fmt.Errorf("failed to update video progress: %w", err)
	}
	return nil
}

func (d *Database) SetVideoReady(ctx context.Context, videoID string, hlsMasterKey string, vttKey string) error {
	query := `
		UPDATE "videos"
		SET "status" = 'READY'::"VideoStatus",
		    "progress" = 100,
		    "hlsMasterKey" = $1,
		    "vttKey" = $2,
		    "updatedAt" = NOW()
		WHERE "id" = $3
	`
	_, err := d.pool.Exec(ctx, query, hlsMasterKey, vttKey, videoID)
	if err != nil {
		return fmt.Errorf("failed to set video ready: %w", err)
	}
	return nil
}

func (d *Database) SetVideoFailed(ctx context.Context, videoID string, errorMessage string) error {
	query := `
		UPDATE "videos"
		SET "status" = 'FAILED'::"VideoStatus",
		    "errorMessage" = $1,
		    "updatedAt" = NOW()
		WHERE "id" = $2
	`
	_, err := d.pool.Exec(ctx, query, errorMessage, videoID)
	if err != nil {
		return fmt.Errorf("failed to set video failed: %w", err)
	}
	return nil
}

func (d *Database) SaveVideoEncryptionKey(ctx context.Context, videoID string, aesKeyHex string, aesIvHex string) error {
	query := `
		UPDATE "videos"
		SET "aesKey" = $1,
		    "aesIv" = $2,
		    "isEncrypted" = true,
		    "updatedAt" = NOW()
		WHERE "id" = $3
	`
	_, err := d.pool.Exec(ctx, query, aesKeyHex, aesIvHex, videoID)
	if err != nil {
		return fmt.Errorf("failed to save video encryption key: %w", err)
	}
	return nil
}

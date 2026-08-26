package s3

import (
	"context"
	"fmt"
	"io"
	"log"
	"mime"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	s3config "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"lms/transcoder/internal/config"
)

type S3Client struct {
	client *s3.Client
	cfg    *config.Config
}

func New(ctx context.Context, cfg *config.Config) (*S3Client, error) {
	customResolver := aws.EndpointResolverWithOptionsFunc(func(service, region string, options ...interface{}) (aws.Endpoint, error) {
		return aws.Endpoint{
			URL:               cfg.S3Endpoint,
			HostnameImmutable: true,
			SigningRegion:     "us-east-1",
		}, nil
	})

	awsCfg, err := s3config.LoadDefaultConfig(ctx,
		s3config.WithRegion("us-east-1"),
		s3config.WithEndpointResolverWithOptions(customResolver),
		s3config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(cfg.S3AccessKey, cfg.S3SecretKey, "")),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to load aws config: %w", err)
	}

	client := s3.NewFromConfig(awsCfg, func(o *s3.Options) {
		o.UsePathStyle = cfg.S3ForcePathStyle
	})

	return &S3Client{
		client: client,
		cfg:    cfg,
	}, nil
}

func (s *S3Client) DownloadFile(ctx context.Context, bucket string, key string, destPath string) error {
	startTime := time.Now()
	log.Printf("[S3] ⬇️  Downloading s3://%s/%s ...", bucket, key)

	out, err := s.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return fmt.Errorf("failed to get object s3://%s/%s: %w", bucket, key, err)
	}
	defer out.Body.Close()

	if err := os.MkdirAll(filepath.Dir(destPath), 0755); err != nil {
		return fmt.Errorf("failed to create directory for download: %w", err)
	}

	destFile, err := os.Create(destPath)
	if err != nil {
		return fmt.Errorf("failed to create dest file %s: %w", destPath, err)
	}
	defer destFile.Close()

	written, err := io.Copy(destFile, out.Body)
	if err != nil {
		return fmt.Errorf("failed to write downloaded content: %w", err)
	}

	elapsed := time.Since(startTime)
	mb := float64(written) / (1024 * 1024)
	speedMBs := mb / elapsed.Seconds()

	log.Printf("[S3] ✅ Download complete: %.2f MB in %s (%.1f MB/s) -> %s", mb, elapsed.Round(time.Millisecond), speedMBs, destPath)
	return nil
}

func (s *S3Client) UploadDirectory(ctx context.Context, bucket string, prefix string, localDir string) error {
	startTime := time.Now()
	log.Printf("[S3] ⬆️  Uploading stream assets to s3://%s/%s/ ...", bucket, prefix)

	cleanPrefix := strings.Trim(prefix, "/")
	fileCount := 0
	var totalBytes int64

	err := filepath.Walk(localDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			return nil
		}

		relPath, err := filepath.Rel(localDir, path)
		if err != nil {
			return fmt.Errorf("failed to get relative path for %s: %w", path, err)
		}

		s3Key := fmt.Sprintf("%s/%s", cleanPrefix, filepath.ToSlash(relPath))
		contentType := detectContentType(path)

		file, err := os.Open(path)
		if err != nil {
			return fmt.Errorf("failed to open local file %s: %w", path, err)
		}
		defer file.Close()

		_, err = s.client.PutObject(ctx, &s3.PutObjectInput{
			Bucket:      aws.String(bucket),
			Key:         aws.String(s3Key),
			Body:        file,
			ContentType: aws.String(contentType),
		})
		if err != nil {
			return fmt.Errorf("failed to upload %s to s3://%s/%s: %w", path, bucket, s3Key, err)
		}

		fileCount++
		totalBytes += info.Size()
		return nil
	})

	if err != nil {
		return err
	}

	elapsed := time.Since(startTime)
	mb := float64(totalBytes) / (1024 * 1024)
	log.Printf("[S3] ✅ Successfully uploaded %d files (%.2f MB) to s3://%s/%s/ in %s",
		fileCount, mb, bucket, prefix, elapsed.Round(time.Millisecond))

	return nil
}

func detectContentType(filePath string) string {
	ext := strings.ToLower(filepath.Ext(filePath))
	switch ext {
	case ".m3u8":
		return "application/x-mpegURL"
	case ".ts":
		return "video/MP2T"
	case ".vtt":
		return "text/vtt"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".png":
		return "image/png"
	case ".mp4":
		return "video/mp4"
	default:
		t := mime.TypeByExtension(ext)
		if t != "" {
			return t
		}
		return "application/octet-stream"
	}
}

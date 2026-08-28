package ffmpeg

import (
	"bufio"
	"context"
	"fmt"
	"log"
	"math"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

type Transcoder struct{}

func New() *Transcoder {
	return &Transcoder{}
}

// GetVideoDuration probes the input video duration in seconds using ffprobe.
func (t *Transcoder) GetVideoDuration(ctx context.Context, sourcePath string) (float64, error) {
	cmd := exec.CommandContext(ctx, "ffprobe",
		"-v", "error",
		"-show_entries", "format=duration",
		"-of", "default=noprint_wrappers=1:nokey=1",
		sourcePath,
	)

	out, err := cmd.Output()
	if err != nil {
		return 0, fmt.Errorf("ffprobe failed: %w", err)
	}

	trimmed := strings.TrimSpace(string(out))
	duration, err := strconv.ParseFloat(trimmed, 64)
	if err != nil {
		return 0, fmt.Errorf("failed to parse duration '%s': %w", trimmed, err)
	}

	return duration, nil
}

// GenerateHLS transcodes the source video into 360p, 720p, and 1080p HLS renditions with master.m3u8 and optional AES-128 encryption.
func (t *Transcoder) GenerateHLS(
	ctx context.Context,
	sourcePath string,
	outputDir string,
	keyInfoPath string,
	totalDuration float64,
	onProgress func(percent int),
) error {
	startTime := time.Now()
	mins := int(totalDuration) / 60
	secs := int(totalDuration) % 60
	log.Printf("[FFmpeg] 🎬 Starting Multi-Bitrate HLS Transcoding for %s (Duration: %02dm%02ds / %.2fs)", sourcePath, mins, secs, totalDuration)
	log.Printf("[FFmpeg] 📐 Target Renditions: 360p (800k), 720p (2800k), 1080p (5000k)")
	if keyInfoPath != "" {
		log.Printf("[FFmpeg] 🔐 AES-128 Segment Encryption Enabled (Key Info: %s)", keyInfoPath)
	}

	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return fmt.Errorf("failed to create output dir: %w", err)
	}

	for _, res := range []string{"360p", "720p", "1080p"} {
		if err := os.MkdirAll(filepath.Join(outputDir, res), 0755); err != nil {
			return fmt.Errorf("failed to create rendition dir: %w", err)
		}
	}

	// Filter complex to scale into 3 renditions while maintaining aspect ratio
	filterComplex := "[0:v]split=3[v1][v2][v3];" +
		"[v1]scale=w=640:h=360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2[v360];" +
		"[v2]scale=w=1280:h=720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2[v720];" +
		"[v3]scale=w=1920:h=1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2[v1080]"

	args := []string{
		"-y",
		"-i", sourcePath,
		"-filter_complex", filterComplex,

		// 360p
		"-map", "[v360]", "-c:v:0", "libx264", "-b:v:0", "800k", "-maxrate:v:0", "856k", "-bufsize:v:0", "1200k",
		"-map", "0:a?", "-c:a:0", "aac", "-b:a:0", "96k",

		// 720p
		"-map", "[v720]", "-c:v:1", "libx264", "-b:v:1", "2800k", "-maxrate:v:1", "2996k", "-bufsize:v:1", "4200k",
		"-map", "0:a?", "-c:a:1", "aac", "-b:a:1", "128k",

		// 1080p
		"-map", "[v1080]", "-c:v:2", "libx264", "-b:v:2", "5000k", "-maxrate:v:2", "5350k", "-bufsize:v:2", "7500k",
		"-map", "0:a?", "-c:a:2", "aac", "-b:a:2", "192k",

		// HLS Options
		"-f", "hls",
		"-hls_time", "6",
		"-hls_playlist_type", "vod",
		"-hls_flags", "independent_segments",
		"-hls_segment_type", "mpegts",
	}

	if keyInfoPath != "" {
		args = append(args, "-hls_key_info_file", keyInfoPath)
	}

	args = append(args,
		"-hls_segment_filename", filepath.Join(outputDir, "%v", "data%03d.ts"),
		"-master_pl_name", "master.m3u8",
		"-var_stream_map", "v:0,a:0,name:360p v:1,a:1,name:720p v:2,a:2,name:1080p",
		filepath.Join(outputDir, "%v", "index.m3u8"),
		"-progress", "pipe:1",
	)

	cmd := exec.CommandContext(ctx, "ffmpeg", args...)

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return fmt.Errorf("failed to get stdout pipe: %w", err)
	}

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start ffmpeg: %w", err)
	}

	scanner := bufio.NewScanner(stdout)
	lastReported := -1
	lastReportTime := time.Now()

	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "out_time_us=") {
			timeUsStr := strings.TrimPrefix(line, "out_time_us=")
			timeUs, err := strconv.ParseInt(timeUsStr, 10, 64)
			if err == nil && totalDuration > 0 {
				currentSec := float64(timeUs) / 1000000.0
				// Map HLS transcoding to 5% - 85% of total progress
				pct := int(math.Min(85, math.Max(5, 5+((currentSec/totalDuration)*80))))

				if pct != lastReported && time.Since(lastReportTime) > 800*time.Millisecond {
					lastReported = pct
					lastReportTime = time.Now()
					log.Printf("[FFmpeg] ⏳ HLS Transcode Progress: %d%% (Encoded: %.1fs / %.1fs)", pct, currentSec, totalDuration)
					if onProgress != nil {
						onProgress(pct)
					}
				}
			}
		}
	}

	if err := cmd.Wait(); err != nil {
		return fmt.Errorf("ffmpeg HLS generation failed: %w", err)
	}

	elapsed := time.Since(startTime)
	log.Printf("[FFmpeg] ✅ HLS Transcoding completed in %s (master.m3u8, 360p, 720p, 1080p)", elapsed.Round(time.Millisecond))
	return nil
}

// GenerateStoryboard generates a sprite sheet and WebVTT cue file for seekbar thumbnail previews.
func (t *Transcoder) GenerateStoryboard(
	ctx context.Context,
	sourcePath string,
	outputDir string,
	totalDuration float64,
) error {
	startTime := time.Now()
	log.Printf("[FFmpeg] 🖼️  Generating Storyboard Sprites (1 frame every 5s) for %s ...", sourcePath)

	const interval = 5.0 // 1 frame every 5 seconds
	const thumbW = 160
	const thumbH = 90
	const cols = 5

	totalFrames := int(math.Ceil(totalDuration / interval))
	if totalFrames < 1 {
		totalFrames = 1
	}
	rows := int(math.Ceil(float64(totalFrames) / float64(cols)))

	spritePath := filepath.Join(outputDir, "sprite.jpg")
	vttPath := filepath.Join(outputDir, "storyboard.vtt")

	// 1. Generate sprite.jpg grid via FFmpeg tile filter
	tileFilter := fmt.Sprintf("fps=1/%d,scale=%d:%d,tile=%dx%d", int(interval), thumbW, thumbH, cols, rows)
	cmd := exec.CommandContext(ctx, "ffmpeg",
		"-y",
		"-i", sourcePath,
		"-vf", tileFilter,
		"-q:v", "3",
		spritePath,
	)

	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("failed to generate sprite image: %w, output: %s", err, string(out))
	}

	// 2. Generate WebVTT cue file
	vttFile, err := os.Create(vttPath)
	if err != nil {
		return fmt.Errorf("failed to create storyboard.vtt: %w", err)
	}
	defer vttFile.Close()

	writer := bufio.NewWriter(vttFile)
	writer.WriteString("WEBVTT\n\n")

	for i := 0; i < totalFrames; i++ {
		startTime := float64(i) * interval
		endTime := math.Min(float64(i+1)*interval, totalDuration)

		col := i % cols
		row := i / cols

		x := col * thumbW
		y := row * thumbH

		startStr := formatVTTTime(startTime)
		endStr := formatVTTTime(endTime)

		cue := fmt.Sprintf("%s --> %s\nsprite.jpg#xywh=%d,%d,%d,%d\n\n",
			startStr, endStr, x, y, thumbW, thumbH)
		writer.WriteString(cue)
	}

	if err := writer.Flush(); err != nil {
		return fmt.Errorf("failed to flush storyboard.vtt: %w", err)
	}

	elapsed := time.Since(startTime)
	log.Printf("[FFmpeg] ✅ Storyboard complete in %s: %s (%d frames, %dx%d grid), storyboard.vtt",
		elapsed.Round(time.Millisecond), spritePath, totalFrames, cols, rows)
	return nil
}

func formatVTTTime(seconds float64) string {
	d := time.Duration(seconds * float64(time.Second))
	h := int(d.Hours())
	m := int(d.Minutes()) % 60
	s := int(d.Seconds()) % 60
	ms := int(d.Milliseconds()) % 1000

	return fmt.Sprintf("%02d:%02d:%02d.%03d", h, m, s, ms)
}

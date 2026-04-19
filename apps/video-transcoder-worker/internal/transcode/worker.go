package transcode

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/cjrutherford/optimistic-tanuki/video-transcoder-worker/internal/protocol"
)

type Worker struct {
	OutputRoot string
}

func New(outputRoot string) *Worker {
	if outputRoot == "" {
		outputRoot = "/tmp/video-processing"
	}

	return &Worker{OutputRoot: outputRoot}
}

func (w *Worker) Process(ctx context.Context, job protocol.TranscodeJob) (*protocol.TranscodeResult, error) {
	if job.VideoID == "" {
		return nil, errors.New("videoId is required")
	}
	if job.SourcePath == "" {
		return nil, errors.New("sourcePath is required")
	}
	if _, err := os.Stat(job.SourcePath); err != nil {
		return nil, fmt.Errorf("source asset not accessible: %w", err)
	}

	outputDir := filepath.Join(w.OutputRoot, job.VideoID)
	if err := os.MkdirAll(outputDir, 0o755); err != nil {
		return nil, fmt.Errorf("create output dir: %w", err)
	}

	playbackPath := filepath.Join(outputDir, "playback.mp4")
	manifestPath := filepath.Join(outputDir, "stream.m3u8")
	segmentPattern := filepath.Join(outputDir, "segment-%03d.ts")

	if err := run(ctx, "ffmpeg", "-y", "-i", job.SourcePath,
		"-c:v", "libx264",
		"-preset", "veryfast",
		"-crf", "23",
		"-c:a", "aac",
		"-b:a", "128k",
		"-movflags", "+faststart",
		playbackPath,
	); err != nil {
		return nil, err
	}

	if err := run(ctx, "ffmpeg", "-y", "-i", playbackPath,
		"-codec", "copy",
		"-start_number", "0",
		"-hls_time", "6",
		"-hls_list_size", "0",
		"-hls_segment_filename", segmentPattern,
		"-f", "hls",
		manifestPath,
	); err != nil {
		return nil, err
	}

	segmentPaths, err := filepath.Glob(filepath.Join(outputDir, "segment-*.ts"))
	if err != nil {
		return nil, fmt.Errorf("collect hls segments: %w", err)
	}

	metadata, err := probe(ctx, playbackPath)
	if err != nil {
		return nil, err
	}

	return &protocol.TranscodeResult{
		PlaybackPath:    playbackPath,
		HLSManifestPath: manifestPath,
		HLSSegmentPaths: segmentPaths,
		DurationSeconds: metadata.DurationSeconds,
		Resolution:      metadata.Resolution,
		Encoding:        metadata.Encoding,
	}, nil
}

type probeData struct {
	Streams []struct {
		CodecName string `json:"codec_name"`
		Width     int    `json:"width"`
		Height    int    `json:"height"`
	} `json:"streams"`
	Format struct {
		Duration string `json:"duration"`
	} `json:"format"`
}

type metadata struct {
	DurationSeconds *int
	Resolution      string
	Encoding        string
}

func probe(ctx context.Context, filePath string) (*metadata, error) {
	output, err := exec.CommandContext(
		ctx,
		"ffprobe",
		"-v", "error",
		"-show_entries", "format=duration:stream=codec_name,width,height",
		"-of", "json",
		filePath,
	).CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("ffprobe failed: %w: %s", err, strings.TrimSpace(string(output)))
	}

	var data probeData
	if err := json.Unmarshal(output, &data); err != nil {
		return nil, fmt.Errorf("decode ffprobe output: %w", err)
	}

	result := &metadata{}
	if data.Format.Duration != "" {
		parsed, err := strconv.ParseFloat(data.Format.Duration, 64)
		if err == nil {
			duration := int(parsed)
			result.DurationSeconds = &duration
		}
	}
	for _, stream := range data.Streams {
		if stream.Width > 0 && stream.Height > 0 {
			result.Resolution = fmt.Sprintf("%dx%d", stream.Width, stream.Height)
		}
		if stream.CodecName != "" {
			if result.Encoding == "" {
				result.Encoding = stream.CodecName
			} else if !strings.Contains(result.Encoding, stream.CodecName) {
				result.Encoding = result.Encoding + "+" + stream.CodecName
			}
		}
	}

	return result, nil
}

func run(ctx context.Context, name string, args ...string) error {
	cmd := exec.CommandContext(ctx, name, args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("%s failed: %w: %s", name, err, strings.TrimSpace(string(output)))
	}
	return nil
}

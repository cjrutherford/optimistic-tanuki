package transcode

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/cjrutherford/optimistic-tanuki/video-transcoder-worker/internal/protocol"
)

func TestProcessRequiresInput(t *testing.T) {
	worker := New(t.TempDir())

	_, err := worker.Process(context.Background(), protocol.TranscodeJob{})
	if err == nil {
		t.Fatal("expected validation error")
	}
}

func TestProcessRejectsMissingSource(t *testing.T) {
	worker := New(t.TempDir())

	_, err := worker.Process(context.Background(), protocol.TranscodeJob{
		VideoID:    "video-1",
		SourcePath: filepath.Join(t.TempDir(), "missing.mp4"),
	})
	if err == nil {
		t.Fatal("expected missing source error")
	}
}

func TestNewUsesDefaultOutputRoot(t *testing.T) {
	worker := New("")
	if worker.OutputRoot != "/tmp/video-processing" {
		t.Fatalf("unexpected default output root: %s", worker.OutputRoot)
	}
}

func TestProcessCreatesOutputDirBeforeTranscode(t *testing.T) {
	tempDir := t.TempDir()
	sourcePath := filepath.Join(tempDir, "input.mp4")
	if err := os.WriteFile(sourcePath, []byte("not-a-real-video"), 0o644); err != nil {
		t.Fatalf("write source: %v", err)
	}

	worker := New(tempDir)
	_, _ = worker.Process(context.Background(), protocol.TranscodeJob{
		VideoID:    "video-1",
		SourcePath: sourcePath,
	})

	if _, err := os.Stat(filepath.Join(tempDir, "video-1")); err != nil {
		t.Fatalf("expected output dir to exist: %v", err)
	}
}

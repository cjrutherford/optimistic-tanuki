package transcode

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"testing"
	"time"

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
		VideoID:    "00000000-0000-4000-8000-000000000001",
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
		VideoID:    "00000000-0000-4000-8000-000000000001",
		SourcePath: sourcePath,
	})

	if _, err := os.Stat(filepath.Join(tempDir, "00000000-0000-4000-8000-000000000001")); err != nil {
		t.Fatalf("expected output dir to exist: %v", err)
	}
}

const testVideo = "00000000-0000-4000-8000-000000000001"
const testOperation = "00000000-0000-4000-8000-000000000002"

func signedFence(t *testing.T) protocol.FenceVideoRequest {
	t.Helper()
	t.Setenv(deletionSecretEnv, strings.Repeat("s", 32))
	expires := time.Now().Unix() + 30
	mac := hmac.New(sha256.New, []byte(strings.Repeat("s", 32)))
	_, _ = fmt.Fprintf(mac, "ot-video-deletion-v1:%s:%s:%d", testOperation, testVideo, expires)
	return protocol.FenceVideoRequest{VideoID: testVideo, OperationID: testOperation, ExpiresAt: expires, Signature: hex.EncodeToString(mac.Sum(nil))}
}

func TestFencePersistsAndIsolatesOutput(t *testing.T) {
	root := t.TempDir()
	worker := New(root)
	videoDir := filepath.Join(root, testVideo)
	neighbor := filepath.Join(root, "00000000-0000-4000-8000-000000000003")
	if err := os.Mkdir(videoDir, 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(videoDir, "owned"), []byte("x"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Mkdir(neighbor, 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(neighbor, "keep"), []byte("y"), 0o600); err != nil {
		t.Fatal(err)
	}
	result, err := worker.Fence(context.Background(), signedFence(t))
	if err != nil {
		t.Fatal("fence failed")
	}
	if !result.Fenced || !result.VerifiedAbsent {
		t.Fatal("fence did not confirm absence")
	}
	if _, err := os.Stat(neighbor); err != nil {
		t.Fatal("neighbor was modified")
	}
	if _, err := New(root).Process(context.Background(), protocol.TranscodeJob{VideoID: testVideo, SourcePath: filepath.Join(root, "missing")}); err == nil || err.Error() != "video fenced" {
		t.Fatalf("expected fenced denial, got %v", err)
	}
}

func TestFenceRejectsInvalidCredentialsAndCanRetryRemoval(t *testing.T) {
	root := t.TempDir()
	worker := New(root)
	req := signedFence(t)
	req.Signature = strings.ToUpper(req.Signature)
	if _, err := worker.Fence(context.Background(), req); err == nil {
		t.Fatal("expected uppercase signature rejection")
	}
	req = signedFence(t)
	worker.removeAll = func(string) error { return os.ErrPermission }
	if _, err := worker.Fence(context.Background(), req); err == nil {
		t.Fatal("expected removal failure")
	}
	if _, err := os.Stat(fencePath(root, testVideo)); err != nil {
		t.Fatal("tombstone missing after removal failure")
	}
	worker.removeAll = os.RemoveAll
	if _, err := worker.Fence(context.Background(), req); err != nil {
		t.Fatal("retry should succeed")
	}
}

func TestFenceWaitsForActiveVideoLock(t *testing.T) {
	root := t.TempDir()
	if _, err := New(root).ensureRoot(); err != nil {
		t.Fatal(err)
	}
	active, err := acquireLock(context.Background(), root, testVideo, 0)
	if err != nil {
		t.Fatal(err)
	}
	done := make(chan error, 1)
	go func() { _, err := New(root).Fence(context.Background(), signedFence(t)); done <- err }()
	select {
	case err := <-done:
		t.Fatalf("fence should wait for active lock: %v", err)
	case <-time.After(100 * time.Millisecond):
	}
	if err := active.Close(); err != nil {
		t.Fatal(err)
	}
	select {
	case err := <-done:
		if err != nil {
			t.Fatal("fence failed after lock release")
		}
	case <-time.After(2 * time.Second):
		t.Fatal("fence did not resume")
	}
}

func TestProcessRejectsNonCanonicalUUID(t *testing.T) {
	if _, err := New(t.TempDir()).Process(context.Background(), protocol.TranscodeJob{VideoID: "video-1", SourcePath: "/does/not/matter"}); err == nil {
		t.Fatal("expected UUID validation")
	}
}

func TestLockUsesExclusiveFlock(t *testing.T) {
	root := t.TempDir()
	_, err := New(root).ensureRoot()
	if err != nil {
		t.Fatal(err)
	}
	lock, err := acquireLock(context.Background(), root, testVideo, 0)
	if err != nil {
		t.Fatal(err)
	}
	defer lock.Close()
	f, err := os.OpenFile(lockPath(root, testVideo), os.O_RDWR, 0)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	if err := syscall.Flock(int(f.Fd()), syscall.LOCK_EX|syscall.LOCK_NB); err == nil {
		t.Fatal("expected lock contention")
	}
}

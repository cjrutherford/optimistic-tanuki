package transcode

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/cjrutherford/optimistic-tanuki/video-transcoder-worker/internal/protocol"
)

const deletionSecretEnv = "VIDEO_TRANSCODER_DELETION_SECRET"

type Worker struct {
	OutputRoot string
	removeAll  func(string) error
}

func New(outputRoot string) *Worker {
	if outputRoot == "" {
		outputRoot = "/tmp/video-processing"
	}
	return &Worker{OutputRoot: outputRoot, removeAll: os.RemoveAll}
}

func (w *Worker) Process(ctx context.Context, job protocol.TranscodeJob) (*protocol.TranscodeResult, error) {
	if !validUUID(job.VideoID) {
		return nil, errors.New("invalid videoId")
	}
	if job.SourcePath == "" {
		return nil, errors.New("sourcePath is required")
	}
	root, err := w.ensureRoot()
	if err != nil {
		return nil, errors.New("output unavailable")
	}
	lock, err := acquireLock(ctx, root, job.VideoID, 0)
	if err != nil {
		return nil, errors.New("video busy")
	}
	defer lock.Close()
	if _, err := os.Lstat(fencePath(root, job.VideoID)); err == nil {
		return nil, errors.New("video fenced")
	} else if !os.IsNotExist(err) {
		return nil, errors.New("output unavailable")
	}
	if _, err := os.Stat(job.SourcePath); err != nil {
		return nil, errors.New("source asset not accessible")
	}
	outputDir := filepath.Join(root, job.VideoID)
	if err := os.Mkdir(outputDir, 0o700); err != nil && !os.IsExist(err) {
		return nil, errors.New("output unavailable")
	}
	if err := validateOutputDir(root, job.VideoID); err != nil {
		return nil, errors.New("output unavailable")
	}
	playbackPath := filepath.Join(outputDir, "playback.mp4")
	manifestPath := filepath.Join(outputDir, "stream.m3u8")
	segmentPattern := filepath.Join(outputDir, "segment-%03d.ts")
	if err := run(ctx, lock, "ffmpeg", "-y", "-i", job.SourcePath, "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", playbackPath); err != nil {
		return nil, errors.New("transcode failed")
	}
	if err := run(ctx, lock, "ffmpeg", "-y", "-i", playbackPath, "-codec", "copy", "-start_number", "0", "-hls_time", "6", "-hls_list_size", "0", "-hls_segment_filename", segmentPattern, "-f", "hls", manifestPath); err != nil {
		return nil, errors.New("transcode failed")
	}
	segmentPaths, err := filepath.Glob(filepath.Join(outputDir, "segment-*.ts"))
	if err != nil {
		return nil, errors.New("transcode failed")
	}
	metadata, err := probe(ctx, lock, playbackPath)
	if err != nil {
		return nil, errors.New("transcode failed")
	}
	return &protocol.TranscodeResult{PlaybackPath: playbackPath, HLSManifestPath: manifestPath, HLSSegmentPaths: segmentPaths, DurationSeconds: metadata.DurationSeconds, Resolution: metadata.Resolution, Encoding: metadata.Encoding}, nil
}

func (w *Worker) Fence(ctx context.Context, request protocol.FenceVideoRequest) (*protocol.DeletionFenceResult, error) {
	secret := os.Getenv(deletionSecretEnv)
	if len(secret) < 32 || !validUUID(request.VideoID) || !validUUID(request.OperationID) {
		return nil, errors.New("rejected")
	}
	now := time.Now().Unix()
	if request.ExpiresAt <= now || request.ExpiresAt > now+60 {
		return nil, errors.New("rejected")
	}
	sig, err := hex.DecodeString(request.Signature)
	if err != nil || len(sig) != sha256.Size || request.Signature != strings.ToLower(request.Signature) {
		return nil, errors.New("rejected")
	}
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = fmt.Fprintf(mac, "ot-video-deletion-v1:%s:%s:%d", request.OperationID, request.VideoID, request.ExpiresAt)
	if !hmac.Equal(sig, mac.Sum(nil)) {
		return nil, errors.New("rejected")
	}
	root, err := w.ensureRoot()
	if err != nil {
		return nil, errors.New("rejected")
	}
	waitCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	lock, err := acquireLock(waitCtx, root, request.VideoID, syscall.LOCK_NB)
	for err != nil && waitCtx.Err() == nil {
		time.Sleep(20 * time.Millisecond)
		lock, err = acquireLock(waitCtx, root, request.VideoID, syscall.LOCK_NB)
	}
	if err != nil {
		return nil, errors.New("rejected")
	}
	defer lock.Close()
	if err := persistFence(root, request.VideoID); err != nil {
		return nil, errors.New("rejected")
	}
	output := filepath.Join(root, request.VideoID)
	if _, err := os.Lstat(output); err == nil {
		if err := validateOutputDir(root, request.VideoID); err != nil {
			return nil, errors.New("rejected")
		}
	} else if !os.IsNotExist(err) {
		return nil, errors.New("rejected")
	}
	if err := w.removeAll(output); err != nil {
		return nil, errors.New("rejected")
	}
	if _, err := os.Lstat(output); !os.IsNotExist(err) {
		return nil, errors.New("rejected")
	}
	return &protocol.DeletionFenceResult{VideoID: request.VideoID, VerifiedAbsent: true, Fenced: true}, nil
}

func validUUID(s string) bool {
	if len(s) != 36 || s[8] != '-' || s[13] != '-' || s[18] != '-' || s[23] != '-' {
		return false
	}
	if s[14] < '1' || s[14] > '8' || !strings.ContainsRune("89ab", rune(s[19])) {
		return false
	}
	for i, c := range s {
		if i == 8 || i == 13 || i == 18 || i == 23 {
			continue
		}
		if !(c >= '0' && c <= '9' || c >= 'a' && c <= 'f') {
			return false
		}
	}
	return true
}

func (w *Worker) ensureRoot() (string, error) {
	if err := os.MkdirAll(w.OutputRoot, 0o700); err != nil {
		return "", err
	}
	root, err := filepath.Abs(w.OutputRoot)
	if err != nil {
		return "", err
	}
	info, err := os.Lstat(root)
	if err != nil || !info.IsDir() || info.Mode()&os.ModeSymlink != 0 {
		return "", errors.New("invalid root")
	}
	fences := filepath.Join(root, ".deletion-fences")
	if err := os.MkdirAll(fences, 0o700); err != nil {
		return "", err
	}
	finfo, err := os.Lstat(fences)
	if err != nil || !finfo.IsDir() || finfo.Mode()&os.ModeSymlink != 0 {
		return "", errors.New("invalid fence directory")
	}
	return root, nil
}

func lockPath(root, id string) string {
	sum := sha256.Sum256([]byte(id))
	return filepath.Join(root, ".deletion-fences", hex.EncodeToString(sum[:])+".lock")
}
func fencePath(root, id string) string {
	sum := sha256.Sum256([]byte(id))
	return filepath.Join(root, ".deletion-fences", hex.EncodeToString(sum[:])+".fence")
}

type videoLock struct{ file *os.File }

func acquireLock(ctx context.Context, root, id string, mode int) (*videoLock, error) {
	fd, err := syscall.Open(lockPath(root, id), syscall.O_CREAT|syscall.O_RDWR|syscall.O_NOFOLLOW, 0o600)
	if err != nil {
		return nil, err
	}
	f := os.NewFile(uintptr(fd), "video-lock")
	info, err := f.Stat()
	if err != nil || !info.Mode().IsRegular() || info.Sys().(*syscall.Stat_t).Nlink != 1 {
		f.Close()
		return nil, errors.New("invalid lock")
	}
	for {
		err = syscall.Flock(int(f.Fd()), syscall.LOCK_EX|mode)
		if err == nil {
			return &videoLock{file: f}, nil
		}
		if mode == 0 || (err != syscall.EWOULDBLOCK && err != syscall.EAGAIN) || ctx.Err() != nil {
			f.Close()
			return nil, err
		}
		select {
		case <-ctx.Done():
			f.Close()
			return nil, ctx.Err()
		case <-time.After(20 * time.Millisecond):
		}
	}
}
func (l *videoLock) Close() error { return l.file.Close() }
func (l *videoLock) fd() uintptr  { return l.file.Fd() }

func persistFence(root, id string) error {
	path := fencePath(root, id)
	tmp, err := os.CreateTemp(filepath.Dir(path), ".fence-*")
	if err != nil {
		return err
	}
	name := tmp.Name()
	defer os.Remove(name)
	if err := tmp.Chmod(0o600); err != nil {
		tmp.Close()
		return err
	}
	if _, err := tmp.Write([]byte("fenced\n")); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Sync(); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	if err := os.Rename(name, path); err != nil {
		return err
	}
	dir, err := os.Open(filepath.Dir(path))
	if err != nil {
		return err
	}
	defer dir.Close()
	return dir.Sync()
}

func validateOutputDir(root, id string) error {
	path := filepath.Join(root, id)
	info, err := os.Lstat(path)
	if err != nil {
		return err
	}
	if !info.IsDir() || info.Mode()&os.ModeSymlink != 0 {
		return errors.New("invalid output")
	}
	return safeTree(path, 0, new(int))
}
func safeTree(path string, depth int, count *int) error {
	if depth > 8 {
		return errors.New("tree too deep")
	}
	*count++
	if *count > 1000 {
		return errors.New("tree too large")
	}
	info, err := os.Lstat(path)
	if err != nil {
		return err
	}
	if info.Mode()&os.ModeSymlink != 0 || !(info.IsDir() || info.Mode().IsRegular()) {
		return errors.New("unsafe entry")
	}
	if info.Mode().IsRegular() {
		st, ok := info.Sys().(*syscall.Stat_t)
		if !ok || st.Nlink != 1 {
			return errors.New("linked entry")
		}
		return nil
	}
	entries, err := os.ReadDir(path)
	if err != nil {
		return err
	}
	for _, entry := range entries {
		if err := safeTree(filepath.Join(path, entry.Name()), depth+1, count); err != nil {
			return err
		}
	}
	return nil
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

func probe(ctx context.Context, lock *videoLock, filePath string) (*metadata, error) {
	output, err := command(ctx, lock, "ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_name,width,height", "-of", "json", filePath)
	if err != nil {
		return nil, err
	}
	var data probeData
	if err := json.Unmarshal(output, &data); err != nil {
		return nil, err
	}
	result := &metadata{}
	if data.Format.Duration != "" {
		parsed, e := strconv.ParseFloat(data.Format.Duration, 64)
		if e == nil {
			d := int(parsed)
			result.DurationSeconds = &d
		}
	}
	for _, s := range data.Streams {
		if s.Width > 0 && s.Height > 0 {
			result.Resolution = fmt.Sprintf("%dx%d", s.Width, s.Height)
		}
		if s.CodecName != "" {
			if result.Encoding == "" {
				result.Encoding = s.CodecName
			} else if !strings.Contains(result.Encoding, s.CodecName) {
				result.Encoding += "+" + s.CodecName
			}
		}
	}
	return result, nil
}
func run(ctx context.Context, lock *videoLock, name string, args ...string) error {
	_, err := command(ctx, lock, name, args...)
	return err
}
func command(ctx context.Context, lock *videoLock, name string, args ...string) ([]byte, error) {
	cmd := exec.CommandContext(ctx, name, args...)
	cmd.ExtraFiles = []*os.File{lock.file}
	output, err := cmd.CombinedOutput()
	return output, err
}

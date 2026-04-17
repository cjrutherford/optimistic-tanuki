package output

import (
	"os"
	"path/filepath"
	"testing"
)

type mockRunner struct {
	executed []string
}

func TestWriteFile(t *testing.T) {
	tmpDir := t.TempDir()
	writer := NewWriter(tmpDir)

	err := writer.WriteFile("test.yaml", []byte("test: content"))
	if err != nil {
		t.Fatalf("failed to write file: %v", err)
	}

	expectedPath := filepath.Join(tmpDir, "test.yaml")
	data, err := os.ReadFile(expectedPath)
	if err != nil {
		t.Fatalf("failed to read file: %v", err)
	}

	if string(data) != "test: content" {
		t.Errorf("expected content, got %s", string(data))
	}
}

func TestWriteComposeFile(t *testing.T) {
	tmpDir := t.TempDir()
	writer := NewWriter(tmpDir)

	err := writer.WriteComposeFile([]byte("version: 3"))
	if err != nil {
		t.Fatalf("failed to write compose file: %v", err)
	}

	expectedPath := filepath.Join(tmpDir, "compose", "docker-compose.yaml")
	data, err := os.ReadFile(expectedPath)
	if err != nil {
		t.Fatalf("failed to read file: %v", err)
	}

	if string(data) != "version: 3" {
		t.Errorf("expected content, got %s", string(data))
	}
}

func TestWriteK8sFiles(t *testing.T) {
	tmpDir := t.TempDir()
	writer := NewWriter(tmpDir)

	files := map[string][]byte{
		"kustomization.yaml": []byte("apiVersion: kustomize.config.k8s.io/v1beta1"),
		"deployment.yaml":    []byte("kind: Deployment"),
	}

	err := writer.WriteK8sFiles(files)
	if err != nil {
		t.Fatalf("failed to write k8s files: %v", err)
	}

	for name, expectedContent := range files {
		expectedPath := filepath.Join(tmpDir, "k8s", name)
		data, err := os.ReadFile(expectedPath)
		if err != nil {
			t.Fatalf("failed to read file %s: %v", name, err)
		}
		if string(data) != string(expectedContent) {
			t.Errorf("expected content for %s, got %s", name, string(data))
		}
	}
}

func TestEnsureDir(t *testing.T) {
	tmpDir := t.TempDir()
	writer := NewWriter(tmpDir)

	err := writer.EnsureDir("subdir/nested")
	if err != nil {
		t.Fatalf("failed to ensure dir: %v", err)
	}

	expectedPath := filepath.Join(tmpDir, "subdir", "nested")
	if _, err := os.Stat(expectedPath); os.IsNotExist(err) {
		t.Error("expected directory to exist")
	}
}

package output

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/domain"
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

func TestWriteComposeFiles(t *testing.T) {
	tmpDir := t.TempDir()
	writer := NewWriter(tmpDir)

	files := map[string][]byte{
		"docker-compose.yaml":           []byte("services: {}"),
		"fragments/docker-compose.base.yaml": []byte("services: {}"),
	}

	err := writer.WriteComposeFiles(files)
	if err != nil {
		t.Fatalf("failed to write compose files: %v", err)
	}

	for name, expectedContent := range files {
		expectedPath := filepath.Join(tmpDir, "compose", name)
		data, err := os.ReadFile(expectedPath)
		if err != nil {
			t.Fatalf("failed to read compose file %s: %v", name, err)
		}
		if string(data) != string(expectedContent) {
			t.Errorf("expected content for %s, got %s", name, string(data))
		}
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

func TestWriteGatewayComposition(t *testing.T) {
	tmpDir := t.TempDir()
	writer := NewWriter(tmpDir)

	err := writer.WriteGatewayComposition([]byte("version: v1alpha1"))
	if err != nil {
		t.Fatalf("failed to write gateway composition: %v", err)
	}

	expectedPath := filepath.Join(tmpDir, "gateway", "composition.yaml")
	data, err := os.ReadFile(expectedPath)
	if err != nil {
		t.Fatalf("failed to read gateway composition: %v", err)
	}

	if string(data) != "version: v1alpha1" {
		t.Errorf("expected content, got %s", string(data))
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

func TestWriteExecutable(t *testing.T) {
	tmpDir := t.TempDir()
	writer := NewWriter(tmpDir)

	err := writer.WriteExecutable("bin/run.sh", []byte("#!/usr/bin/env bash\n"))
	if err != nil {
		t.Fatalf("failed to write executable: %v", err)
	}

	info, err := os.Stat(filepath.Join(tmpDir, "bin", "run.sh"))
	if err != nil {
		t.Fatalf("failed to stat executable: %v", err)
	}
	if info.Mode().Perm() != 0755 {
		t.Fatalf("expected 0755 permissions, got %#o", info.Mode().Perm())
	}
}

func TestWriteDeployScriptsComposeAndK8s(t *testing.T) {
	tmpDir := t.TempDir()
	writer := NewWriter(tmpDir)

	err := writer.WriteDeployScripts([]domain.Target{domain.TargetCompose, domain.TargetK8s})
	if err != nil {
		t.Fatalf("failed to write deploy scripts: %v", err)
	}

	rootPath := filepath.Join(tmpDir, "deploy.sh")
	rootData, err := os.ReadFile(rootPath)
	if err != nil {
		t.Fatalf("failed to read root deploy script: %v", err)
	}
	rootContent := string(rootData)
	if !contains(rootContent, `TARGET="${1:-all}"`) {
		t.Fatal("expected root deploy script to default to all")
	}
	if !contains(rootContent, `"$ROOT_DIR/compose/deploy.sh"`) {
		t.Fatal("expected root deploy script to delegate to compose deploy")
	}
	if !contains(rootContent, `"$ROOT_DIR/k8s/deploy.sh"`) {
		t.Fatal("expected root deploy script to delegate to k8s deploy")
	}

	composeData, err := os.ReadFile(filepath.Join(tmpDir, "compose", "deploy.sh"))
	if err != nil {
		t.Fatalf("failed to read compose deploy script: %v", err)
	}
	if !contains(string(composeData), "docker compose -f compose/docker-compose.yaml up -d") {
		t.Fatal("expected compose deploy command")
	}

	k8sData, err := os.ReadFile(filepath.Join(tmpDir, "k8s", "deploy.sh"))
	if err != nil {
		t.Fatalf("failed to read k8s deploy script: %v", err)
	}
	if !contains(string(k8sData), "kubectl apply -k k8s") {
		t.Fatal("expected k8s deploy command")
	}
}

func TestWriteDeployScriptsComposeOnly(t *testing.T) {
	tmpDir := t.TempDir()
	writer := NewWriter(tmpDir)

	err := writer.WriteDeployScripts([]domain.Target{domain.TargetCompose})
	if err != nil {
		t.Fatalf("failed to write deploy scripts: %v", err)
	}

	rootData, err := os.ReadFile(filepath.Join(tmpDir, "deploy.sh"))
	if err != nil {
		t.Fatalf("failed to read root deploy script: %v", err)
	}
	rootContent := string(rootData)
	if !contains(rootContent, `TARGET="${1:-compose}"`) {
		t.Fatal("expected root deploy script to default to compose")
	}
	if contains(rootContent, `"$ROOT_DIR/k8s/deploy.sh"`) {
		t.Fatal("did not expect k8s deploy delegation in compose-only output")
	}
	if _, err := os.Stat(filepath.Join(tmpDir, "k8s", "deploy.sh")); !os.IsNotExist(err) {
		t.Fatal("did not expect k8s deploy script in compose-only output")
	}
	if !contains(rootContent, "*)\n  usage\n  exit 1") {
		t.Fatal("expected compose-only output to reject unknown targets")
	}
}

func TestWriteDeployScriptsRejectUnknownTargets(t *testing.T) {
	tmpDir := t.TempDir()
	writer := NewWriter(tmpDir)

	err := writer.WriteDeployScripts([]domain.Target{domain.TargetCompose, domain.TargetK8s})
	if err != nil {
		t.Fatalf("failed to write deploy scripts: %v", err)
	}

	rootData, err := os.ReadFile(filepath.Join(tmpDir, "deploy.sh"))
	if err != nil {
		t.Fatalf("failed to read root deploy script: %v", err)
	}

	if !contains(string(rootData), "*)\n  usage\n  exit 1") {
		t.Fatal("expected unknown targets to be rejected")
	}
}

func contains(haystack, needle string) bool {
	return strings.Contains(haystack, needle)
}

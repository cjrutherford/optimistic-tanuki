package configurator

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/catalog"
	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/output"
)

func TestGenerateEnvironmentWritesComposeAndK8sOutputs(t *testing.T) {
	env := DefaultEnvironment()
	env.Name = "test-env"
	env.OutputDir = t.TempDir()

	result, err := GenerateEnvironment(env, catalog.DefaultCatalog(), output.NewWriter(env.OutputDir))
	if err != nil {
		t.Fatalf("GenerateEnvironment() error = %v", err)
	}

	if result.ComposePath == "" {
		t.Fatal("expected compose output path")
	}
	if result.K8sPath == "" {
		t.Fatal("expected k8s output path")
	}
	if result.DeployScript == "" {
		t.Fatal("expected deploy script path")
	}

	if _, err := os.Stat(filepath.Join(env.OutputDir, result.ComposePath)); err != nil {
		t.Fatalf("expected compose file to exist: %v", err)
	}
	if _, err := os.Stat(filepath.Join(env.OutputDir, result.K8sPath)); err != nil {
		t.Fatalf("expected k8s file to exist: %v", err)
	}
	if _, err := os.Stat(filepath.Join(env.OutputDir, "compose", "fragments", "docker-compose.base.yaml")); err != nil {
		t.Fatalf("expected compose base fragment to exist: %v", err)
	}
	if _, err := os.Stat(filepath.Join(env.OutputDir, "k8s", "base", "kustomization.yaml")); err != nil {
		t.Fatalf("expected k8s base kustomization to exist: %v", err)
	}
	if _, err := os.Stat(filepath.Join(env.OutputDir, result.DeployScript)); err != nil {
		t.Fatalf("expected root deploy script to exist: %v", err)
	}
	if _, err := os.Stat(filepath.Join(env.OutputDir, "compose", "deploy.sh")); err != nil {
		t.Fatalf("expected compose deploy script to exist: %v", err)
	}
	if _, err := os.Stat(filepath.Join(env.OutputDir, "k8s", "deploy.sh")); err != nil {
		t.Fatalf("expected k8s deploy script to exist: %v", err)
	}
}

func TestGenerateEnvironmentValidatesInput(t *testing.T) {
	env := DefaultEnvironment()
	env.Name = ""

	if _, err := GenerateEnvironment(env, catalog.DefaultCatalog(), output.NewWriter(t.TempDir())); err == nil {
		t.Fatal("expected validation error")
	}
}

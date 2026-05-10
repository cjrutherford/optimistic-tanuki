package configurator

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/catalog"
	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/output"
)

func TestGenerateWorkspaceWritesOutputsForMultipleDeployments(t *testing.T) {
	workspace := &WorkspaceDefinition{
		Deployments: []DeploymentConfig{
			{
				Name:         "client-a",
				Provider:     "vultr",
				Capabilities: []string{"community"},
				Targets:      []string{"compose", "k8s"},
			},
			{
				Name:         "client-b",
				Provider:     "oci",
				Capabilities: []string{"knowledge"},
				Targets:      []string{"k8s"},
			},
		},
	}

	result, err := GenerateWorkspace(
		workspace,
		catalog.DefaultCatalog(),
		output.NewWriter(t.TempDir()),
	)
	if err != nil {
		t.Fatalf("GenerateWorkspace() error = %v", err)
	}

	if len(result.Deployments) != 2 {
		t.Fatalf("expected 2 deployment results, got %d", len(result.Deployments))
	}

	for _, name := range []string{"client-a", "client-b"} {
		gatewayPath := filepath.Join(result.OutputDir, name, "gateway", "composition.yaml")
		if _, err := os.Stat(gatewayPath); err != nil {
			t.Fatalf("expected gateway composition for %s: %v", name, err)
		}
	}
}

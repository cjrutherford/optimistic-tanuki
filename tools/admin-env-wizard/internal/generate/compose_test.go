package generate

import (
	"strings"
	"testing"

	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/catalog"
	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/domain"
)

func fixtureEnvironment(mode domain.ComposeMode) *domain.EnvironmentDefinition {
	return &domain.EnvironmentDefinition{
		Name:         "test-env",
		Namespace:    "optimistic-tanuki",
		Targets:      []domain.Target{domain.TargetCompose},
		ComposeMode:  mode,
		ImageOwner:   "cjrutherford",
		DefaultTag:   "sha-demo",
		IncludeInfra: []domain.InfraKind{domain.InfraPostgres, domain.InfraRedis},
		Services: []domain.ServiceSelection{
			{ServiceID: "gateway", Enabled: true},
			{ServiceID: "authentication", Enabled: true},
		},
	}
}

func TestComposeGeneratorImageMode(t *testing.T) {
	env := fixtureEnvironment(domain.ComposeModeImage)
	cat := catalog.DefaultCatalog()

	yaml, err := GenerateCompose(env, cat)
	if err != nil {
		t.Fatalf("failed to generate compose: %v", err)
	}

	t.Logf("Generated YAML:\n%s", string(yaml))

	if !strings.Contains(string(yaml), "image:") {
		t.Fatal("expected image reference")
	}
}

func TestComposeGeneratorBuildMode(t *testing.T) {
	env := fixtureEnvironment(domain.ComposeModeBuild)
	cat := catalog.DefaultCatalog()

	yaml, err := GenerateCompose(env, cat)
	if err != nil {
		t.Fatalf("failed to generate compose: %v", err)
	}

	if !strings.Contains(string(yaml), "build:") {
		t.Fatal("expected build section in output")
	}
	if !strings.Contains(string(yaml), "context: .") {
		t.Fatal("expected build context")
	}
}

func TestComposeGeneratorInfraIncluded(t *testing.T) {
	env := fixtureEnvironment(domain.ComposeModeImage)
	cat := catalog.DefaultCatalog()

	yaml, err := GenerateCompose(env, cat)
	if err != nil {
		t.Fatalf("failed to generate compose: %v", err)
	}

	if !strings.Contains(string(yaml), "postgres:") {
		t.Fatal("expected postgres service")
	}
	if !strings.Contains(string(yaml), "redis:") {
		t.Fatal("expected redis service")
	}
}

func TestComposeGeneratorDependsOn(t *testing.T) {
	env := fixtureEnvironment(domain.ComposeModeImage)
	cat := catalog.DefaultCatalog()

	yaml, err := GenerateCompose(env, cat)
	if err != nil {
		t.Fatalf("failed to generate compose: %v", err)
	}

	if !strings.Contains(string(yaml), "depends_on:") {
		t.Fatal("expected depends_on in output")
	}
}

func TestComposeGeneratorVolumes(t *testing.T) {
	env := fixtureEnvironment(domain.ComposeModeImage)
	env.IncludeInfra = []domain.InfraKind{domain.InfraPostgres}
	cat := catalog.DefaultCatalog()

	yaml, err := GenerateCompose(env, cat)
	if err != nil {
		t.Fatalf("failed to generate compose: %v", err)
	}

	if !strings.Contains(string(yaml), "postgres_data:") {
		t.Fatal("expected postgres_data volume")
	}
}

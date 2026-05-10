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

func TestComposeGeneratorMountsGatewayComposition(t *testing.T) {
	env := fixtureEnvironment(domain.ComposeModeImage)
	cat := catalog.DefaultCatalog()

	yaml, err := GenerateCompose(env, cat)
	if err != nil {
		t.Fatalf("failed to generate compose: %v", err)
	}

	if !strings.Contains(string(yaml), "GATEWAY_COMPOSITION_PATH") {
		t.Fatal("expected gateway composition env var")
	}
	if !strings.Contains(string(yaml), "../gateway:/etc/optimistic-tanuki/gateway:ro") {
		t.Fatal("expected gateway composition mount")
	}
}

func TestComposeGeneratorUsesRepoRelativeBuildContextFromOutputDirectory(t *testing.T) {
	env := fixtureEnvironment(domain.ComposeModeBuild)
	cat := catalog.DefaultCatalog()

	yaml, err := GenerateCompose(env, cat)
	if err != nil {
		t.Fatalf("failed to generate compose: %v", err)
	}

	if !strings.Contains(string(yaml), "context: ../../..") {
		t.Fatal("expected repo-relative build context")
	}
}

func TestComposeGeneratorCreatesFragments(t *testing.T) {
	env := fixtureEnvironment(domain.ComposeModeImage)
	cat := catalog.DefaultCatalog()

	files, err := GenerateComposeFiles(env, cat)
	if err != nil {
		t.Fatalf("failed to generate compose files: %v", err)
	}

	if _, ok := files["docker-compose.yaml"]; !ok {
		t.Fatal("expected resolved compose file")
	}
	if _, ok := files["fragments/docker-compose.base.yaml"]; !ok {
		t.Fatal("expected base compose fragment")
	}
	if _, ok := files["fragments/docker-compose.provider.yaml"]; !ok {
		t.Fatal("expected provider compose fragment")
	}
	if _, ok := files["fragments/docker-compose.capabilities.yaml"]; !ok {
		t.Fatal("expected capability compose fragment")
	}
}

func TestComposeGeneratorProviderFragmentContainsReusableProviderTuning(t *testing.T) {
	env := fixtureEnvironment(domain.ComposeModeImage)
	env.Provider = domain.ProviderVultr
	cat := catalog.DefaultCatalog()

	files, err := GenerateComposeFiles(env, cat)
	if err != nil {
		t.Fatalf("failed to generate compose files: %v", err)
	}

	providerFragment := string(files["fragments/docker-compose.provider.yaml"])
	if !strings.Contains(providerFragment, "optimistic-tanuki.profile: vultr") {
		t.Fatal("expected provider profile label in compose fragment")
	}
	if !strings.Contains(providerFragment, "cpus: \"1.50\"") {
		t.Fatal("expected provider cpu tuning in compose fragment")
	}
	if !strings.Contains(providerFragment, "memory: 1536M") {
		t.Fatal("expected provider memory tuning in compose fragment")
	}
	if !strings.Contains(providerFragment, "replicas: 3") {
		t.Fatal("expected provider replica tuning in compose fragment")
	}
	if !strings.Contains(providerFragment, "restart: unless-stopped") {
		t.Fatal("expected provider restart tuning in compose fragment")
	}
	if !strings.Contains(providerFragment, "memory: 1024M") {
		t.Fatal("expected provider reservation tuning in compose fragment")
	}
}

func TestComposeGeneratorAppliesProviderTuningToResolvedServices(t *testing.T) {
	env := fixtureEnvironment(domain.ComposeModeImage)
	env.Provider = domain.ProviderOCI
	env.Services = append(env.Services, domain.ServiceSelection{ServiceID: "profile", Enabled: true})
	cat := catalog.DefaultCatalog()

	yaml, err := GenerateCompose(env, cat)
	if err != nil {
		t.Fatalf("failed to generate compose: %v", err)
	}

	output := string(yaml)
	if !strings.Contains(output, "restart: unless-stopped") {
		t.Fatal("expected provider restart policy in resolved compose")
	}
	if !strings.Contains(output, "container_name: ot_profile") {
		t.Fatal("expected profile service in resolved compose")
	}
}

func TestComposeGeneratorAppliesWorkloadSpecificProviderProfiles(t *testing.T) {
	env := fixtureEnvironment(domain.ComposeModeImage)
	env.Provider = domain.ProviderOCI
	env.Services = []domain.ServiceSelection{
		{ServiceID: "gateway", Enabled: true},
		{ServiceID: "social", Enabled: true},
		{ServiceID: "store", Enabled: true},
		{ServiceID: "permissions", Enabled: true},
		{ServiceID: "blogging", Enabled: true},
		{ServiceID: "wellness", Enabled: true},
	}
	cat := catalog.DefaultCatalog()

	files, err := GenerateComposeFiles(env, cat)
	if err != nil {
		t.Fatalf("failed to generate compose files: %v", err)
	}

	providerFragment := string(files["fragments/docker-compose.provider.yaml"])
	if !strings.Contains(providerFragment, "social:") || !strings.Contains(providerFragment, "memory: 1280M") {
		t.Fatal("expected social-specific tuning in provider fragment")
	}
	if !strings.Contains(providerFragment, "store:") || !strings.Contains(providerFragment, "cpus: \"1.25\"") {
		t.Fatal("expected store-specific tuning in provider fragment")
	}
	if !strings.Contains(providerFragment, "permissions:") || !strings.Contains(providerFragment, "memory: 640M") {
		t.Fatal("expected permissions-specific tuning in provider fragment")
	}
	if !strings.Contains(providerFragment, "blogging:") || !strings.Contains(providerFragment, "replicas: 3") {
		t.Fatal("expected blogging-specific tuning in provider fragment")
	}
	if !strings.Contains(providerFragment, "wellness:") || !strings.Contains(providerFragment, "memory: 896M") {
		t.Fatal("expected wellness-specific tuning in provider fragment")
	}
}

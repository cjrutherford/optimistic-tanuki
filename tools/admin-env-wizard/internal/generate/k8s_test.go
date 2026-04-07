package generate

import (
	"strings"
	"testing"

	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/catalog"
	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/domain"
)

func fixtureEnvironmentK8s() *domain.EnvironmentDefinition {
	return &domain.EnvironmentDefinition{
		Name:         "test-env",
		Namespace:    "optimistic-tanuki",
		Targets:      []domain.Target{domain.TargetK8s},
		ImageOwner:   "cjrutherford",
		DefaultTag:   "sha-demo",
		IncludeInfra: []domain.InfraKind{domain.InfraPostgres, domain.InfraRedis},
		Services: []domain.ServiceSelection{
			{ServiceID: "gateway", Enabled: true},
			{ServiceID: "authentication", Enabled: true},
		},
	}
}

func TestK8sGeneratorWritesKustomizeBundle(t *testing.T) {
	env := fixtureEnvironmentK8s()
	cat := catalog.DefaultCatalog()

	files, err := GenerateK8s(env, cat)
	if err != nil {
		t.Fatalf("failed to generate k8s: %v", err)
	}

	if _, ok := files["kustomization.yaml"]; !ok {
		t.Fatal("expected kustomization.yaml")
	}

	if _, ok := files["namespace.yaml"]; !ok {
		t.Fatal("expected namespace.yaml")
	}
}

func TestK8sGeneratorNamespace(t *testing.T) {
	env := fixtureEnvironmentK8s()
	env.Namespace = "custom-ns"
	cat := catalog.DefaultCatalog()

	files, err := GenerateK8s(env, cat)
	if err != nil {
		t.Fatalf("failed to generate k8s: %v", err)
	}

	if !strings.Contains(string(files["namespace.yaml"]), "custom-ns") {
		t.Fatal("expected custom-ns in namespace")
	}
}

func TestK8sGeneratorInfraResources(t *testing.T) {
	env := fixtureEnvironmentK8s()
	cat := catalog.DefaultCatalog()

	files, err := GenerateK8s(env, cat)
	if err != nil {
		t.Fatalf("failed to generate k8s: %v", err)
	}

	hasPVC := false
	for name := range files {
		if strings.Contains(name, "pvc") {
			hasPVC = true
		}
	}
	if !hasPVC {
		t.Fatal("expected PVC for postgres")
	}
}

func TestK8sGeneratorServiceDeployment(t *testing.T) {
	env := fixtureEnvironmentK8s()
	cat := catalog.DefaultCatalog()

	files, err := GenerateK8s(env, cat)
	if err != nil {
		t.Fatalf("failed to generate k8s: %v", err)
	}

	found := false
	for name := range files {
		if strings.Contains(name, "gateway.yaml") {
			found = true
			break
		}
	}
	if !found {
		t.Fatal("expected gateway deployment")
	}
}

func TestK8sGeneratorService(t *testing.T) {
	env := fixtureEnvironmentK8s()
	cat := catalog.DefaultCatalog()

	files, err := GenerateK8s(env, cat)
	if err != nil {
		t.Fatalf("failed to generate k8s: %v", err)
	}

	found := false
	for name := range files {
		if strings.Contains(name, "gateway-service") {
			found = true
			break
		}
	}
	if !found {
		t.Fatal("expected gateway service")
	}
}

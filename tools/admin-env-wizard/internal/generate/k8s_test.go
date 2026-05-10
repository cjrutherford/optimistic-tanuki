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

	if _, ok := files["base/kustomization.yaml"]; !ok {
		t.Fatal("expected base/kustomization.yaml")
	}

	if _, ok := files["base/namespace.yaml"]; !ok {
		t.Fatal("expected base/namespace.yaml")
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

	if !strings.Contains(string(files["base/namespace.yaml"]), "custom-ns") {
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

func TestK8sGeneratorCreatesGatewayCompositionConfigMap(t *testing.T) {
	env := fixtureEnvironmentK8s()
	env.Provider = domain.ProviderOCI
	env.Capabilities = []string{"community"}
	cat := catalog.DefaultCatalog()

	files, err := GenerateK8s(env, cat)
	if err != nil {
		t.Fatalf("failed to generate k8s: %v", err)
	}

	if _, ok := files["base/gateway-composition-configmap.yaml"]; !ok {
		t.Fatal("expected gateway composition configmap")
	}
}

func TestK8sGeneratorCreatesProviderOverlay(t *testing.T) {
	env := fixtureEnvironmentK8s()
	env.Provider = domain.ProviderVultr
	cat := catalog.DefaultCatalog()

	files, err := GenerateK8s(env, cat)
	if err != nil {
		t.Fatalf("failed to generate k8s: %v", err)
	}

	if _, ok := files["overlays/vultr/kustomization.yaml"]; !ok {
		t.Fatal("expected vultr overlay kustomization")
	}
	if _, ok := files["overlays/vultr/provider-patch.yaml"]; !ok {
		t.Fatal("expected vultr provider patch")
	}
	if !strings.Contains(string(files["kustomization.yaml"]), "overlays/vultr") {
		t.Fatal("expected root kustomization to reference provider overlay")
	}
	if strings.Contains(string(files["kustomization.yaml"]), "\n- base\n") {
		t.Fatal("did not expect root kustomization to reference base directly")
	}
	if !strings.Contains(string(files["overlays/vultr/kustomization.yaml"]), "provider-patch.yaml") {
		t.Fatal("expected provider overlay to reference provider patch")
	}
	if !strings.Contains(string(files["overlays/vultr/kustomization.yaml"]), "../../base") {
		t.Fatal("expected provider overlay to reference base resources")
	}
}

func TestK8sGeneratorProviderOverlayContainsStorageAndServiceTuning(t *testing.T) {
	env := fixtureEnvironmentK8s()
	env.Provider = domain.ProviderOCI
	cat := catalog.DefaultCatalog()

	files, err := GenerateK8s(env, cat)
	if err != nil {
		t.Fatalf("failed to generate k8s: %v", err)
	}

	patch := string(files["overlays/oci/provider-patch.yaml"])
	if !strings.Contains(patch, "storageClassName: oci-bv") {
		t.Fatal("expected oci storage class tuning")
	}
	if !strings.Contains(patch, "service.beta.kubernetes.io/oci-load-balancer-shape: flexible") {
		t.Fatal("expected oci gateway service annotation")
	}
	if !strings.Contains(patch, "memory: 1536Mi") {
		t.Fatal("expected oci workload memory tuning")
	}
	if !strings.Contains(patch, "replicas: 3") {
		t.Fatal("expected oci replica tuning")
	}
	if !strings.Contains(patch, "cpu: 1000m") {
		t.Fatal("expected oci request cpu tuning")
	}
	if !strings.Contains(patch, "initialDelaySeconds: 45") {
		t.Fatal("expected oci probe tuning")
	}
	if !strings.Contains(patch, "storage: 120Gi") {
		t.Fatal("expected oci storage sizing")
	}
}

func TestK8sGeneratorAppliesProviderTuningToBaseServiceDeployments(t *testing.T) {
	env := fixtureEnvironmentK8s()
	env.Provider = domain.ProviderOCI
	env.Services = append(env.Services, domain.ServiceSelection{ServiceID: "profile", Enabled: true})
	cat := catalog.DefaultCatalog()

	files, err := GenerateK8s(env, cat)
	if err != nil {
		t.Fatalf("failed to generate k8s: %v", err)
	}

	profileDeployment := string(files["base/profile.yaml"])
	if !strings.Contains(profileDeployment, "replicas: 2") {
		t.Fatal("expected provider replicas in base profile deployment")
	}
	if !strings.Contains(profileDeployment, "memory: 512Mi") {
		t.Fatal("expected provider request memory in base profile deployment")
	}
	if !strings.Contains(profileDeployment, "cpu: 500m") {
		t.Fatal("expected provider cpu tuning in base profile deployment")
	}
}

func TestK8sGeneratorAppliesWorkloadSpecificProfilesToBaseDeployments(t *testing.T) {
	env := fixtureEnvironmentK8s()
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

	files, err := GenerateK8s(env, cat)
	if err != nil {
		t.Fatalf("failed to generate k8s: %v", err)
	}

	assertContains := func(name, pattern string) {
		t.Helper()
		if !strings.Contains(string(files[name]), pattern) {
			t.Fatalf("expected %s to contain %q", name, pattern)
		}
	}

	assertContains("base/social.yaml", "memory: 1280Mi")
	assertContains("base/social.yaml", "replicas: 3")
	assertContains("base/store.yaml", "cpu: 1250m")
	assertContains("base/permissions.yaml", "memory: 640Mi")
	assertContains("base/blogging.yaml", "replicas: 3")
	assertContains("base/wellness.yaml", "memory: 896Mi")
}

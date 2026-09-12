package generate

import (
	"strings"
	"testing"

	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/catalog"
	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/domain"
	"gopkg.in/yaml.v3"
)

func sandboxEnvironment() *domain.EnvironmentDefinition {
	return &domain.EnvironmentDefinition{
		Name:         "test-env",
		Namespace:    "optimistic-tanuki",
		Targets:      []domain.Target{domain.TargetK8s, domain.TargetCompose},
		ImageOwner:   "cjrutherford",
		DefaultTag:   "sha-demo",
		IncludeInfra: []domain.InfraKind{domain.InfraPostgres},
		Services: []domain.ServiceSelection{
			{ServiceID: "learning-service", Enabled: true},
			{ServiceID: "learning-runner", Enabled: true},
		},
	}
}

// The runner executes code submitted by learners. A generated manifest that
// drops any of these is not a weaker deployment, it is an unconfined one, so
// each is asserted individually rather than as one golden blob.
func TestSandboxedWorkloadKeepsItsConfinement(t *testing.T) {
	files, err := GenerateK8s(sandboxEnvironment(), catalog.DefaultCatalog())
	if err != nil {
		t.Fatalf("failed to generate k8s: %v", err)
	}

	manifest, ok := files["base/learning-runner.yaml"]
	if !ok {
		t.Fatal("expected base/learning-runner.yaml")
	}
	rendered := string(manifest)

	for _, required := range []string{
		"readOnlyRootFilesystem: true",
		"allowPrivilegeEscalation: false",
		"runAsNonRoot: true",
		"runAsUser: 1000",
		"type: RuntimeDefault",
		"automountServiceAccountToken: false",
		"- ALL",
		"memory: 1Gi",
		"medium: Memory",
		"sizeLimit: 512Mi",
		"mountPath: /scratch",
		"sizeLimit: 16Mi",
		"mountPath: /tmp",
	} {
		if !strings.Contains(rendered, required) {
			t.Errorf("generated runner manifest is missing %q:\n%s", required, rendered)
		}
	}

	// pids_limit has no pod-level equivalent, so it has to be surfaced to the
	// operator rather than dropped in silence.
	if !strings.Contains(rendered, "pod-max-pids") {
		t.Error("expected the manifest to tell the operator about --pod-max-pids")
	}
}

func TestSandboxedWorkloadGetsAnIsolationPolicy(t *testing.T) {
	files, err := GenerateK8s(sandboxEnvironment(), catalog.DefaultCatalog())
	if err != nil {
		t.Fatalf("failed to generate k8s: %v", err)
	}

	policy, ok := files["base/learning-runner-networkpolicy.yaml"]
	if !ok {
		t.Fatal("expected base/learning-runner-networkpolicy.yaml")
	}
	rendered := string(policy)

	if !strings.Contains(rendered, "egress: []") {
		t.Errorf("expected an empty egress list, which denies all outbound traffic:\n%s", rendered)
	}
	if !strings.Contains(rendered, "app: learning-service") {
		t.Errorf("expected learning-service to be the only permitted caller:\n%s", rendered)
	}
	if !strings.Contains(rendered, "port: 3025") {
		t.Errorf("expected ingress to be limited to the runner's port:\n%s", rendered)
	}
}

func TestSandboxedWorkloadIsInTheKustomization(t *testing.T) {
	files, err := GenerateK8s(sandboxEnvironment(), catalog.DefaultCatalog())
	if err != nil {
		t.Fatalf("failed to generate k8s: %v", err)
	}

	kustomization := string(files["base/kustomization.yaml"])
	for _, resource := range []string{
		"learning-runner.yaml",
		"learning-runner-service.yaml",
		"learning-runner-networkpolicy.yaml",
	} {
		if !strings.Contains(kustomization, resource) {
			t.Errorf("expected %s in the base kustomization:\n%s", resource, kustomization)
		}
	}
}

func TestSandboxedWorkloadIsConfinedInCompose(t *testing.T) {
	data, err := GenerateCompose(sandboxEnvironment(), catalog.DefaultCatalog())
	if err != nil {
		t.Fatalf("failed to generate compose: %v", err)
	}
	rendered := string(data)

	for _, required := range []string{
		"read_only: true",
		"no-new-privileges:true",
		"pids_limit: 256",
		"mem_limit: 1g",
		"/scratch:size=512m,exec,nosuid,nodev,mode=1777",
		"/tmp:size=16m,noexec,nosuid",
		"internal: true",
	} {
		if !strings.Contains(rendered, required) {
			t.Errorf("generated compose is missing %q:\n%s", required, rendered)
		}
	}
}

func TestSandboxedWorkloadPublishesNoHostPort(t *testing.T) {
	data, err := GenerateCompose(sandboxEnvironment(), catalog.DefaultCatalog())
	if err != nil {
		t.Fatalf("failed to generate compose: %v", err)
	}

	if strings.Contains(string(data), "3025:3025") {
		t.Errorf("the runner must not be published to the host:\n%s", string(data))
	}
}

// The caller has to keep its route to the rest of the stack, or joining the
// internal network cuts it off from the gateway and the database.
func TestSandboxCallerJoinsBothNetworks(t *testing.T) {
	data, err := GenerateCompose(sandboxEnvironment(), catalog.DefaultCatalog())
	if err != nil {
		t.Fatalf("failed to generate compose: %v", err)
	}

	var compose struct {
		Services map[string]struct {
			Networks []string `yaml:"networks"`
		} `yaml:"services"`
	}
	if err := yaml.Unmarshal(data, &compose); err != nil {
		t.Fatalf("failed to parse generated compose: %v", err)
	}

	caller := compose.Services["learning-service"].Networks
	if len(caller) != 2 || caller[0] != "default" || caller[1] != "learning-internal" {
		t.Errorf("expected learning-service on [default learning-internal], got %v", caller)
	}

	runner := compose.Services["learning-runner"].Networks
	if len(runner) != 1 || runner[0] != "learning-internal" {
		t.Errorf("expected learning-runner on [learning-internal] only, got %v", runner)
	}
}

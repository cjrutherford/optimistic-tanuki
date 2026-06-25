package apply

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

type mockRunner struct {
	err     error
	called  bool
	envRuns []envRun
}

func (m *mockRunner) Run(ctx context.Context, name string, args ...string) error {
	m.called = true
	if m.err != nil {
		return m.err
	}
	return nil
}

func (m *mockRunner) RunEnv(ctx context.Context, env map[string]string, name string, args ...string) error {
	m.called = true
	m.envRuns = append(m.envRuns, envRun{name: name, args: append([]string(nil), args...), env: env})
	if m.err != nil {
		return m.err
	}
	return nil
}

type envRun struct {
	name string
	args []string
	env  map[string]string
}

func TestApplyCompose(t *testing.T) {
	runner := &mockRunner{}
	opts := ApplyOptions{
		ComposeFile: "/path/to/docker-compose.yaml",
		DryRun:      true,
	}

	err := ApplyCompose(runner, opts)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !runner.called {
		t.Error("expected runner to be called")
	}
}

func TestApplyComposeNoFile(t *testing.T) {
	runner := &mockRunner{}
	opts := ApplyOptions{
		ComposeFile: "",
	}

	err := ApplyCompose(runner, opts)
	if err == nil {
		t.Fatal("expected error for empty compose file")
	}
}

func TestApplyK8s(t *testing.T) {
	runner := &mockRunner{}
	opts := ApplyOptions{
		K8sDir: "/path/to/k8s",
		DryRun: true,
	}

	err := ApplyK8s(runner, opts)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !runner.called {
		t.Error("expected runner to be called")
	}
}

func TestApplyK8sNoDir(t *testing.T) {
	runner := &mockRunner{}
	opts := ApplyOptions{
		K8sDir: "",
	}

	err := ApplyK8s(runner, opts)
	if err == nil {
		t.Fatal("expected error for empty k8s dir")
	}
}

func TestApplyComposeError(t *testing.T) {
	runner := &mockRunner{err: errors.New("docker error")}
	opts := ApplyOptions{
		ComposeFile: "/path/to/docker-compose.yaml",
	}

	err := ApplyCompose(runner, opts)
	if err == nil {
		t.Fatal("expected error to propagate")
	}
}

func TestComposeRolloutExecutesDeploymentScriptWithRolloutEnv(t *testing.T) {
	runner := &mockRunner{}
	statePath := filepath.Join(t.TempDir(), "rollout-state.json")

	result, err := ExecuteComposeRollout(runner, ComposeRolloutOptions{
		DeploymentName: "production",
		ProjectDir:     "/workspace",
		ScriptPath:     "/workspace/scripts/docker-compose-deploy.sh",
		Services:       []string{"gateway", "authentication", "owner-console", "store", "permissions"},
		TargetTag:      "sha-next",
		BatchSize:      2,
		StatePath:      statePath,
	})
	if err != nil {
		t.Fatalf("ExecuteComposeRollout() error = %v", err)
	}

	if result.Status != RolloutStatusSucceeded {
		t.Fatalf("expected succeeded rollout status, got %s", result.Status)
	}
	if len(runner.envRuns) != 1 {
		t.Fatalf("expected 1 scripted rollout invocation, got %d", len(runner.envRuns))
	}
	if got := runner.envRuns[0].env["PRODUCTION_IMAGE_TAG"]; got != "sha-next" {
		t.Fatalf("expected rollout tag in env, got %q", got)
	}
	if got := runner.envRuns[0].env["DOCKER_PULL_BATCH_SIZE"]; got != "2" {
		t.Fatalf("expected batch size env, got %q", got)
	}
	if joined := strings.Join(runner.envRuns[0].args, " "); !strings.Contains(joined, "/workspace/scripts/docker-compose-deploy.sh") {
		t.Fatalf("expected deployment script invocation, got %q", joined)
	}
	if _, err := os.Stat(statePath); err != nil {
		t.Fatalf("expected rollout state file, got %v", err)
	}
	if len(result.Waves) != 3 {
		t.Fatalf("expected 3 rollout waves, got %d", len(result.Waves))
	}
}

func TestReadRolloutState(t *testing.T) {
	statePath := filepath.Join(t.TempDir(), "rollout-state.json")
	source := RolloutState{
		DeploymentName: "production",
		TargetTag:      "sha-next",
		Status:         RolloutStatusSucceeded,
	}
	if err := WriteRolloutState(statePath, source); err != nil {
		t.Fatalf("WriteRolloutState() error = %v", err)
	}

	loaded, err := ReadRolloutState(statePath)
	if err != nil {
		t.Fatalf("ReadRolloutState() error = %v", err)
	}
	if loaded.TargetTag != "sha-next" {
		t.Fatalf("expected target tag to round-trip, got %q", loaded.TargetTag)
	}
}

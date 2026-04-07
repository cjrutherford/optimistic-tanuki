package apply

import (
	"context"
	"errors"
	"testing"
)

type mockRunner struct {
	err    error
	called bool
}

func (m *mockRunner) Run(ctx context.Context, name string, args ...string) error {
	m.called = true
	if m.err != nil {
		return m.err
	}
	return nil
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

package apply

import (
	"context"
	"fmt"
	"os/exec"
)

type Runner interface {
	Run(ctx context.Context, name string, args ...string) error
}

type CommandRunner struct{}

func (c *CommandRunner) Run(ctx context.Context, name string, args ...string) error {
	cmd := exec.CommandContext(ctx, name, args...)
	return cmd.Run()
}

type ApplyOptions struct {
	ComposeFile string
	K8sDir      string
	DryRun      bool
}

func ApplyCompose(runner Runner, opts ApplyOptions) error {
	if opts.ComposeFile == "" {
		return fmt.Errorf("compose file path required")
	}

	args := []string{"compose", "-f", opts.ComposeFile, "up", "-d"}

	if opts.DryRun {
		args = append(args, "--dry-run")
	}

	return runner.Run(context.Background(), "docker", args...)
}

func ApplyK8s(runner Runner, opts ApplyOptions) error {
	if opts.K8sDir == "" {
		return fmt.Errorf("k8s directory path required")
	}

	args := []string{"apply", "-k", opts.K8sDir}

	if opts.DryRun {
		args = append(args, "--dry-run=client")
	}

	return runner.Run(context.Background(), "kubectl", args...)
}

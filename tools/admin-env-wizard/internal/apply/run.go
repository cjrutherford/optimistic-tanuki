package apply

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"time"
)

type Runner interface {
	Run(ctx context.Context, name string, args ...string) error
	RunEnv(ctx context.Context, env map[string]string, name string, args ...string) error
}

type CommandRunner struct{}

func (c *CommandRunner) Run(ctx context.Context, name string, args ...string) error {
	cmd := exec.CommandContext(ctx, name, args...)
	return cmd.Run()
}

func (c *CommandRunner) RunEnv(ctx context.Context, env map[string]string, name string, args ...string) error {
	cmd := exec.CommandContext(ctx, name, args...)
	cmd.Env = os.Environ()
	for key, value := range env {
		cmd.Env = append(cmd.Env, fmt.Sprintf("%s=%s", key, value))
	}
	return cmd.Run()
}

type ApplyOptions struct {
	ComposeFile string
	K8sDir      string
	DryRun      bool
}

type ComposeRolloutOptions struct {
	DeploymentName string
	ProjectDir     string
	ScriptPath     string
	ComposeEnvFile string
	TargetTag      string
	RollbackTag    string
	BatchSize      int
	Services       []string
	StatePath      string
}

type HealthCheckOptions struct {
	URL           string
	Interval      time.Duration
	Timeout       time.Duration
	MaxRetries    int
}

type RolloutState struct {
	DeploymentName string        `json:"deploymentName"`
	TargetTag      string        `json:"targetTag"`
	RollbackTag    string        `json:"rollbackTag,omitempty"`
	Status         RolloutStatus `json:"status"`
	BatchSize      int           `json:"batchSize"`
	Services       []string      `json:"services"`
	Waves          [][]string    `json:"waves"`
	StartedAt      time.Time     `json:"startedAt"`
	CompletedAt    *time.Time    `json:"completedAt,omitempty"`
	Error          string        `json:"error,omitempty"`
	HealthChecked  bool          `json:"healthChecked,omitempty"`
}

type RolloutStatus string

const (
	RolloutStatusPending   RolloutStatus = "pending"
	RolloutStatusRunning   RolloutStatus = "running"
	RolloutStatusSucceeded RolloutStatus = "succeeded"
	RolloutStatusFailed    RolloutStatus = "failed"
)

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

func WaitForHealthy(opts HealthCheckOptions) error {
	if opts.URL == "" {
		return nil
	}
	if opts.Interval == 0 {
		opts.Interval = 5 * time.Second
	}
	if opts.Timeout == 0 {
		opts.Timeout = 60 * time.Second
	}
	if opts.MaxRetries == 0 {
		opts.MaxRetries = 12
	}

	client := &http.Client{Timeout: 5 * time.Second}
	deadline := time.Now().Add(opts.Timeout)

	for i := 0; i < opts.MaxRetries; i++ {
		if time.Now().After(deadline) {
			return fmt.Errorf("health check timed out after %v", opts.Timeout)
		}

		resp, err := client.Get(opts.URL)
		if err == nil {
			resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				return nil
			}
		}

		time.Sleep(opts.Interval)
	}

	return fmt.Errorf("health check failed after %d retries", opts.MaxRetries)
}

func ExecuteComposeRollout(runner Runner, opts ComposeRolloutOptions) (RolloutState, error) {
	if runner == nil {
		return RolloutState{}, fmt.Errorf("runner required")
	}
	if opts.DeploymentName == "" {
		return RolloutState{}, fmt.Errorf("deployment name required")
	}
	if opts.ProjectDir == "" {
		return RolloutState{}, fmt.Errorf("project dir required")
	}
	if opts.ScriptPath == "" {
		return RolloutState{}, fmt.Errorf("script path required")
	}
	if opts.TargetTag == "" {
		return RolloutState{}, fmt.Errorf("target tag required")
	}
	if opts.BatchSize < 1 {
		opts.BatchSize = 4
	}

	now := time.Now().UTC()
	state := RolloutState{
		DeploymentName: opts.DeploymentName,
		TargetTag:      opts.TargetTag,
		RollbackTag:    opts.RollbackTag,
		Status:         RolloutStatusRunning,
		BatchSize:      opts.BatchSize,
		Services:       append([]string(nil), opts.Services...),
		Waves:          buildRolloutWaves(opts.Services, opts.BatchSize),
		StartedAt:      now,
	}
	if opts.StatePath != "" {
		if err := WriteRolloutState(opts.StatePath, state); err != nil {
			return state, err
		}
	}

	env := map[string]string{
		"PRODUCTION_IMAGE_TAG":   opts.TargetTag,
		"DOCKER_PULL_BATCH_SIZE": fmt.Sprintf("%d", opts.BatchSize),
	}
	if opts.ComposeEnvFile != "" {
		env["COMPOSE_ENV_FILE"] = opts.ComposeEnvFile
	}
	if opts.RollbackTag != "" {
		env["ROLLBACK_IMAGE_TAG"] = opts.RollbackTag
	}

	err := runner.RunEnv(context.Background(), env, "sh", opts.ScriptPath)
	completed := time.Now().UTC()
	state.CompletedAt = &completed
	if err != nil {
		state.Status = RolloutStatusFailed
		state.Error = err.Error()
	} else {
		state.Status = RolloutStatusSucceeded
		healthErr := WaitForHealthy(HealthCheckOptions{
			URL:      fmt.Sprintf("http://localhost:%s/healthz", gatewayPort(opts.Services)),
			Timeout:  30 * time.Second,
			MaxRetries: 6,
		})
		state.HealthChecked = true
		if healthErr != nil {
			state.Error = fmt.Sprintf("deploy succeeded but health check warning: %s", healthErr.Error())
		}
	}
	if opts.StatePath != "" {
		if writeErr := WriteRolloutState(opts.StatePath, state); writeErr != nil && err == nil {
			err = writeErr
		}
	}
	return state, err
}

func buildRolloutWaves(services []string, batchSize int) [][]string {
	if batchSize < 1 {
		batchSize = 4
	}
	waves := make([][]string, 0, (len(services)+batchSize-1)/batchSize)
	for i := 0; i < len(services); i += batchSize {
		end := i + batchSize
		if end > len(services) {
			end = len(services)
		}
		waves = append(waves, append([]string(nil), services[i:end]...))
	}
	return waves
}

func WriteRolloutState(path string, state RolloutState) error {
	if path == "" {
		return fmt.Errorf("state path required")
	}
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return fmt.Errorf("create rollout state dir: %w", err)
	}
	data, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal rollout state: %w", err)
	}
	if err := os.WriteFile(path, data, 0644); err != nil {
		return fmt.Errorf("write rollout state: %w", err)
	}
	return nil
}

func gatewayPort(services []string) string {
	for _, s := range services {
		if s == "gateway" {
			return "3000"
		}
	}
	return "8080"
}

func ReadRolloutState(path string) (RolloutState, error) {
	if path == "" {
		return RolloutState{}, fmt.Errorf("state path required")
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return RolloutState{}, fmt.Errorf("read rollout state: %w", err)
	}
	var state RolloutState
	if err := json.Unmarshal(data, &state); err != nil {
		return RolloutState{}, fmt.Errorf("parse rollout state: %w", err)
	}
	return state, nil
}

package cli

import "testing"

func TestParseArgsDefaultsToGenerate(t *testing.T) {
	cmd, err := ParseArgs(nil)
	if err != nil {
		t.Fatalf("ParseArgs() error = %v", err)
	}
	if cmd.Name != "generate" {
		t.Fatalf("expected generate command, got %s", cmd.Name)
	}
}

func TestParseArgsGenerateFlags(t *testing.T) {
	cmd, err := ParseArgs([]string{
		"generate",
		"-name", "qa",
		"-targets", "compose",
		"-infra", "postgres",
		"-services", "gateway,profile",
		"-compose-mode", "build",
	})
	if err != nil {
		t.Fatalf("ParseArgs() error = %v", err)
	}

	if cmd.Environment.Name != "qa" {
		t.Fatalf("expected environment name qa, got %s", cmd.Environment.Name)
	}
	if got := len(cmd.Environment.Services); got != 2 {
		t.Fatalf("expected 2 services, got %d", got)
	}
	if got := len(cmd.Environment.Targets); got != 1 {
		t.Fatalf("expected 1 target, got %d", got)
	}
}

func TestParseArgsTUI(t *testing.T) {
	cmd, err := ParseArgs([]string{"tui"})
	if err != nil {
		t.Fatalf("ParseArgs() error = %v", err)
	}
	if cmd.Name != "tui" {
		t.Fatalf("expected tui command, got %s", cmd.Name)
	}
}

func TestParseArgsValidateDeployment(t *testing.T) {
	cmd, err := ParseArgs([]string{
		"validate",
		"-deployment", "deployment.yaml",
		"-secrets", "deployment.secrets.env",
	})
	if err != nil {
		t.Fatalf("ParseArgs() error = %v", err)
	}

	if cmd.Name != "validate" {
		t.Fatalf("expected validate command, got %s", cmd.Name)
	}
	if cmd.DeploymentPath != "deployment.yaml" {
		t.Fatalf("expected deployment path, got %q", cmd.DeploymentPath)
	}
	if cmd.SecretsPath != "deployment.secrets.env" {
		t.Fatalf("expected secrets path, got %q", cmd.SecretsPath)
	}
}

func TestParseArgsValidateDefaults(t *testing.T) {
	cmd, err := ParseArgs([]string{"validate"})
	if err != nil {
		t.Fatalf("ParseArgs() error = %v", err)
	}
	if cmd.Name != "validate" {
		t.Fatalf("expected validate command, got %s", cmd.Name)
	}
	if cmd.DeploymentPath != "" {
		t.Fatalf("expected empty deployment path for ad-hoc validate, got %q", cmd.DeploymentPath)
	}
}

func TestParseArgsGenerateWorkspaceConfig(t *testing.T) {
	cmd, err := ParseArgs([]string{
		"generate",
		"-config", "deployments.yaml",
	})
	if err != nil {
		t.Fatalf("ParseArgs() error = %v", err)
	}

	if cmd.ConfigPath != "deployments.yaml" {
		t.Fatalf("expected config path to be captured, got %q", cmd.ConfigPath)
	}
}

func TestParseArgsServe(t *testing.T) {
	cmd, err := ParseArgs([]string{
		"serve",
		"-deployment", "ops/deployments/production.yaml",
		"-secrets", "ops/deployments/production.secrets.env",
		"-address", ":8098",
	})
	if err != nil {
		t.Fatalf("ParseArgs() error = %v", err)
	}

	if cmd.Name != "serve" {
		t.Fatalf("expected serve command, got %s", cmd.Name)
	}
	if cmd.DeploymentPath != "ops/deployments/production.yaml" {
		t.Fatalf("expected deployment path, got %q", cmd.DeploymentPath)
	}
	if cmd.SecretsPath != "ops/deployments/production.secrets.env" {
		t.Fatalf("expected secrets path, got %q", cmd.SecretsPath)
	}
	if cmd.Address != ":8098" {
		t.Fatalf("expected address :8098, got %q", cmd.Address)
	}
}

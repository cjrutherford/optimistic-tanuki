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

func TestParseArgsValidateRequiresDeployment(t *testing.T) {
	_, err := ParseArgs([]string{"validate"})
	if err == nil {
		t.Fatal("expected error when deployment path is missing")
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

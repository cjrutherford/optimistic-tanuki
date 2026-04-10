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

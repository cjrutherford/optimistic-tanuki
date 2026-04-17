package main

import (
	"fmt"
	"os"
	"path/filepath"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/catalog"
	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/cli"
	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/configurator"
	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/output"
	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/tui"
)

func main() {
	command, err := cli.ParseArgs(os.Args[1:])
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	cat := catalog.DefaultCatalog()

	switch command.Name {
	case "tui":
		env := command.Environment
		model := tui.NewModel(env, func() (configurator.GenerateResult, error) {
			writer := output.NewWriter(filepath.Join("dist", "admin-env", env.Name))
			return configurator.GenerateEnvironment(env, cat, writer)
		})
		if _, err := tea.NewProgram(model).Run(); err != nil {
			fmt.Fprintf(os.Stderr, "failed to run tui: %v\n", err)
			os.Exit(1)
		}
	default:
		command.Environment.Normalize()
		writer := output.NewWriter(command.Environment.OutputDir)
		result, err := configurator.GenerateEnvironment(command.Environment, cat, writer)
		if err != nil {
			fmt.Fprintf(os.Stderr, "generation failed: %v\n", err)
			os.Exit(1)
		}
		fmt.Printf("Output written to: %s\n", result.OutputDir)
		if result.ComposePath != "" {
			fmt.Printf("Compose: %s\n", filepath.Join(result.OutputDir, result.ComposePath))
		}
		if result.K8sPath != "" {
			fmt.Printf("K8s: %s\n", filepath.Join(result.OutputDir, result.K8sPath))
		}
	}
}

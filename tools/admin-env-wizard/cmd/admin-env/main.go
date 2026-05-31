package main

import (
	"fmt"
	"os"
	"path/filepath"

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
		doc := configurator.DeploymentConfigFromEnvironment(command.Environment)
		secrets := map[string]string{}
		if command.DeploymentPath != "" {
			loadedDoc, loadedSecrets, err := configurator.LoadDeploymentConfig(command.DeploymentPath, command.SecretsPath)
			if err != nil {
				fmt.Fprintf(os.Stderr, "failed to load deployment config: %v\n", err)
				os.Exit(1)
			}
			doc = loadedDoc
			secrets = loadedSecrets
		}
		var saveDocument func(*configurator.DeploymentConfig) error
		if command.DeploymentPath != "" {
			saveDocument = func(updatedDoc *configurator.DeploymentConfig) error {
				return configurator.SaveDeploymentConfig(command.DeploymentPath, updatedDoc)
			}
		}
		var saveSecrets func(map[string]string) error
		if command.SecretsPath != "" {
			saveSecrets = func(updatedSecrets map[string]string) error {
				return configurator.SaveSecretsFile(command.SecretsPath, updatedSecrets)
			}
		}
		model := tui.NewDocumentModel(
			doc,
			command.DeploymentPath,
			saveDocument,
			saveSecrets,
			func() (configurator.GenerateResult, error) {
				outputDir := filepath.Join("dist", "admin-env", doc.Environment.Name)
				writer := output.NewWriter(outputDir)
				if command.Environment.OutputDir != "" {
					writer = output.NewWriter(command.Environment.OutputDir)
				}
				return configurator.GenerateDeploymentArtifacts(doc, secrets, cat, writer)
			},
			secrets,
		)
		if err := model.Run(); err != nil {
			fmt.Fprintf(os.Stderr, "failed to run tui: %v\n", err)
			os.Exit(1)
		}
	case "validate":
		doc, secrets, err := configurator.LoadDeploymentConfig(command.DeploymentPath, command.SecretsPath)
		if err != nil {
			fmt.Fprintf(os.Stderr, "validation failed to load config: %v\n", err)
			os.Exit(1)
		}
		issues := configurator.ValidateDeploymentArtifacts(doc, secrets, cat)
		hasErrors := false
		if len(issues) == 0 {
			fmt.Println("Validation passed with no issues.")
			return
		}
		for _, issue := range issues {
			fmt.Printf("%s: %s\n", issue.Severity, issue.Message)
			if issue.Severity == "error" {
				hasErrors = true
			}
		}
		if hasErrors {
			os.Exit(1)
		}
	default:
		if command.ConfigPath != "" {
			workspace, err := configurator.LoadWorkspace(command.ConfigPath)
			if err != nil {
				fmt.Fprintf(os.Stderr, "failed to load workspace config: %v\n", err)
				os.Exit(1)
			}

			baseDir := command.Environment.OutputDir
			if baseDir == "" {
				baseDir = filepath.Join("dist", "admin-env")
			}

			result, err := configurator.GenerateWorkspace(
				workspace,
				cat,
				output.NewWriter(baseDir),
			)
			if err != nil {
				fmt.Fprintf(os.Stderr, "workspace generation failed: %v\n", err)
				os.Exit(1)
			}

			fmt.Printf("Workspace output written to: %s\n", result.OutputDir)
			for _, deployment := range result.Deployments {
				fmt.Printf("- %s\n", deployment.OutputDir)
			}
			return
		}

		if command.DeploymentPath != "" {
			doc, secrets, err := configurator.LoadDeploymentConfig(command.DeploymentPath, command.SecretsPath)
			if err != nil {
				fmt.Fprintf(os.Stderr, "failed to load deployment config: %v\n", err)
				os.Exit(1)
			}
			writer := output.NewWriter(command.Environment.OutputDir)
			if command.Environment.OutputDir == "" {
				writer = output.NewWriter(filepath.Join("dist", "admin-env", doc.Environment.Name))
			}
			result, err := configurator.GenerateDeploymentArtifacts(doc, secrets, cat, writer)
			if err != nil {
				fmt.Fprintf(os.Stderr, "generation failed: %v\n", err)
				os.Exit(1)
			}
			fmt.Printf("Output written to: %s\n", result.OutputDir)
			fmt.Printf("Runtime env: %s\n", filepath.Join(result.OutputDir, result.RuntimeEnvPath))
			fmt.Printf("Registry: %s\n", filepath.Join(result.OutputDir, result.RegistryPath))
			fmt.Printf("DB setup plan: %s\n", filepath.Join(result.OutputDir, result.DatabaseSetupPath))
			fmt.Printf("Validation report: %s\n", filepath.Join(result.OutputDir, result.ValidationReportPath))
			return
		}

		command.Environment.Normalize()
		writer := output.NewWriter(command.Environment.OutputDir)
		result, err := configurator.GenerateEnvironment(command.Environment, cat, writer)
		if err != nil {
			fmt.Fprintf(os.Stderr, "generation failed: %v\n", err)
			os.Exit(1)
		}
		fmt.Printf("Output written to: %s\n", result.OutputDir)
		if result.DeployScript != "" {
			fmt.Printf("Deploy: %s\n", filepath.Join(result.OutputDir, result.DeployScript))
		}
		if result.ComposePath != "" {
			fmt.Printf("Compose: %s\n", filepath.Join(result.OutputDir, result.ComposePath))
		}
		if result.K8sPath != "" {
			fmt.Printf("K8s: %s\n", filepath.Join(result.OutputDir, result.K8sPath))
		}
	}
}

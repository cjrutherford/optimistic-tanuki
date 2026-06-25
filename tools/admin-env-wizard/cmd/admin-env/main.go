package main

import (
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"os"
	"path/filepath"

	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/catalog"
	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/cli"
	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/configurator"
	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/output"
)

func main() {
	command, err := cli.ParseArgs(os.Args[1:])
	if err != nil {
		if errors.Is(err, flag.ErrHelp) {
			os.Exit(0)
		}
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	cat := catalog.DefaultCatalog()

	switch command.Name {
	case "generate":
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
			if command.JSON {
				printJSON(map[string]interface{}{
					"outputDir": result.OutputDir,
					"runtimeEnv": filepath.Join(result.OutputDir, result.RuntimeEnvPath),
					"registry": filepath.Join(result.OutputDir, result.RegistryPath),
					"dbSetupPlan": filepath.Join(result.OutputDir, result.DatabaseSetupPath),
					"validationReport": filepath.Join(result.OutputDir, result.ValidationReportPath),
				})
				return
			}
			fmt.Printf("Output written to: %s\n", result.OutputDir)
			fmt.Printf("Runtime env: %s\n", filepath.Join(result.OutputDir, result.RuntimeEnvPath))
			fmt.Printf("Registry: %s\n", filepath.Join(result.OutputDir, result.RegistryPath))
			fmt.Printf("DB setup plan: %s\n", filepath.Join(result.OutputDir, result.DatabaseSetupPath))
			fmt.Printf("Validation report: %s\n", filepath.Join(result.OutputDir, result.ValidationReportPath))
			return
		}

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

			if command.JSON {
				deployments := make([]map[string]interface{}, 0, len(result.Deployments))
				for _, d := range result.Deployments {
					deployments = append(deployments, map[string]interface{}{
						"outputDir": d.OutputDir,
					})
				}
				printJSON(map[string]interface{}{
					"outputDir":    result.OutputDir,
					"deployments": deployments,
				})
				return
			}

			fmt.Printf("Workspace output written to: %s\n", result.OutputDir)
			for _, deployment := range result.Deployments {
				fmt.Printf("- %s\n", deployment.OutputDir)
			}
			return
		}

		command.Environment.Normalize()
		writer := output.NewWriter(command.Environment.OutputDir)
		result, err := configurator.GenerateEnvironment(command.Environment, cat, writer)
		if err != nil {
			fmt.Fprintf(os.Stderr, "generation failed: %v\n", err)
			os.Exit(1)
		}
		if command.JSON {
			payload := map[string]interface{}{
				"outputDir": result.OutputDir,
			}
			if result.DeployScript != "" {
				payload["deploy"] = filepath.Join(result.OutputDir, result.DeployScript)
			}
			if result.ComposePath != "" {
				payload["compose"] = filepath.Join(result.OutputDir, result.ComposePath)
			}
			if result.K8sPath != "" {
				payload["k8s"] = filepath.Join(result.OutputDir, result.K8sPath)
			}
			printJSON(payload)
			return
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
	case "validate":
		var doc *configurator.DeploymentConfig
		secrets := map[string]string{}
		if command.DeploymentPath != "" {
			var err error
			doc, secrets, err = configurator.LoadDeploymentConfig(command.DeploymentPath, command.SecretsPath)
			if err != nil {
				fmt.Fprintf(os.Stderr, "validation failed to load config: %v\n", err)
				os.Exit(1)
			}
		} else {
			doc = configurator.DeploymentConfigFromEnvironment(command.Environment)
		}
		issues := configurator.ValidateDeploymentArtifacts(doc, secrets, cat)
		if command.JSON {
			printJSON(map[string]interface{}{
				"valid":  len(issues) == 0,
				"issues": issues,
			})
			return
		}
		if len(issues) == 0 {
			fmt.Println("Validation passed with no issues.")
			return
		}
		for _, issue := range issues {
			fmt.Printf("%s: %s\n", issue.Severity, issue.Message)
		}
		hasErrors := false
		for _, issue := range issues {
			if issue.Severity == "error" {
				hasErrors = true
			}
		}
		if hasErrors {
			os.Exit(1)
		}
	case "deployment-inventory":
		if command.DeploymentPath == "" {
			fmt.Fprintf(os.Stderr, "deployment-inventory requires -deployment\n")
			os.Exit(1)
		}
		doc, secrets, err := configurator.LoadDeploymentConfig(command.DeploymentPath, command.SecretsPath)
		if err != nil {
			fmt.Fprintf(os.Stderr, "failed to load deployment config: %v\n", err)
			os.Exit(1)
		}
		inventory := buildDeploymentInventory(doc, secrets)
		if command.JSON {
			printJSON(inventory)
			return
		}
		for _, svc := range inventory.Services {
			fmt.Printf("%s -> %s\n", svc.ServiceID, svc.Image)
		}
	default:
		fmt.Fprintf(os.Stderr, "unknown command %q\n\n%s", command.Name, cli.UsageText())
		os.Exit(1)
	}
}

func printJSON(v interface{}) {
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	_ = enc.Encode(v)
}

type InventoryService struct {
	ServiceID string `json:"serviceId"`
	Image     string `json:"image"`
	Tag       string `json:"tag"`
}

type InventoryResult struct {
	Services    []InventoryService `json:"services"`
	Environment string             `json:"environment"`
}

func buildDeploymentInventory(doc *configurator.DeploymentConfig, secrets map[string]string) InventoryResult {
	services := make([]InventoryService, 0, len(doc.Services))
	for _, svc := range doc.Services {
		if !svc.Enabled {
			continue
		}
		services = append(services, InventoryService{
			ServiceID: svc.ServiceID,
			Image:     fmt.Sprintf("%s/optimistic_tanuki_%s", doc.Environment.ImageOwner, svc.ServiceID),
			Tag:       doc.Environment.DefaultTag,
		})
	}
	return InventoryResult{
		Services:    services,
		Environment: doc.Environment.Name,
	}
}

func enabledServiceIDs(services []configurator.DeploymentService) []string {
	ids := make([]string, 0, len(services))
	for _, service := range services {
		if service.Enabled {
			ids = append(ids, service.ServiceID)
		}
	}
	return ids
}

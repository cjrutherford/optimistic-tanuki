package configurator

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/catalog"
	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/domain"
	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/output"
	"gopkg.in/yaml.v3"
)

type WorkspaceDeploymentConfig struct {
	Name         string   `yaml:"name"`
	Provider     string   `yaml:"provider"`
	Capabilities []string `yaml:"capabilities"`
	Targets      []string `yaml:"targets"`
}

type WorkspaceDefinition struct {
	Deployments []WorkspaceDeploymentConfig `yaml:"deployments"`
}

type WorkspaceResult struct {
	OutputDir   string
	Deployments []GenerateResult
}

func LoadWorkspace(path string) (*WorkspaceDefinition, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read workspace config: %w", err)
	}

	var workspace WorkspaceDefinition
	if err := yaml.Unmarshal(data, &workspace); err != nil {
		return nil, fmt.Errorf("parse workspace config: %w", err)
	}

	return &workspace, nil
}

func GenerateWorkspace(workspace *WorkspaceDefinition, cat *catalog.Catalog, writer *output.Writer) (WorkspaceResult, error) {
	if workspace == nil {
		return WorkspaceResult{}, fmt.Errorf("workspace definition required")
	}
	if writer == nil {
		return WorkspaceResult{}, fmt.Errorf("writer required")
	}
	if cat == nil {
		cat = catalog.DefaultCatalog()
	}

	result := WorkspaceResult{OutputDir: writer.BaseDir}

	for _, deployment := range workspace.Deployments {
		env := DefaultEnvironment()
		env.Name = deployment.Name
		env.Provider = domain.Provider(deployment.Provider)
		env.Capabilities = append([]string(nil), deployment.Capabilities...)
		env.Targets = make([]domain.Target, 0, len(deployment.Targets))
		for _, target := range deployment.Targets {
			env.Targets = append(env.Targets, domain.Target(target))
		}
		env.OutputDir = filepath.Join(writer.BaseDir, deployment.Name)

		deploymentResult, err := GenerateEnvironment(env, cat, output.NewWriter(env.OutputDir))
		if err != nil {
			return WorkspaceResult{}, fmt.Errorf("generate deployment %s: %w", deployment.Name, err)
		}
		result.Deployments = append(result.Deployments, deploymentResult)
	}

	return result, nil
}

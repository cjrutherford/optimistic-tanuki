package configurator

import (
	"fmt"

	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/catalog"
	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/domain"
	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/generate"
	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/output"
)

type GenerateResult struct {
	OutputDir            string
	ComposePath          string
	K8sPath              string
	DeployScript         string
	RegistryPath         string
	RuntimeEnvPath       string
	ValidationReportPath string
	GeneratedK8s         []string
}

func DefaultEnvironment() *domain.EnvironmentDefinition {
	return &domain.EnvironmentDefinition{
		Name:         "demo",
		Namespace:    "optimistic-tanuki",
		Targets:      []domain.Target{domain.TargetCompose, domain.TargetK8s},
		ComposeMode:  domain.ComposeModeImage,
		Provider:     domain.ProviderVultr,
		ImageOwner:   "cjrutherford",
		DefaultTag:   "latest",
		IncludeInfra: []domain.InfraKind{domain.InfraPostgres, domain.InfraRedis},
		Capabilities: []string{"community"},
		Services: []domain.ServiceSelection{
			{ServiceID: "gateway", Enabled: true},
		},
	}
}

func GenerateEnvironment(env *domain.EnvironmentDefinition, cat *catalog.Catalog, writer *output.Writer) (GenerateResult, error) {
	if env == nil {
		return GenerateResult{}, fmt.Errorf("environment definition required")
	}
	if cat == nil {
		cat = catalog.DefaultCatalog()
	}
	if writer == nil {
		writer = output.NewWriter(env.OutputDir)
	}

	env.Normalize()
	if err := env.Validate(); err != nil {
		return GenerateResult{}, err
	}

	if len(env.Capabilities) > 0 {
		explicit := make([]string, 0, len(env.Services))
		for _, service := range env.Services {
			if service.Enabled {
				explicit = append(explicit, service.ServiceID)
			}
		}

		resolved, err := cat.ResolveServices(env.Capabilities, []string{"gateway"}, explicit)
		if err != nil {
			return GenerateResult{}, err
		}

		env.Services = make([]domain.ServiceSelection, 0, len(resolved))
		for _, serviceID := range resolved {
			env.Services = append(env.Services, domain.ServiceSelection{
				ServiceID: serviceID,
				Enabled:   true,
			})
		}
	}

	result := GenerateResult{OutputDir: writer.BaseDir}

	gatewayComposition, err := generate.GenerateGatewayComposition(env, cat)
	if err != nil {
		return GenerateResult{}, fmt.Errorf("generate gateway composition: %w", err)
	}
	if err := writer.WriteGatewayComposition(gatewayComposition); err != nil {
		return GenerateResult{}, fmt.Errorf("write gateway composition: %w", err)
	}

	for _, t := range env.Targets {
		switch t {
		case domain.TargetCompose:
			composeFiles, err := generate.GenerateComposeFiles(env, cat)
			if err != nil {
				return GenerateResult{}, fmt.Errorf("generate compose: %w", err)
			}
			if err := writer.WriteComposeFiles(composeFiles); err != nil {
				return GenerateResult{}, fmt.Errorf("write compose: %w", err)
			}
			result.ComposePath = "compose/docker-compose.yaml"
		case domain.TargetK8s:
			k8sFiles, err := generate.GenerateK8s(env, cat)
			if err != nil {
				return GenerateResult{}, fmt.Errorf("generate k8s: %w", err)
			}
			if err := writer.WriteK8sFiles(k8sFiles); err != nil {
				return GenerateResult{}, fmt.Errorf("write k8s: %w", err)
			}
			result.K8sPath = "k8s/kustomization.yaml"
			for name := range k8sFiles {
				result.GeneratedK8s = append(result.GeneratedK8s, name)
			}
		}
	}

	if err := writer.WriteDeployScripts(env.Targets); err != nil {
		return GenerateResult{}, fmt.Errorf("write deploy scripts: %w", err)
	}
	result.DeployScript = "deploy.sh"

	return result, nil
}

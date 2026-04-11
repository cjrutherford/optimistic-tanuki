package configurator

import (
	"fmt"

	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/catalog"
	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/domain"
	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/generate"
	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/output"
)

type GenerateResult struct {
	OutputDir    string
	ComposePath  string
	K8sPath      string
	GeneratedK8s []string
}

func DefaultEnvironment() *domain.EnvironmentDefinition {
	return &domain.EnvironmentDefinition{
		Name:         "demo",
		Namespace:    "optimistic-tanuki",
		Targets:      []domain.Target{domain.TargetCompose, domain.TargetK8s},
		ComposeMode:  domain.ComposeModeImage,
		ImageOwner:   "cjrutherford",
		DefaultTag:   "latest",
		IncludeInfra: []domain.InfraKind{domain.InfraPostgres, domain.InfraRedis},
		Services: []domain.ServiceSelection{
			{ServiceID: "gateway", Enabled: true},
			{ServiceID: "authentication", Enabled: true},
			{ServiceID: "app-configurator", Enabled: true},
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

	result := GenerateResult{OutputDir: writer.BaseDir}

	for _, t := range env.Targets {
		switch t {
		case domain.TargetCompose:
			composeData, err := generate.GenerateCompose(env, cat)
			if err != nil {
				return GenerateResult{}, fmt.Errorf("generate compose: %w", err)
			}
			if err := writer.WriteComposeFile(composeData); err != nil {
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

	return result, nil
}

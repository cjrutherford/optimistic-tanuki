package generate

import (
	"fmt"
	"sort"

	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/catalog"
	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/domain"
	"gopkg.in/yaml.v3"
)

type ComposeService struct {
	Image         string              `yaml:"image,omitempty"`
	Build         *ComposeBuild       `yaml:"build,omitempty"`
	ContainerName string              `yaml:"container_name,omitempty"`
	Ports         []string            `yaml:"ports,omitempty"`
	Environment   map[string]string   `yaml:"environment,omitempty"`
	DependsOn     []string            `yaml:"depends_on,omitempty"`
	Volumes       []string            `yaml:"volumes,omitempty"`
	Restart       string              `yaml:"restart,omitempty"`
	Healthcheck   *ComposeHealthcheck `yaml:"healthcheck,omitempty"`
}

type ComposeBuild struct {
	Context    string `yaml:"context"`
	Dockerfile string `yaml:"dockerfile"`
}

type ComposeHealthcheck struct {
	Test     []string `yaml:"test"`
	Interval string   `yaml:"interval"`
	Timeout  string   `yaml:"timeout"`
	Retries  int      `yaml:"retries"`
}

type ComposeFile struct {
	Version  string                    `yaml:"version,omitempty"`
	Services map[string]ComposeService `yaml:"services"`
	Volumes  map[string]interface{}    `yaml:"volumes,omitempty"`
}

func GenerateCompose(env *domain.EnvironmentDefinition, cat *catalog.Catalog) ([]byte, error) {
	cf := ComposeFile{
		Services: make(map[string]ComposeService),
		Volumes:  make(map[string]interface{}),
	}

	enabledInfra := make(map[domain.InfraKind]bool)
	for _, kind := range env.IncludeInfra {
		enabledInfra[kind] = true
	}

	for _, sel := range env.Services {
		if !sel.Enabled {
			continue
		}
		preset, ok := cat.Get(sel.ServiceID)
		if !ok {
			continue
		}

		dependsOn := []string{}
		for _, dep := range preset.Dependencies {
			if dep.Required {
				dependsOn = append(dependsOn, dep.ServiceID)
				if dep.Database != "" {
					enabledInfra[dep.Database] = true
				}
			}
		}

		service := ComposeService{
			ContainerName: fmt.Sprintf("ot_%s", preset.ID),
			Environment:   make(map[string]string),
			Restart:       "always",
		}

		for k, v := range preset.Compose.EnvDefaults {
			service.Environment[k] = v
		}

		if env.ComposeMode == domain.ComposeModeBuild {
			service.Build = &ComposeBuild{
				Context:    preset.Compose.BuildContext,
				Dockerfile: preset.Compose.Dockerfile,
			}
		} else {
			service.Image = fmt.Sprintf("%s:%s", preset.Image.Name, env.DefaultTag)
		}

		if preset.Compose.ExternalPort > 0 {
			service.Ports = []string{
				fmt.Sprintf("%d:%d", preset.Compose.ExternalPort, preset.Compose.ContainerPort),
			}
		}

		if len(dependsOn) > 0 {
			service.DependsOn = dependsOn
		}

		if len(preset.Compose.Volumes) > 0 {
			service.Volumes = preset.Compose.Volumes
		}

		serviceName := preset.Compose.ServiceName
		if serviceName == "" {
			serviceName = preset.ID
		}

		cf.Services[serviceName] = service
	}

	for kind := range enabledInfra {
		infra, ok := cat.Infra(kind)
		if !ok {
			continue
		}
		cf.Services[infra.ID] = buildInfraService(infra, env)
	}

	if cf.Volumes == nil {
		cf.Volumes = map[string]interface{}{}
	}
	cf.Volumes["postgres_data"] = nil

	sortKeys := make([]string, 0, len(cf.Services))
	for k := range cf.Services {
		sortKeys = append(sortKeys, k)
	}
	sort.Strings(sortKeys)

	orderedServices := make(map[string]ComposeService)
	for _, k := range sortKeys {
		orderedServices[k] = cf.Services[k]
	}
	cf.Services = orderedServices

	yamlData, err := yaml.Marshal(cf)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal compose: %w", err)
	}

	return yamlData, nil
}

func buildInfraService(preset catalog.Preset, env *domain.EnvironmentDefinition) ComposeService {
	service := ComposeService{
		Image:         fmt.Sprintf("%s:%s", preset.Image.Name, preset.Image.Tag),
		ContainerName: preset.ID,
		Environment:   make(map[string]string),
		Restart:       "always",
	}

	for k, v := range preset.Compose.EnvDefaults {
		service.Environment[k] = v
	}

	if preset.Compose.ExternalPort > 0 {
		service.Ports = []string{
			fmt.Sprintf("%d:%d", preset.Compose.ExternalPort, preset.Compose.ContainerPort),
		}
	}

	if len(preset.Compose.Volumes) > 0 {
		service.Volumes = preset.Compose.Volumes
	}

	return service
}

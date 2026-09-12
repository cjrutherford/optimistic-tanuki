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
	Networks      []string            `yaml:"networks,omitempty"`
	// Sandbox controls, emitted only for presets that declare a Sandbox.
	ReadOnly    bool     `yaml:"read_only,omitempty"`
	Tmpfs       []string `yaml:"tmpfs,omitempty"`
	CapDrop     []string `yaml:"cap_drop,omitempty"`
	SecurityOpt []string `yaml:"security_opt,omitempty"`
	PidsLimit   int      `yaml:"pids_limit,omitempty"`
	MemLimit    string   `yaml:"mem_limit,omitempty"`
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
	Networks map[string]ComposeNetwork `yaml:"networks,omitempty"`
}

type ComposeNetwork struct {
	Internal bool `yaml:"internal,omitempty"`
}

// applySandbox writes a preset's confinement onto its compose service.
//
// Everything here has a Kubernetes counterpart in generateSandboxK8s; a field
// added to catalog.Sandbox belongs in both.
func applySandbox(service *ComposeService, sandbox *catalog.Sandbox) {
	service.ReadOnly = sandbox.ReadOnlyRootFilesystem
	if sandbox.DropAllCapabilities {
		service.CapDrop = []string{"ALL"}
	}
	if sandbox.NoNewPrivileges {
		service.SecurityOpt = []string{"no-new-privileges:true"}
	}
	service.PidsLimit = sandbox.PidsLimit
	service.MemLimit = sandbox.MemoryLimit

	for _, mount := range sandbox.Tmpfs {
		options := "noexec,nosuid"
		if mount.Exec {
			options = "exec,nosuid,nodev,mode=1777"
		}
		service.Tmpfs = append(
			service.Tmpfs,
			fmt.Sprintf("%s:size=%s,%s", mount.Path, mount.Size, options),
		)
	}

	if sandbox.InternalNetwork != "" {
		service.Networks = []string{sandbox.InternalNetwork}
	}
}

func GenerateCompose(env *domain.EnvironmentDefinition, cat *catalog.Catalog) ([]byte, error) {
	files, err := GenerateComposeFiles(env, cat)
	if err != nil {
		return nil, err
	}
	return files["docker-compose.yaml"], nil
}

func GenerateComposeFiles(env *domain.EnvironmentDefinition, cat *catalog.Catalog) (map[string][]byte, error) {
	profile := profileFor(env.Provider)
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
		tuning := workloadTuningForProfile(profile, preset.ID, string(preset.Category))
		if tuning.RestartPolicy != "" {
			service.Restart = tuning.RestartPolicy
		}

		for k, v := range preset.Compose.EnvDefaults {
			service.Environment[k] = v
		}
		service.Environment = applyServiceDatabaseEnv(service.Environment, env, &sel)

		if env.ComposeMode == domain.ComposeModeBuild {
			service.Build = &ComposeBuild{
				Context:    "../../..",
				Dockerfile: preset.Compose.Dockerfile,
			}
		} else {
			tag := env.DefaultTag
			if sel.ImageTag != "" {
				tag = sel.ImageTag
			}
			service.Image = fmt.Sprintf("%s:%s", preset.Image.Name, tag)
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

		if preset.ID == "gateway" {
			service.Environment["GATEWAY_COMPOSITION_PATH"] = "/etc/optimistic-tanuki/gateway/composition.yaml"
			service.Volumes = append(service.Volumes, "../gateway:/etc/optimistic-tanuki/gateway:ro")
		}

		if preset.Sandbox != nil {
			applySandbox(&service, preset.Sandbox)
		}

		serviceName := preset.Compose.ServiceName
		if serviceName == "" {
			serviceName = preset.ID
		}

		cf.Services[serviceName] = service
	}

	// Sandboxed workloads sit on an internal network, which the services
	// allowed to call them have to join as well — while keeping `default`, or
	// they would lose their route to the rest of the stack.
	for _, sel := range env.Services {
		if !sel.Enabled {
			continue
		}
		preset, ok := cat.Get(sel.ServiceID)
		if !ok || preset.Sandbox == nil || preset.Sandbox.InternalNetwork == "" {
			continue
		}

		if cf.Networks == nil {
			cf.Networks = map[string]ComposeNetwork{}
		}
		cf.Networks[preset.Sandbox.InternalNetwork] = ComposeNetwork{Internal: true}

		for _, callerID := range preset.Sandbox.IngressFrom {
			caller, ok := cat.Get(callerID)
			if !ok {
				continue
			}
			callerName := caller.Compose.ServiceName
			if callerName == "" {
				callerName = caller.ID
			}
			callerService, ok := cf.Services[callerName]
			if !ok {
				continue
			}
			callerService.Networks = []string{"default", preset.Sandbox.InternalNetwork}
			cf.Services[callerName] = callerService
		}
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

	for _, service := range cf.Services {
		for _, volume := range service.Volumes {
			if volume == "video-processing-data:/tmp/video-processing" {
				cf.Volumes["video-processing-data"] = nil
			}
		}
	}

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

	baseFragment, err := yaml.Marshal(ComposeFile{
		Services: cf.Services,
		Volumes:  cf.Volumes,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to marshal compose base fragment: %w", err)
	}

	providerFragment, err := yaml.Marshal(map[string]any{
		"provider": env.Provider,
		"x-optimistic-tanuki-provider-profile": map[string]any{
			"name":         profile.Name,
			"storageClass": profile.StorageClassName,
		},
		"services": composeProviderServicesFragment(env, profile, cat),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to marshal compose provider fragment: %w", err)
	}

	capabilityFragment, err := yaml.Marshal(map[string]any{
		"capabilities": env.Capabilities,
		"services":     composeCapabilityServices(env),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to marshal compose capabilities fragment: %w", err)
	}

	return map[string][]byte{
		"docker-compose.yaml":                        yamlData,
		"fragments/docker-compose.base.yaml":         baseFragment,
		"fragments/docker-compose.provider.yaml":     providerFragment,
		"fragments/docker-compose.capabilities.yaml": capabilityFragment,
	}, nil
}

func composeProviderServiceFragment(profile providerProfile, service string, category string) map[string]any {
	tuning := workloadTuningForProfile(profile, service, category)
	return map[string]any{
		"restart": tuning.RestartPolicy,
		"labels": map[string]string{
			"optimistic-tanuki.profile": profile.Name,
		},
		"deploy": map[string]any{
			"replicas": tuning.Replicas,
			"resources": map[string]any{
				"reservations": map[string]string{
					"memory": tuning.ReservationMemory,
				},
				"limits": map[string]string{
					"cpus":   milliCPUToCompose(tuning.LimitCPU),
					"memory": tuning.LimitMemory,
				},
			},
		},
	}
}

func composeProviderServicesFragment(env *domain.EnvironmentDefinition, profile providerProfile, cat *catalog.Catalog) map[string]any {
	services := map[string]any{}

	for _, selection := range env.Services {
		if !selection.Enabled {
			continue
		}
		preset, ok := cat.Get(selection.ServiceID)
		if !ok {
			continue
		}
		serviceName := preset.Compose.ServiceName
		if serviceName == "" {
			serviceName = preset.ID
		}
		services[serviceName] = composeProviderServiceFragment(profile, preset.ID, string(preset.Category))
	}

	for _, infraKind := range env.IncludeInfra {
		preset, ok := cat.Infra(infraKind)
		if !ok {
			continue
		}
		services[preset.ID] = composeProviderServiceFragment(profile, preset.ID, string(preset.Category))
	}

	return services
}

func milliCPUToCompose(value string) string {
	if len(value) > 1 && value[len(value)-1] == 'm' {
		return fmt.Sprintf("%.2f", float64(parseMilliCPU(value))/1000)
	}
	return value
}

func parseMilliCPU(value string) int {
	n := 0
	for i := 0; i < len(value)-1; i++ {
		n = n*10 + int(value[i]-'0')
	}
	return n
}

func composeCapabilityServices(env *domain.EnvironmentDefinition) []string {
	services := make([]string, 0, len(env.Services))
	for _, service := range env.Services {
		if service.Enabled {
			services = append(services, service.ServiceID)
		}
	}
	sort.Strings(services)
	return services
}

func buildInfraService(preset catalog.Preset, env *domain.EnvironmentDefinition) ComposeService {
	profile := profileFor(env.Provider)
	tuning := workloadTuningForProfile(profile, preset.ID, string(preset.Category))
	service := ComposeService{
		Image:         fmt.Sprintf("%s:%s", preset.Image.Name, preset.Image.Tag),
		ContainerName: preset.ID,
		Environment:   make(map[string]string),
		Restart:       "always",
	}
	if tuning.RestartPolicy != "" {
		service.Restart = tuning.RestartPolicy
	}

	for k, v := range preset.Compose.EnvDefaults {
		service.Environment[k] = v
	}
	if slot := findDatabaseSlot(env, string(domain.InfraKind(preset.ID))+"-primary"); slot != nil {
		switch slot.Infra {
		case domain.InfraPostgres:
			service.Environment["POSTGRES_USER"] = slot.Username
			service.Environment["POSTGRES_PASSWORD"] = slot.PasswordKey
			service.Environment["POSTGRES_DB"] = slot.DatabaseName
		case domain.InfraRedis:
			service.Environment["REDIS_PASSWORD"] = slot.PasswordKey
		}
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

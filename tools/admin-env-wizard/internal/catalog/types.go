package catalog

import (
	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/domain"
)

type Category string

const (
	CategoryInfra   Category = "infra"
	CategoryService Category = "service"
	CategoryClient  Category = "client"
)

type ComposeMetadata struct {
	BuildContext  string
	Dockerfile    string
	ContainerPort int
	ExternalPort  int
	DependsOn     []string
	EnvDefaults   map[string]string
	Volumes       []string
}

type K8sMetadata struct {
	Replicas     int
	ServiceType  string
	InternalPort int
	ExternalPort int
	SecretRef    string
	EnvFrom      []string
	Resources    ResourceLimits
	Probes       ProbesConfig
}

type ResourceLimits struct {
	Requests MemoryCPU
	Limits   MemoryCPU
}

type MemoryCPU struct {
	Memory string
	CPU    string
}

type ProbesConfig struct {
	Liveness  ProbeConfig
	Readiness ProbeConfig
}

type ProbeConfig struct {
	Path    string
	Port    int
	Initial int
	Period  int
}

type ImageMetadata struct {
	Name string
	Tag  string
}

type Dependency struct {
	ServiceID    string
	Required     bool
	Database     domain.InfraKind
	ServicePoint bool
}

type Preset struct {
	ID            string
	Name          string
	Category      Category
	Compose       ComposeMetadata
	K8s           K8sMetadata
	Image         ImageMetadata
	Dependencies  []Dependency
	ServicePoints []domain.ServicePoint
}

type Catalog struct {
	presets map[string]Preset
	infra   map[domain.InfraKind]Preset
}

func (c *Catalog) Get(id string) (Preset, bool) {
	p, ok := c.presets[id]
	return p, ok
}

func (c *Catalog) All() []Preset {
	result := make([]Preset, 0, len(c.presets))
	for _, p := range c.presets {
		result = append(result, p)
	}
	return result
}

func (c *Catalog) ByCategory(cat Category) []Preset {
	var result []Preset
	for _, p := range c.presets {
		if p.Category == cat {
			result = append(result, p)
		}
	}
	return result
}

func (c *Catalog) Infra(kind domain.InfraKind) (Preset, bool) {
	p, ok := c.infra[kind]
	return p, ok
}

func (c *Catalog) GetInfraPresets() []Preset {
	result := make([]Preset, 0, len(c.infra))
	for _, p := range c.infra {
		result = append(result, p)
	}
	return result
}

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
	ServiceName   string
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

// Sandbox describes confinement a workload cannot safely run without.
//
// It exists for workloads that execute untrusted input — today, the learning
// runner, which compiles and runs code submitted by learners. Both generators
// must be able to express every field here, because a workload carrying a
// Sandbox that is generated without it is not a degraded deployment, it is an
// unconfined one.
type Sandbox struct {
	// ReadOnlyRootFilesystem maps to compose `read_only` and to the container
	// securityContext field of the same name.
	ReadOnlyRootFilesystem bool
	// NoNewPrivileges maps to compose `security_opt: no-new-privileges:true`
	// and to `allowPrivilegeEscalation: false`.
	NoNewPrivileges bool
	// DropAllCapabilities maps to compose `cap_drop: [ALL]` and to
	// `capabilities.drop: [ALL]`.
	DropAllCapabilities bool
	// RunAsUser is the uid the workload runs as. Kubernetes only; the image's
	// own USER covers compose.
	RunAsUser int
	// PidsLimit maps to compose `pids_limit`. Kubernetes has no pod-level
	// equivalent — it is a kubelet setting — so the generated manifest carries
	// it as a comment rather than silently dropping it.
	PidsLimit int
	// MemoryLimit maps to compose `mem_limit` and to the container memory
	// limit. Writeable tmpfs is charged against it in both runtimes.
	MemoryLimit string
	// Tmpfs are the only writeable paths.
	Tmpfs []TmpfsMount
	// InternalNetwork is a compose network with no route out. Every service
	// listed in IngressFrom joins it too.
	InternalNetwork string
	// IngressFrom lists the service IDs allowed to reach this workload. It
	// drives a Kubernetes NetworkPolicy that permits those pods in and permits
	// nothing out.
	IngressFrom []string
}

type TmpfsMount struct {
	Path string
	Size string
	// Exec allows executing files from the mount. Compiled languages need one
	// such path; everything else should leave this false.
	Exec bool
}

type Preset struct {
	ID            string
	Name          string
	Category      Category
	ComposeOnly   bool
	Compose       ComposeMetadata
	K8s           K8sMetadata
	Image         ImageMetadata
	Sandbox       *Sandbox
	Dependencies  []Dependency
	ServicePoints []domain.ServicePoint
}

type DeployableApp struct {
	ID                 string
	BuildAppID         string
	Category           Category
	ComposeServiceName string
	Dockerfile         string
	ImageName          string
	K8sManifestPath    string
}

type Catalog struct {
	presets map[string]Preset
	infra   map[domain.InfraKind]Preset
	capabilities map[string][]string
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

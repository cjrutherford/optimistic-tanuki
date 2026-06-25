package domain

import (
	"fmt"
	"strings"
)

type Target string

const (
	TargetCompose Target = "compose"
	TargetK8s     Target = "k8s"
)

type ComposeMode string

const (
	ComposeModeBuild ComposeMode = "build"
	ComposeModeImage ComposeMode = "image"
)

type Provider string

const (
	ProviderAkamai Provider = "akamai"
	ProviderVultr  Provider = "vultr"
	ProviderOCI    Provider = "oci"
	ProviderAWS    Provider = "aws"
)

type InfraKind string

const (
	InfraPostgres  InfraKind = "postgres"
	InfraRedis     InfraKind = "redis"
	InfraSeaweedFS InfraKind = "seaweedfs"
)

type DatabaseProvisionMode string

const (
	DatabaseProvisionManaged  DatabaseProvisionMode = "managed"
	DatabaseProvisionExternal DatabaseProvisionMode = "external"
)

type ServicePoint struct {
	ServiceID string
	Hostname  string
	Path      string
	Port      int
	Public    bool
}

type DatabaseSlot struct {
	ID            string
	Infra         InfraKind
	ProvisionMode DatabaseProvisionMode
	Host          string
	Port          int
	DatabaseName  string
	Username      string
	PasswordKey   string
	Create        bool
	Migrate       bool
	Seed          bool
}

type DatabaseBinding struct {
	SlotID       string
	Infra        InfraKind
	DatabaseName string
	Username     string
	PasswordKey  string
	Shared       bool
}

type ServiceSelection struct {
	ServiceID       string
	Enabled         bool
	Replicas        int
	ExternalPort    int
	ImageTag        string
	RequiredInfra   []InfraKind
	ServicePoints   []ServicePoint
	DatabaseBinding *DatabaseBinding
}

type EnvironmentDefinition struct {
	Name          string
	Namespace     string
	Targets       []Target
	ComposeMode   ComposeMode
	Provider      Provider
	Capabilities  []string
	ImageOwner    string
	DefaultTag    string
	IncludeInfra  []InfraKind
	DatabaseSlots []DatabaseSlot
	Services      []ServiceSelection
	ApplyCompose  bool
	ApplyK8s      bool
	OutputDir     string
}

func (e *EnvironmentDefinition) Normalize() {
	if e.OutputDir == "" {
		e.OutputDir = fmt.Sprintf("dist/admin-env/%s", e.Name)
	}
	if e.Namespace == "" {
		e.Namespace = "optimistic-tanuki"
	}
	if e.ImageOwner == "" {
		e.ImageOwner = "cjrutherford"
	}
	if e.DefaultTag == "" {
		e.DefaultTag = "latest"
	}
	if e.Provider == "" {
		e.Provider = ProviderVultr
	}
	for i := range e.DatabaseSlots {
		if e.DatabaseSlots[i].ProvisionMode == "" {
			e.DatabaseSlots[i].ProvisionMode = DatabaseProvisionManaged
		}
	}
}

func (e *EnvironmentDefinition) Validate() error {
	if strings.TrimSpace(e.Name) == "" {
		return fmt.Errorf("environment name cannot be empty")
	}
	if len(e.Targets) == 0 {
		return fmt.Errorf("at least one target (compose or k8s) must be selected")
	}
	if e.ComposeMode != "" && e.ComposeMode != ComposeModeBuild && e.ComposeMode != ComposeModeImage {
		return fmt.Errorf("invalid compose mode: must be 'build' or 'image'")
	}
	if e.Provider != "" &&
		e.Provider != ProviderAkamai &&
		e.Provider != ProviderVultr &&
		e.Provider != ProviderOCI &&
		e.Provider != ProviderAWS {
		return fmt.Errorf("invalid provider: must be 'akamai', 'vultr', 'oci', or 'aws'")
	}
	if e.ApplyCompose && !containsTarget(e.Targets, TargetCompose) {
		return fmt.Errorf("cannot apply compose without selecting compose target")
	}
	if e.ApplyK8s && !containsTarget(e.Targets, TargetK8s) {
		return fmt.Errorf("cannot apply k8s without selecting k8s target")
	}

	slots := map[string]struct{}{}
	for _, slot := range e.DatabaseSlots {
		id := strings.TrimSpace(slot.ID)
		if id == "" {
			return fmt.Errorf("database slot id cannot be empty")
		}
		if _, exists := slots[id]; exists {
			return fmt.Errorf("duplicate database slot id %q", id)
		}
		slots[id] = struct{}{}
		if slot.Infra == "" {
			return fmt.Errorf("database slot %q must define infra kind", id)
		}
		if slot.ProvisionMode != "" && slot.ProvisionMode != DatabaseProvisionManaged && slot.ProvisionMode != DatabaseProvisionExternal {
			return fmt.Errorf("database slot %q has invalid provision mode %q", id, slot.ProvisionMode)
		}
	}

	for _, service := range e.Services {
		if service.DatabaseBinding == nil {
			continue
		}
		if slotID := strings.TrimSpace(service.DatabaseBinding.SlotID); slotID != "" {
			if _, exists := slots[slotID]; !exists {
				return fmt.Errorf("service %q references unknown database slot %q", service.ServiceID, slotID)
			}
		}
	}
	return nil
}

func containsTarget(targets []Target, t Target) bool {
	for _, tt := range targets {
		if tt == t {
			return true
		}
	}
	return false
}

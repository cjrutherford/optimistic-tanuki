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

type InfraKind string

const (
	InfraPostgres  InfraKind = "postgres"
	InfraRedis     InfraKind = "redis"
	InfraSeaweedFS InfraKind = "seaweedfs"
)

type ServicePoint struct {
	ServiceID string
	Hostname  string
	Path      string
	Port      int
	Public    bool
}

type DatabaseBinding struct {
	ServiceID    string
	Infra        InfraKind
	DatabaseName string
	UsernameKey  string
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
	Name         string
	Namespace    string
	Targets      []Target
	ComposeMode  ComposeMode
	ImageOwner   string
	DefaultTag   string
	IncludeInfra []InfraKind
	Services     []ServiceSelection
	ApplyCompose bool
	ApplyK8s     bool
	OutputDir    string
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
	if e.ApplyCompose && !containsTarget(e.Targets, TargetCompose) {
		return fmt.Errorf("cannot apply compose without selecting compose target")
	}
	if e.ApplyK8s && !containsTarget(e.Targets, TargetK8s) {
		return fmt.Errorf("cannot apply k8s without selecting k8s target")
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

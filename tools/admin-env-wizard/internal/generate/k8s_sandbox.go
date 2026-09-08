package generate

import (
	"fmt"
	"strings"

	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/catalog"
	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/domain"
	"gopkg.in/yaml.v3"
)

// Workloads that declare a catalog.Sandbox are written here rather than by
// generateServiceK8s.
//
// The ordinary writer has no securityContext, no emptyDir and no
// NetworkPolicy, and a workload that needs confinement generated without it is
// not a degraded deployment — it is an unconfined one. Keeping the two writers
// apart means the sandboxed shape cannot be lost to an edit made for some
// other service, and it is the reason generateServiceK8s refuses to handle
// these presets at all.
//
// The Compose counterpart is applySandbox in compose.go.

type sandboxSeccompProfile struct {
	Type string `yaml:"type"`
}

type sandboxPodSecurityContext struct {
	RunAsNonRoot   bool                   `yaml:"runAsNonRoot"`
	RunAsUser      int                    `yaml:"runAsUser,omitempty"`
	RunAsGroup     int                    `yaml:"runAsGroup,omitempty"`
	FSGroup        int                    `yaml:"fsGroup,omitempty"`
	SeccompProfile *sandboxSeccompProfile `yaml:"seccompProfile,omitempty"`
}

type sandboxCapabilities struct {
	Drop []string `yaml:"drop"`
}

type sandboxContainerSecurityContext struct {
	AllowPrivilegeEscalation bool                 `yaml:"allowPrivilegeEscalation"`
	ReadOnlyRootFilesystem   bool                 `yaml:"readOnlyRootFilesystem"`
	Capabilities             *sandboxCapabilities `yaml:"capabilities,omitempty"`
}

type sandboxContainerPort struct {
	ContainerPort int `yaml:"containerPort"`
}

type sandboxEnvVar struct {
	Name  string `yaml:"name"`
	Value string `yaml:"value"`
}

type sandboxResourceQuantities struct {
	Memory string `yaml:"memory,omitempty"`
	CPU    string `yaml:"cpu,omitempty"`
}

type sandboxResources struct {
	Requests sandboxResourceQuantities `yaml:"requests,omitempty"`
	Limits   sandboxResourceQuantities `yaml:"limits,omitempty"`
}

type sandboxVolumeMount struct {
	Name      string `yaml:"name"`
	MountPath string `yaml:"mountPath"`
}

type sandboxTCPSocket struct {
	Port int `yaml:"port"`
}

type sandboxProbe struct {
	TCPSocket           sandboxTCPSocket `yaml:"tcpSocket"`
	InitialDelaySeconds int              `yaml:"initialDelaySeconds"`
	PeriodSeconds       int              `yaml:"periodSeconds"`
}

type sandboxContainer struct {
	Name            string                           `yaml:"name"`
	Image           string                           `yaml:"image"`
	ImagePullPolicy string                           `yaml:"imagePullPolicy"`
	Ports           []sandboxContainerPort           `yaml:"ports,omitempty"`
	Env             []sandboxEnvVar                  `yaml:"env,omitempty"`
	SecurityContext *sandboxContainerSecurityContext `yaml:"securityContext,omitempty"`
	Resources       sandboxResources                 `yaml:"resources,omitempty"`
	VolumeMounts    []sandboxVolumeMount             `yaml:"volumeMounts,omitempty"`
	LivenessProbe   *sandboxProbe                    `yaml:"livenessProbe,omitempty"`
	ReadinessProbe  *sandboxProbe                    `yaml:"readinessProbe,omitempty"`
}

type sandboxEmptyDir struct {
	Medium    string `yaml:"medium,omitempty"`
	SizeLimit string `yaml:"sizeLimit,omitempty"`
}

type sandboxVolume struct {
	Name     string          `yaml:"name"`
	EmptyDir sandboxEmptyDir `yaml:"emptyDir"`
}

type sandboxPodSpec struct {
	AutomountServiceAccountToken bool                       `yaml:"automountServiceAccountToken"`
	SecurityContext              *sandboxPodSecurityContext `yaml:"securityContext,omitempty"`
	Containers                   []sandboxContainer         `yaml:"containers"`
	Volumes                      []sandboxVolume            `yaml:"volumes,omitempty"`
	RestartPolicy                string                     `yaml:"restartPolicy"`
}

type sandboxObjectMeta struct {
	// omitempty: pod templates carry labels but no name.
	Name      string            `yaml:"name,omitempty"`
	Namespace string            `yaml:"namespace,omitempty"`
	Labels    map[string]string `yaml:"labels,omitempty"`
}

type sandboxPodTemplate struct {
	Metadata sandboxObjectMeta `yaml:"metadata"`
	Spec     sandboxPodSpec    `yaml:"spec"`
}

type sandboxLabelSelector struct {
	MatchLabels map[string]string `yaml:"matchLabels"`
}

type sandboxDeploymentSpec struct {
	Replicas int                  `yaml:"replicas"`
	Selector sandboxLabelSelector `yaml:"selector"`
	Template sandboxPodTemplate   `yaml:"template"`
}

type sandboxDeployment struct {
	APIVersion string                `yaml:"apiVersion"`
	Kind       string                `yaml:"kind"`
	Metadata   sandboxObjectMeta     `yaml:"metadata"`
	Spec       sandboxDeploymentSpec `yaml:"spec"`
}

type sandboxNetworkPolicyPort struct {
	Protocol string `yaml:"protocol"`
	Port     int    `yaml:"port"`
}

type sandboxNetworkPolicyPeer struct {
	PodSelector sandboxLabelSelector `yaml:"podSelector"`
}

type sandboxNetworkPolicyIngressRule struct {
	From  []sandboxNetworkPolicyPeer `yaml:"from"`
	Ports []sandboxNetworkPolicyPort `yaml:"ports,omitempty"`
}

type sandboxNetworkPolicySpec struct {
	PodSelector sandboxLabelSelector              `yaml:"podSelector"`
	PolicyTypes []string                          `yaml:"policyTypes"`
	Ingress     []sandboxNetworkPolicyIngressRule `yaml:"ingress"`
	Egress      []struct{}                        `yaml:"egress"`
}

type sandboxNetworkPolicy struct {
	APIVersion string                   `yaml:"apiVersion"`
	Kind       string                   `yaml:"kind"`
	Metadata   sandboxObjectMeta        `yaml:"metadata"`
	Spec       sandboxNetworkPolicySpec `yaml:"spec"`
}

// generateSandboxK8s writes the Deployment, Service and NetworkPolicy for a
// workload that declares a Sandbox.
func generateSandboxK8s(preset catalog.Preset, env *domain.EnvironmentDefinition) map[string][]byte {
	files := make(map[string][]byte)
	sandbox := preset.Sandbox

	selection := findServiceSelection(env, preset.ID)
	tag := env.DefaultTag
	if selection != nil && selection.ImageTag != "" {
		tag = selection.ImageTag
	}

	replicas := preset.K8s.Replicas
	if replicas == 0 {
		replicas = 1
	}
	if selection != nil && selection.Replicas > 0 {
		replicas = selection.Replicas
	}

	labels := map[string]string{"app": preset.ID}

	container := sandboxContainer{
		Name:            preset.ID,
		Image:           fmt.Sprintf("%s:%s", preset.Image.Name, tag),
		ImagePullPolicy: "Always",
		Env:             sandboxEnv(preset.Compose.EnvDefaults),
		SecurityContext: &sandboxContainerSecurityContext{
			AllowPrivilegeEscalation: !sandbox.NoNewPrivileges,
			ReadOnlyRootFilesystem:   sandbox.ReadOnlyRootFilesystem,
		},
	}
	if sandbox.DropAllCapabilities {
		container.SecurityContext.Capabilities = &sandboxCapabilities{Drop: []string{"ALL"}}
	}

	if preset.K8s.InternalPort > 0 {
		container.Ports = []sandboxContainerPort{{ContainerPort: preset.K8s.InternalPort}}
		container.LivenessProbe = &sandboxProbe{
			TCPSocket:           sandboxTCPSocket{Port: preset.K8s.InternalPort},
			InitialDelaySeconds: 30,
			PeriodSeconds:       10,
		}
		container.ReadinessProbe = &sandboxProbe{
			TCPSocket:           sandboxTCPSocket{Port: preset.K8s.InternalPort},
			InitialDelaySeconds: 10,
			PeriodSeconds:       5,
		}
	}

	container.Resources.Requests = sandboxResourceQuantities{
		Memory: preset.K8s.Resources.Requests.Memory,
		CPU:    preset.K8s.Resources.Requests.CPU,
	}
	container.Resources.Limits = sandboxResourceQuantities{
		Memory: sandboxQuantity(sandbox.MemoryLimit),
		CPU:    preset.K8s.Resources.Limits.CPU,
	}

	volumes := make([]sandboxVolume, 0, len(sandbox.Tmpfs))
	for _, mount := range sandbox.Tmpfs {
		name := sandboxVolumeName(mount.Path)
		// Memory-backed, so it is wiped with the pod and charged against the
		// container's memory limit — the same bargain the Compose tmpfs makes.
		volumes = append(volumes, sandboxVolume{
			Name: name,
			EmptyDir: sandboxEmptyDir{
				Medium:    "Memory",
				SizeLimit: sandboxQuantity(mount.Size),
			},
		})
		container.VolumeMounts = append(container.VolumeMounts, sandboxVolumeMount{
			Name:      name,
			MountPath: mount.Path,
		})
	}

	deployment := sandboxDeployment{
		APIVersion: "apps/v1",
		Kind:       "Deployment",
		Metadata:   sandboxObjectMeta{Name: preset.ID, Namespace: env.Namespace},
		Spec: sandboxDeploymentSpec{
			Replicas: replicas,
			Selector: sandboxLabelSelector{MatchLabels: labels},
			Template: sandboxPodTemplate{
				Metadata: sandboxObjectMeta{Labels: labels},
				Spec: sandboxPodSpec{
					AutomountServiceAccountToken: false,
					SecurityContext: &sandboxPodSecurityContext{
						RunAsNonRoot:   sandbox.RunAsUser != 0,
						RunAsUser:      sandbox.RunAsUser,
						RunAsGroup:     sandbox.RunAsUser,
						FSGroup:        sandbox.RunAsUser,
						SeccompProfile: &sandboxSeccompProfile{Type: "RuntimeDefault"},
					},
					Containers:    []sandboxContainer{container},
					Volumes:       volumes,
					RestartPolicy: "Always",
				},
			},
		},
	}

	deploymentData, _ := yaml.Marshal(deployment)
	files[fmt.Sprintf("%s.yaml", preset.ID)] = append(
		[]byte(sandboxHeaderComment(preset, sandbox)),
		deploymentData...,
	)

	if preset.K8s.InternalPort > 0 {
		service := createService(preset, env, preset.K8s.InternalPort, preset.K8s.ServiceType)
		serviceData, _ := yaml.Marshal(service)
		files[fmt.Sprintf("%s-service.yaml", preset.ID)] = serviceData
	}

	if len(sandbox.IngressFrom) > 0 {
		policyData, _ := yaml.Marshal(sandboxNetworkPolicyFor(preset, env))
		files[fmt.Sprintf("%s-networkpolicy.yaml", preset.ID)] = append(
			[]byte(sandboxNetworkPolicyComment()),
			policyData...,
		)
	}

	return files
}

func sandboxNetworkPolicyFor(preset catalog.Preset, env *domain.EnvironmentDefinition) sandboxNetworkPolicy {
	sandbox := preset.Sandbox

	from := make([]sandboxNetworkPolicyPeer, 0, len(sandbox.IngressFrom))
	for _, callerID := range sandbox.IngressFrom {
		from = append(from, sandboxNetworkPolicyPeer{
			PodSelector: sandboxLabelSelector{MatchLabels: map[string]string{"app": callerID}},
		})
	}

	rule := sandboxNetworkPolicyIngressRule{From: from}
	if preset.K8s.InternalPort > 0 {
		rule.Ports = []sandboxNetworkPolicyPort{
			{Protocol: "TCP", Port: preset.K8s.InternalPort},
		}
	}

	return sandboxNetworkPolicy{
		APIVersion: "networking.k8s.io/v1",
		Kind:       "NetworkPolicy",
		Metadata: sandboxObjectMeta{
			Name:      fmt.Sprintf("%s-isolation", preset.ID),
			Namespace: env.Namespace,
		},
		Spec: sandboxNetworkPolicySpec{
			PodSelector: sandboxLabelSelector{MatchLabels: map[string]string{"app": preset.ID}},
			PolicyTypes: []string{"Ingress", "Egress"},
			Ingress:     []sandboxNetworkPolicyIngressRule{rule},
			// An empty egress list denies all outbound traffic, DNS included.
			Egress: []struct{}{},
		},
	}
}

func sandboxHeaderComment(preset catalog.Preset, sandbox *catalog.Sandbox) string {
	lines := []string{
		fmt.Sprintf("# %s runs confined; every field below is load-bearing.", preset.ID),
		"#",
	}

	if sandbox.PidsLimit > 0 {
		lines = append(lines,
			fmt.Sprintf(
				"# The Compose deployment also sets pids_limit: %d. Kubernetes has no",
				sandbox.PidsLimit,
			),
			"# pod-level process limit — it is the kubelet's --pod-max-pids — so set that",
			"# on any node this schedules to. Until then the memory limit is the only",
			"# backstop against a fork bomb.",
			"#",
		)
	}

	lines = append(lines,
		"# Generated by internal/generate/k8s_sandbox.go from the preset's Sandbox.",
		"",
	)

	return strings.Join(lines, "\n")
}

func sandboxNetworkPolicyComment() string {
	return strings.Join([]string{
		"# Requires a CNI that enforces NetworkPolicy (Calico, Cilium). Under a CNI",
		"# that ignores policy this applies cleanly and enforces nothing, which would",
		"# leave the workload with full cluster and internet egress. Confirm",
		"# enforcement before trusting it.",
		"",
	}, "\n")
}

func sandboxEnv(values map[string]string) []sandboxEnvVar {
	ordered := orderedK8sEnv(values)
	result := make([]sandboxEnvVar, 0, len(ordered))
	for _, entry := range ordered {
		result = append(result, sandboxEnvVar{Name: entry.Name, Value: entry.Value})
	}
	return result
}

// sandboxQuantity converts a Compose size ("16m", "512m", "1g") into the
// Kubernetes quantity for the same amount ("16Mi", "512Mi", "1Gi"). Compose
// reads a bare suffix as binary, so the mebibyte/gibibyte forms are the
// faithful translation, not the decimal ones.
func sandboxQuantity(size string) string {
	if size == "" {
		return ""
	}

	suffixes := map[byte]string{
		'k': "Ki", 'K': "Ki",
		'm': "Mi", 'M': "Mi",
		'g': "Gi", 'G': "Gi",
	}

	last := size[len(size)-1]
	if unit, ok := suffixes[last]; ok {
		return size[:len(size)-1] + unit
	}

	return size
}

// sandboxVolumeName turns a mount path into a name a Volume can carry:
// "/scratch" becomes "scratch", "/var/tmp" becomes "var-tmp".
func sandboxVolumeName(path string) string {
	trimmed := strings.Trim(path, "/")
	if trimmed == "" {
		return "scratch"
	}
	return strings.ReplaceAll(trimmed, "/", "-")
}

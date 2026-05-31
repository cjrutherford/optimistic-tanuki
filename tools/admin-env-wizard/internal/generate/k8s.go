package generate

import (
	"fmt"
	"sort"

	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/catalog"
	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/domain"
	"gopkg.in/yaml.v3"
)

type K8sNamespace struct {
	APIVersion string `yaml:"apiVersion"`
	Kind       string `yaml:"kind"`
	Metadata   struct {
		Name string `yaml:"name"`
	} `yaml:"metadata"`
}

type K8sPVC struct {
	APIVersion string `yaml:"apiVersion"`
	Kind       string `yaml:"kind"`
	Metadata   struct {
		Name      string `yaml:"name"`
		Namespace string `yaml:"namespace"`
	} `yaml:"metadata"`
	Spec struct {
		AccessModes []string `yaml:"accessModes"`
		Resources   struct {
			Requests struct {
				Storage string `yaml:"storage"`
			} `yaml:"requests"`
		} `yaml:"resources"`
		StorageClassName string `yaml:"storageClassName"`
	} `yaml:"spec"`
}

type K8sDeployment struct {
	APIVersion string `yaml:"apiVersion"`
	Kind       string `yaml:"kind"`
	Metadata   struct {
		Name      string `yaml:"name"`
		Namespace string `yaml:"namespace"`
	} `yaml:"metadata"`
	Spec struct {
		Replicas int `yaml:"replicas"`
		Selector struct {
			MatchLabels map[string]string `yaml:"matchLabels"`
		} `yaml:"selector"`
		Template struct {
			Metadata struct {
				Labels map[string]string `yaml:"labels"`
			} `yaml:"metadata"`
			Spec struct {
				Containers []struct {
					Name  string `yaml:"name"`
					Image string `yaml:"image"`
					Ports []struct {
						ContainerPort int `yaml:"containerPort"`
					} `yaml:"ports"`
					Env []struct {
						Name  string `yaml:"name"`
						Value string `yaml:"value"`
					} `yaml:"env"`
					Resources struct {
						Requests struct {
							Memory string `yaml:"memory"`
							CPU    string `yaml:"cpu"`
						} `yaml:"requests"`
						Limits struct {
							Memory string `yaml:"memory"`
							CPU    string `yaml:"cpu"`
						} `yaml:"limits"`
					} `yaml:"resources"`
					VolumeMounts []struct {
						Name      string `yaml:"name"`
						MountPath string `yaml:"mountPath"`
					} `yaml:"volumeMounts"`
				} `yaml:"containers"`
				Volumes []struct {
					Name                  string `yaml:"name"`
					PersistentVolumeClaim *struct {
						ClaimName string `yaml:"claimName"`
					} `yaml:"persistentVolumeClaim"`
					ConfigMap *struct {
						Name string `yaml:"name"`
					} `yaml:"configMap"`
				} `yaml:"volumes"`
				RestartPolicy string `yaml:"restartPolicy"`
			} `yaml:"spec"`
		} `yaml:"template"`
	} `yaml:"spec"`
}

type K8sService struct {
	APIVersion string `yaml:"apiVersion"`
	Kind       string `yaml:"kind"`
	Metadata   struct {
		Name      string `yaml:"name"`
		Namespace string `yaml:"namespace"`
	} `yaml:"metadata"`
	Spec struct {
		Selector map[string]string `yaml:"selector"`
		Ports    []struct {
			Port       int `yaml:"port"`
			TargetPort int `yaml:"targetPort"`
		} `yaml:"ports"`
		Type      string `yaml:"type"`
		ClusterIP string `yaml:"clusterIP"`
	} `yaml:"spec"`
}

type Kustomization struct {
	APIVersion            string   `yaml:"apiVersion"`
	Kind                  string   `yaml:"kind"`
	Namespace             string   `yaml:"namespace"`
	Resources             []string `yaml:"resources,omitempty"`
	PatchesStrategicMerge []string `yaml:"patchesStrategicMerge,omitempty"`
}

func GenerateK8s(env *domain.EnvironmentDefinition, cat *catalog.Catalog) (map[string][]byte, error) {
	files := make(map[string][]byte)

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

		for _, dep := range preset.Dependencies {
			if dep.Database != "" {
				enabledInfra[dep.Database] = true
			}
		}
	}

	baseResources := []string{"namespace.yaml"}
	needsVideoProcessingPVC := false

	for kind := range enabledInfra {
		infra, ok := cat.Infra(kind)
		if !ok {
			continue
		}
		infraFiles := generateInfraK8s(infra, env)
		for name, data := range infraFiles {
			files[filepathJoin("base", name)] = data
			baseResources = append(baseResources, name)
		}
	}

	for _, sel := range env.Services {
		if !sel.Enabled {
			continue
		}
		preset, ok := cat.Get(sel.ServiceID)
		if !ok {
			continue
		}

		serviceFiles := generateServiceK8s(preset, env)
		for name, data := range serviceFiles {
			files[filepathJoin("base", name)] = data
			baseResources = append(baseResources, name)
		}
		for _, volume := range preset.Compose.Volumes {
			if volume == "video-processing-data:/tmp/video-processing" {
				needsVideoProcessingPVC = true
			}
		}
	}

	if needsVideoProcessingPVC {
		videoPVC := K8sPVC{
			APIVersion: "v1",
			Kind:       "PersistentVolumeClaim",
		}
		videoPVC.Metadata.Name = "video-processing-data"
		videoPVC.Metadata.Namespace = env.Namespace
		videoPVC.Spec.AccessModes = []string{"ReadWriteOnce"}
		videoPVC.Spec.Resources.Requests.Storage = "50Gi"
		videoPVC.Spec.StorageClassName = profileFor(env.Provider).StorageClassName
		videoPVCData, err := yaml.Marshal(videoPVC)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal video processing pvc: %w", err)
		}
		files["base/video-processing-data-pvc.yaml"] = videoPVCData
		baseResources = append(baseResources, "video-processing-data-pvc.yaml")
	}

	sort.Strings(baseResources)

	baseKustomization := Kustomization{
		APIVersion: "kustomize.config.k8s.io/v1beta1",
		Kind:       "Kustomization",
		Namespace:  env.Namespace,
		Resources:  baseResources,
	}
	baseKustomizationData, err := yaml.Marshal(baseKustomization)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal base kustomization: %w", err)
	}
	files["base/kustomization.yaml"] = baseKustomizationData

	ns := K8sNamespace{
		APIVersion: "v1",
		Kind:       "Namespace",
	}
	ns.Metadata.Name = env.Namespace
	namespaceData, err := yaml.Marshal(ns)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal namespace: %w", err)
	}
	files["base/namespace.yaml"] = namespaceData

	gatewayComposition, err := GenerateGatewayComposition(env, cat)
	if err != nil {
		return nil, fmt.Errorf("failed to generate gateway composition: %w", err)
	}
	files["base/gateway-composition-configmap.yaml"] = []byte(fmt.Sprintf(`apiVersion: v1
kind: ConfigMap
metadata:
  name: gateway-composition
  namespace: %s
data:
  composition.yaml: |
%s`, env.Namespace, indentYAML(string(gatewayComposition), 4)))
	baseResources = append(baseResources, "gateway-composition-configmap.yaml")
	sort.Strings(baseResources)
	baseKustomization.Resources = baseResources
	baseKustomizationData, err = yaml.Marshal(baseKustomization)
	if err != nil {
		return nil, fmt.Errorf("failed to remarshal base kustomization: %w", err)
	}
	files["base/kustomization.yaml"] = baseKustomizationData

	overlayData, overlayErr := yaml.Marshal(Kustomization{
		APIVersion:            "kustomize.config.k8s.io/v1beta1",
		Kind:                  "Kustomization",
		Namespace:             env.Namespace,
		Resources:             []string{"../../base"},
		PatchesStrategicMerge: []string{"provider-patch.yaml"},
	})
	if overlayErr != nil {
		return nil, fmt.Errorf("failed to marshal provider overlay: %w", overlayErr)
	}
	files[fmt.Sprintf("overlays/%s/kustomization.yaml", env.Provider)] = overlayData
	files[fmt.Sprintf("overlays/%s/provider-patch.yaml", env.Provider)] = []byte(providerPatch(env.Provider))

	rootKustomizationData, err := yaml.Marshal(Kustomization{
		APIVersion: "kustomize.config.k8s.io/v1beta1",
		Kind:       "Kustomization",
		Namespace:  env.Namespace,
		Resources: []string{
			fmt.Sprintf("overlays/%s", env.Provider),
		},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to marshal root kustomization: %w", err)
	}
	files["kustomization.yaml"] = rootKustomizationData

	return files, nil
}

func filepathJoin(parts ...string) string {
	result := ""
	for i, part := range parts {
		if i == 0 {
			result = part
			continue
		}
		result = result + "/" + part
	}
	return result
}

func indentYAML(value string, spaces int) string {
	prefix := ""
	for i := 0; i < spaces; i++ {
		prefix += " "
	}

	lines := ""
	for _, line := range splitLines(value) {
		lines += prefix + line + "\n"
	}

	return lines
}

func splitLines(value string) []string {
	lines := []string{}
	start := 0
	for i := 0; i < len(value); i++ {
		if value[i] == '\n' {
			lines = append(lines, value[start:i])
			start = i + 1
		}
	}
	if start < len(value) {
		lines = append(lines, value[start:])
	}
	if len(lines) == 0 {
		return []string{""}
	}
	return lines
}

func providerPatch(provider domain.Provider) string {
	profile := profileFor(provider)
	gatewayAnnotationKey := ""
	gatewayAnnotationValue := ""
	for key, value := range profile.GatewayServiceAnnotations {
		gatewayAnnotationKey = key
		gatewayAnnotationValue = value
	}

	gateway := profile.Workloads["gateway"]
	authentication := profile.Workloads["authentication"]

	return fmt.Sprintf(`apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
spec:
  storageClassName: %s
  resources:
    requests:
      storage: %s
---
apiVersion: v1
kind: Service
metadata:
  name: gateway
  annotations:
    %s: %s
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: gateway
spec:
  replicas: %d
  template:
    spec:
      containers:
        - name: gateway
          resources:
            requests:
              cpu: %s
              memory: %s
            limits:
              cpu: %s
              memory: %s
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: %d
          readinessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: %d
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: authentication
spec:
  replicas: %d
  template:
    spec:
      containers:
        - name: authentication
          resources:
            requests:
              cpu: %s
              memory: %s
            limits:
              cpu: %s
              memory: %s
          livenessProbe:
            httpGet:
              path: /health
              port: 3001
            initialDelaySeconds: %d
          readinessProbe:
            httpGet:
              path: /health
              port: 3001
            initialDelaySeconds: %d
`, profile.StorageClassName, profile.StorageSize, gatewayAnnotationKey, gatewayAnnotationValue, gateway.Replicas, gateway.RequestCPU, composeMemoryToK8s(gateway.RequestMemory), gateway.LimitCPU, composeMemoryToK8s(gateway.LimitMemory), gateway.LivenessInitial, gateway.ReadinessInitial, authentication.Replicas, authentication.RequestCPU, composeMemoryToK8s(authentication.RequestMemory), authentication.LimitCPU, composeMemoryToK8s(authentication.LimitMemory), authentication.LivenessInitial, authentication.ReadinessInitial)
}

func composeMemoryToK8s(memory string) string {
	if len(memory) >= 2 && memory[len(memory)-1] == 'M' {
		return memory[:len(memory)-1] + "Mi"
	}
	return memory
}

func generateInfraK8s(preset catalog.Preset, env *domain.EnvironmentDefinition) map[string][]byte {
	files := make(map[string][]byte)

	switch preset.ID {
	case "postgres":
		slot := findDatabaseSlot(env, "postgres-primary")
		profile := profileFor(env.Provider)
		pvc := K8sPVC{
			APIVersion: "v1",
			Kind:       "PersistentVolumeClaim",
		}
		pvc.Metadata.Name = "postgres-pvc"
		pvc.Metadata.Namespace = env.Namespace
		pvc.Spec.AccessModes = []string{"ReadWriteOnce"}
		pvc.Spec.Resources.Requests.Storage = profile.StorageSize
		pvc.Spec.StorageClassName = profile.StorageClassName
		pvcData, _ := yaml.Marshal(pvc)
		files["postgres-pvc.yaml"] = pvcData

		deployment := createDeployment(preset, env, 5432)
		username := "postgres"
		password := "POSTGRES_PASSWORD"
		databaseName := "postgres"
		if slot != nil {
			username = slot.Username
			password = slot.PasswordKey
			databaseName = slot.DatabaseName
		}
		deployment.Spec.Template.Spec.Containers[0].Env = []struct {
			Name  string `yaml:"name"`
			Value string `yaml:"value"`
		}{
			{Name: "POSTGRES_USER", Value: username},
			{Name: "POSTGRES_PASSWORD", Value: password},
			{Name: "POSTGRES_DB", Value: databaseName},
		}
		deployment.Spec.Template.Spec.Volumes = []struct {
			Name                  string `yaml:"name"`
			PersistentVolumeClaim *struct {
				ClaimName string `yaml:"claimName"`
			} `yaml:"persistentVolumeClaim"`
			ConfigMap *struct {
				Name string `yaml:"name"`
			} `yaml:"configMap"`
		}{
			{
				Name: "postgres-data",
				PersistentVolumeClaim: &struct {
					ClaimName string `yaml:"claimName"`
				}{ClaimName: "postgres-pvc"},
			},
		}
		deployment.Spec.Template.Spec.Containers[0].VolumeMounts = []struct {
			Name      string `yaml:"name"`
			MountPath string `yaml:"mountPath"`
		}{
			{Name: "postgres-data", MountPath: "/var/lib/postgresql/data"},
		}
		deploymentData, _ := yaml.Marshal(deployment)
		files["postgres.yaml"] = deploymentData

		service := createService(preset, env, 5432, "None")
		serviceData, _ := yaml.Marshal(service)
		files["postgres-service.yaml"] = serviceData

	case "redis":
		deployment := createDeployment(preset, env, 6379)
		deploymentData, _ := yaml.Marshal(deployment)
		files["redis.yaml"] = deploymentData

		service := createService(preset, env, 6379, "ClusterIP")
		serviceData, _ := yaml.Marshal(service)
		files["redis-service.yaml"] = serviceData
	}

	return files
}

func generateServiceK8s(preset catalog.Preset, env *domain.EnvironmentDefinition) map[string][]byte {
	files := make(map[string][]byte)
	profile := profileFor(env.Provider)
	tuning := workloadTuningForProfile(profile, preset.ID, string(preset.Category))
	selection := findServiceSelection(env, preset.ID)
	tag := env.DefaultTag
	if selection != nil && selection.ImageTag != "" {
		tag = selection.ImageTag
	}
	imageName := fmt.Sprintf("%s:%s", preset.Image.Name, tag)

	replicas := preset.K8s.Replicas
	if replicas == 0 {
		replicas = 1
	}
	if tuning.Replicas > 0 {
		replicas = tuning.Replicas
	}
	if selection != nil && selection.Replicas > 0 {
		replicas = selection.Replicas
	}

	deployment := K8sDeployment{
		APIVersion: "apps/v1",
		Kind:       "Deployment",
	}
	deployment.Metadata.Name = preset.ID
	deployment.Metadata.Namespace = env.Namespace
	deployment.Spec.Replicas = replicas
	deployment.Spec.Selector.MatchLabels = map[string]string{"app": preset.ID}
	deployment.Spec.Template.Metadata.Labels = map[string]string{"app": preset.ID}

	container := struct {
		Name  string `yaml:"name"`
		Image string `yaml:"image"`
		Ports []struct {
			ContainerPort int `yaml:"containerPort"`
		} `yaml:"ports"`
		Env []struct {
			Name  string `yaml:"name"`
			Value string `yaml:"value"`
		} `yaml:"env"`
		Resources struct {
			Requests struct {
				Memory string `yaml:"memory"`
				CPU    string `yaml:"cpu"`
			} `yaml:"requests"`
			Limits struct {
				Memory string `yaml:"memory"`
				CPU    string `yaml:"cpu"`
			} `yaml:"limits"`
		} `yaml:"resources"`
		VolumeMounts []struct {
			Name      string `yaml:"name"`
			MountPath string `yaml:"mountPath"`
		} `yaml:"volumeMounts"`
	}{
		Name:  preset.ID,
		Image: imageName,
	}

	if preset.K8s.InternalPort > 0 {
		container.Ports = []struct {
			ContainerPort int `yaml:"containerPort"`
		}{{ContainerPort: preset.K8s.InternalPort}}
	}

	envValues := map[string]string{}
	for k, v := range preset.Compose.EnvDefaults {
		envValues[k] = v
	}
	envValues = applyServiceDatabaseEnv(envValues, env, selection)

	if tuning.RequestMemory != "" {
		container.Resources.Requests.Memory = composeMemoryToK8s(tuning.RequestMemory)
	}
	if tuning.RequestCPU != "" {
		container.Resources.Requests.CPU = tuning.RequestCPU
	}
	if tuning.LimitMemory != "" {
		container.Resources.Limits.Memory = composeMemoryToK8s(tuning.LimitMemory)
	}
	if tuning.LimitCPU != "" {
		container.Resources.Limits.CPU = tuning.LimitCPU
	}

	if preset.ID == "gateway" {
		envValues["GATEWAY_COMPOSITION_PATH"] = "/etc/optimistic-tanuki/gateway/composition.yaml"
		deployment.Spec.Template.Spec.Volumes = append(
			deployment.Spec.Template.Spec.Volumes,
			struct {
				Name                  string `yaml:"name"`
				PersistentVolumeClaim *struct {
					ClaimName string `yaml:"claimName"`
				} `yaml:"persistentVolumeClaim"`
				ConfigMap *struct {
					Name string `yaml:"name"`
				} `yaml:"configMap"`
			}{
				Name: "gateway-composition",
				ConfigMap: &struct {
					Name string `yaml:"name"`
				}{
					Name: "gateway-composition",
				},
			},
		)
		container.VolumeMounts = append(
			container.VolumeMounts,
			struct {
				Name      string `yaml:"name"`
				MountPath string `yaml:"mountPath"`
			}{
				Name:      "gateway-composition",
				MountPath: "/etc/optimistic-tanuki/gateway",
			},
		)
	}
	container.Env = orderedK8sEnv(envValues)

	for _, volume := range preset.Compose.Volumes {
		switch volume {
		case "video-processing-data:/tmp/video-processing":
			if deployment.Spec.Replicas > 1 {
				deployment.Spec.Replicas = 1
			}
			deployment.Spec.Template.Spec.Volumes = append(
				deployment.Spec.Template.Spec.Volumes,
				struct {
					Name                  string `yaml:"name"`
					PersistentVolumeClaim *struct {
						ClaimName string `yaml:"claimName"`
					} `yaml:"persistentVolumeClaim"`
					ConfigMap *struct {
						Name string `yaml:"name"`
					} `yaml:"configMap"`
				}{
					Name: "video-processing-data",
					PersistentVolumeClaim: &struct {
						ClaimName string `yaml:"claimName"`
					}{
						ClaimName: "video-processing-data",
					},
				},
			)
			container.VolumeMounts = append(container.VolumeMounts, struct {
				Name      string `yaml:"name"`
				MountPath string `yaml:"mountPath"`
			}{Name: "video-processing-data", MountPath: "/tmp/video-processing"})
		}
	}

	deployment.Spec.Template.Spec.Containers = []struct {
		Name  string `yaml:"name"`
		Image string `yaml:"image"`
		Ports []struct {
			ContainerPort int `yaml:"containerPort"`
		} `yaml:"ports"`
		Env []struct {
			Name  string `yaml:"name"`
			Value string `yaml:"value"`
		} `yaml:"env"`
		Resources struct {
			Requests struct {
				Memory string `yaml:"memory"`
				CPU    string `yaml:"cpu"`
			} `yaml:"requests"`
			Limits struct {
				Memory string `yaml:"memory"`
				CPU    string `yaml:"cpu"`
			} `yaml:"limits"`
		} `yaml:"resources"`
		VolumeMounts []struct {
			Name      string `yaml:"name"`
			MountPath string `yaml:"mountPath"`
		} `yaml:"volumeMounts"`
	}{container}

	deployment.Spec.Template.Spec.RestartPolicy = "Always"

	deploymentData, _ := yaml.Marshal(deployment)
	files[fmt.Sprintf("%s.yaml", preset.ID)] = deploymentData

	if preset.K8s.InternalPort > 0 {
		service := createService(preset, env, preset.K8s.InternalPort, preset.K8s.ServiceType)
		serviceData, _ := yaml.Marshal(service)
		files[fmt.Sprintf("%s-service.yaml", preset.ID)] = serviceData
	}

	return files
}

func orderedK8sEnv(values map[string]string) []struct {
	Name  string `yaml:"name"`
	Value string `yaml:"value"`
} {
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	result := make([]struct {
		Name  string `yaml:"name"`
		Value string `yaml:"value"`
	}, 0, len(keys))
	for _, key := range keys {
		result = append(result, struct {
			Name  string `yaml:"name"`
			Value string `yaml:"value"`
		}{Name: key, Value: values[key]})
	}
	return result
}

func createDeployment(preset catalog.Preset, env *domain.EnvironmentDefinition, port int) K8sDeployment {
	replicas := preset.K8s.Replicas
	if replicas == 0 {
		replicas = 1
	}

	d := K8sDeployment{
		APIVersion: "apps/v1",
		Kind:       "Deployment",
	}
	d.Metadata.Name = preset.ID
	d.Metadata.Namespace = env.Namespace
	d.Spec.Replicas = replicas
	d.Spec.Selector.MatchLabels = map[string]string{"app": preset.ID}
	d.Spec.Template.Metadata.Labels = map[string]string{"app": preset.ID}
	d.Spec.Template.Spec.Containers = []struct {
		Name  string `yaml:"name"`
		Image string `yaml:"image"`
		Ports []struct {
			ContainerPort int `yaml:"containerPort"`
		} `yaml:"ports"`
		Env []struct {
			Name  string `yaml:"name"`
			Value string `yaml:"value"`
		} `yaml:"env"`
		Resources struct {
			Requests struct {
				Memory string `yaml:"memory"`
				CPU    string `yaml:"cpu"`
			} `yaml:"requests"`
			Limits struct {
				Memory string `yaml:"memory"`
				CPU    string `yaml:"cpu"`
			} `yaml:"limits"`
		} `yaml:"resources"`
		VolumeMounts []struct {
			Name      string `yaml:"name"`
			MountPath string `yaml:"mountPath"`
		} `yaml:"volumeMounts"`
	}{{
		Name:  preset.ID,
		Image: fmt.Sprintf("%s:%s", preset.Image.Name, preset.Image.Tag),
		Ports: []struct {
			ContainerPort int `yaml:"containerPort"`
		}{{ContainerPort: port}},
	}}
	d.Spec.Template.Spec.RestartPolicy = "Always"

	return d
}

func createService(preset catalog.Preset, env *domain.EnvironmentDefinition, port int, serviceType string) K8sService {
	s := K8sService{
		APIVersion: "v1",
		Kind:       "Service",
	}
	s.Metadata.Name = preset.ID
	s.Metadata.Namespace = env.Namespace
	s.Spec.Selector = map[string]string{"app": preset.ID}
	s.Spec.Ports = []struct {
		Port       int `yaml:"port"`
		TargetPort int `yaml:"targetPort"`
	}{{Port: port, TargetPort: port}}
	s.Spec.Type = serviceType
	s.Spec.ClusterIP = ""

	return s
}

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
	APIVersion string   `yaml:"apiVersion"`
	Kind       string   `yaml:"kind"`
	Namespace  string   `yaml:"namespace"`
	Resources  []string `yaml:"resources"`
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

	resources := []string{}

	for kind := range enabledInfra {
		infra, ok := cat.Infra(kind)
		if !ok {
			continue
		}
		infraFiles := generateInfraK8s(infra, env)
		for name, data := range infraFiles {
			files[name] = data
			resources = append(resources, name)
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
			files[name] = data
			resources = append(resources, name)
		}
	}

	sort.Strings(resources)

	kustomization := Kustomization{
		APIVersion: "kustomize.config.k8s.io/v1beta1",
		Kind:       "Kustomization",
		Namespace:  env.Namespace,
		Resources:  resources,
	}
	kustomizationData, err := yaml.Marshal(kustomization)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal kustomization: %w", err)
	}
	files["kustomization.yaml"] = kustomizationData

	ns := K8sNamespace{
		APIVersion: "v1",
		Kind:       "Namespace",
	}
	ns.Metadata.Name = env.Namespace
	namespaceData, err := yaml.Marshal(ns)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal namespace: %w", err)
	}
	files["namespace.yaml"] = namespaceData

	return files, nil
}

func generateInfraK8s(preset catalog.Preset, env *domain.EnvironmentDefinition) map[string][]byte {
	files := make(map[string][]byte)

	switch preset.ID {
	case "postgres":
		pvc := K8sPVC{
			APIVersion: "v1",
			Kind:       "PersistentVolumeClaim",
		}
		pvc.Metadata.Name = "postgres-pvc"
		pvc.Metadata.Namespace = env.Namespace
		pvc.Spec.AccessModes = []string{"ReadWriteOnce"}
		pvc.Spec.Resources.Requests.Storage = "10Gi"
		pvc.Spec.StorageClassName = "microk8s-hostpath"
		pvcData, _ := yaml.Marshal(pvc)
		files["postgres-pvc.yaml"] = pvcData

		deployment := createDeployment(preset, env, 5432)
		deployment.Spec.Template.Spec.Containers[0].Env = []struct {
			Name  string `yaml:"name"`
			Value string `yaml:"value"`
		}{
			{Name: "POSTGRES_USER", Value: "postgres"},
			{Name: "POSTGRES_PASSWORD", Value: "postgres"},
			{Name: "POSTGRES_DB", Value: "postgres"},
		}
		deployment.Spec.Template.Spec.Volumes = []struct {
			Name                  string `yaml:"name"`
			PersistentVolumeClaim *struct {
				ClaimName string `yaml:"claimName"`
			} `yaml:"persistentVolumeClaim"`
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

	imageName := fmt.Sprintf("%s:%s", preset.Image.Name, env.DefaultTag)

	replicas := preset.K8s.Replicas
	if replicas == 0 {
		replicas = 1
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

	for k, v := range preset.Compose.EnvDefaults {
		container.Env = append(container.Env, struct {
			Name  string `yaml:"name"`
			Value string `yaml:"value"`
		}{Name: k, Value: v})
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

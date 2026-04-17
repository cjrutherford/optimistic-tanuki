package catalog

import (
	"sort"
	"strings"
)

func (c *Catalog) DeployableApps() []DeployableApp {
	apps := make([]DeployableApp, 0, len(c.presets))

	for _, preset := range c.presets {
		if preset.Category == CategoryInfra {
			continue
		}

		composeServiceName := preset.Compose.ServiceName
		if composeServiceName == "" {
			composeServiceName = preset.ID
		}

		manifestDir := "services"
		if preset.Category == CategoryClient {
			manifestDir = "clients"
		}
		manifestPath := "k8s/base/" + manifestDir + "/" + preset.ID + ".yaml"
		if preset.ID == "gateway" {
			manifestPath = "k8s/base/gateway.yaml"
		}

		apps = append(apps, DeployableApp{
			ID:                 preset.ID,
			BuildAppID:         buildAppIDFromDockerfile(preset.Compose.Dockerfile),
			Category:           preset.Category,
			ComposeServiceName: composeServiceName,
			Dockerfile:         preset.Compose.Dockerfile,
			ImageName:          preset.Image.Name,
			K8sManifestPath:    manifestPath,
		})
	}

	sort.Slice(apps, func(i, j int) bool {
		return apps[i].ID < apps[j].ID
	})

	return apps
}

func buildAppIDFromDockerfile(dockerfile string) string {
	trimmed := strings.TrimPrefix(dockerfile, "./apps/")
	trimmed = strings.TrimSuffix(trimmed, "/Dockerfile")
	if trimmed == "" || trimmed == dockerfile {
		return ""
	}
	return trimmed
}

package catalog

import (
	"fmt"
	"sort"
)

func (c *Catalog) initCapabilities() {
	c.capabilities = map[string][]string{
		"community": {"authentication", "profile", "social", "permissions"},
		"commerce":  {"authentication", "profile", "permissions", "store", "payments"},
		"creator":   {"authentication", "profile", "blogging", "assets"},
		"knowledge": {"authentication", "profile", "telos-docs-service", "prompt-proxy"},
		"wellness":  {"authentication", "profile", "wellness", "ai-orchestration"},
	}
}

func (c *Catalog) ResolveServices(capabilities []string, baseServices []string, explicitServices []string) ([]string, error) {
	selected := make(map[string]struct{})

	for _, serviceID := range baseServices {
		selected[serviceID] = struct{}{}
	}

	for _, capability := range capabilities {
		services, ok := c.capabilities[capability]
		if !ok {
			return nil, fmt.Errorf("unknown capability %q", capability)
		}
		for _, serviceID := range services {
			selected[serviceID] = struct{}{}
		}
	}

	for _, serviceID := range explicitServices {
		selected[serviceID] = struct{}{}
	}

	queue := make([]string, 0, len(selected))
	for serviceID := range selected {
		queue = append(queue, serviceID)
	}

	for len(queue) > 0 {
		serviceID := queue[0]
		queue = queue[1:]

		preset, ok := c.Get(serviceID)
		if !ok {
			continue
		}

		for _, dep := range preset.Dependencies {
			if !dep.Required {
				continue
			}
			if _, ok := selected[dep.ServiceID]; ok {
				continue
			}
			selected[dep.ServiceID] = struct{}{}
			queue = append(queue, dep.ServiceID)
		}
	}

	resolved := make([]string, 0, len(selected))
	for serviceID := range selected {
		resolved = append(resolved, serviceID)
	}
	sort.Strings(resolved)

	return resolved, nil
}

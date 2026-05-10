package generate

import (
	"sort"

	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/catalog"
	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/domain"
	"gopkg.in/yaml.v3"
)

type GatewayComposition struct {
	Version          string   `yaml:"version"`
	Provider         string   `yaml:"provider"`
	Capabilities     []string `yaml:"capabilities,omitempty"`
	EnabledServices  []string `yaml:"enabledServices"`
	ExposedRoutes    []string `yaml:"exposedRoutes,omitempty"`
}

var gatewayRoutesByService = map[string][]string{
	"authentication":   {"authentication", "oauth"},
	"profile":          {"profile"},
	"social":           {"social", "communities", "social-community", "social-follow", "social-search"},
	"permissions":      {"permissions"},
	"store":            {"store"},
	"payments":         {"payments", "donations"},
	"blogging":         {"blog", "post", "contact", "event", "blog-components"},
	"assets":           {"asset"},
	"telos-docs-service": {"persona"},
	"wellness":         {"wellness"},
}

func GenerateGatewayComposition(env *domain.EnvironmentDefinition, _ *catalog.Catalog) ([]byte, error) {
	enabledServices := make([]string, 0, len(env.Services))
	routes := make(map[string]struct{})

	for _, sel := range env.Services {
		if !sel.Enabled {
			continue
		}
		enabledServices = append(enabledServices, sel.ServiceID)
		for _, route := range gatewayRoutesByService[sel.ServiceID] {
			routes[route] = struct{}{}
		}
	}

	sort.Strings(enabledServices)

	exposedRoutes := make([]string, 0, len(routes))
	for route := range routes {
		exposedRoutes = append(exposedRoutes, route)
	}
	sort.Strings(exposedRoutes)

	return yaml.Marshal(GatewayComposition{
		Version:         "v1alpha1",
		Provider:        string(env.Provider),
		Capabilities:    env.Capabilities,
		EnabledServices: enabledServices,
		ExposedRoutes:   exposedRoutes,
	})
}

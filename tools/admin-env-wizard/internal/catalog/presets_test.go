package catalog

import (
	"testing"

	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/domain"
)

func TestCatalogIncludesGatewayPreset(t *testing.T) {
	catalog := DefaultCatalog()
	preset, ok := catalog.Get("gateway")
	if !ok {
		t.Fatal("expected gateway preset")
	}
	if preset.Compose.ContainerPort != 3000 {
		t.Fatalf("expected port 3000, got %d", preset.Compose.ContainerPort)
	}
}

func TestCatalogIncludesInfraPresets(t *testing.T) {
	catalog := DefaultCatalog()

	tests := []struct {
		id    string
		infra domain.InfraKind
	}{
		{"postgres", domain.InfraPostgres},
		{"redis", domain.InfraRedis},
		{"seaweedfs", domain.InfraSeaweedFS},
	}

	for _, tt := range tests {
		t.Run(tt.id, func(t *testing.T) {
			preset, ok := catalog.Get(tt.id)
			if !ok {
				t.Fatalf("expected %s preset", tt.id)
			}
			if preset.Category != CategoryInfra {
				t.Errorf("expected category infra, got %s", preset.Category)
			}
			infraPreset, infraOk := catalog.Infra(tt.infra)
			if !infraOk {
				t.Errorf("expected infra lookup for %s", tt.infra)
			}
			if preset.ID != infraPreset.ID {
				t.Errorf("preset and infra lookup mismatch")
			}
		})
	}
}

func TestCatalogIncludesServicePresets(t *testing.T) {
	catalog := DefaultCatalog()

	tests := []string{"gateway", "authentication", "profile", "app-configurator", "system-configurator-api"}

	for _, id := range tests {
		t.Run(id, func(t *testing.T) {
			preset, ok := catalog.Get(id)
			if !ok {
				t.Fatalf("expected %s preset", id)
			}
			if preset.Category != CategoryService {
				t.Errorf("expected category service, got %s", preset.Category)
			}
		})
	}
}

func TestCatalogIncludesClientPresets(t *testing.T) {
	catalog := DefaultCatalog()

	tests := []string{"client-interface", "configurable-client", "system-configurator"}

	for _, id := range tests {
		t.Run(id, func(t *testing.T) {
			preset, ok := catalog.Get(id)
			if !ok {
				t.Fatalf("expected %s preset", id)
			}
			if preset.Category != CategoryClient {
				t.Errorf("expected category client, got %s", preset.Category)
			}
		})
	}
}

func TestCatalogByCategory(t *testing.T) {
	catalog := DefaultCatalog()

	infra := catalog.ByCategory(CategoryInfra)
	if len(infra) == 0 {
		t.Error("expected infra presets")
	}

	services := catalog.ByCategory(CategoryService)
	if len(services) == 0 {
		t.Error("expected service presets")
	}

	clients := catalog.ByCategory(CategoryClient)
	if len(clients) == 0 {
		t.Error("expected client presets")
	}
}

func TestCatalogGatewayDependencies(t *testing.T) {
	catalog := DefaultCatalog()
	preset, ok := catalog.Get("gateway")
	if !ok {
		t.Fatal("expected gateway preset")
	}

	if len(preset.Dependencies) == 0 {
		t.Error("expected gateway to have dependencies")
	}

	var hasPostgres, hasRedis bool
	for _, dep := range preset.Dependencies {
		if dep.ServiceID == "postgres" && dep.Database == domain.InfraPostgres {
			hasPostgres = true
		}
		if dep.ServiceID == "redis" && dep.Database == domain.InfraRedis {
			hasRedis = true
		}
	}
	if !hasPostgres {
		t.Error("expected postgres dependency in gateway")
	}
	if !hasRedis {
		t.Error("expected redis dependency in gateway")
	}
}

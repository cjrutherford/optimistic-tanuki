package catalog

import (
	"github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/domain"
)

func DefaultCatalog() *Catalog {
	c := &Catalog{
		presets: make(map[string]Preset),
		infra:   make(map[domain.InfraKind]Preset),
	}

	c.initInfra()
	c.initServices()
	c.initClients()

	return c
}

func (c *Catalog) initInfra() {
	c.infra[domain.InfraPostgres] = Preset{
		ID:       "postgres",
		Name:     "PostgreSQL",
		Category: CategoryInfra,
		Compose: ComposeMetadata{
			ContainerPort: 5432,
			ExternalPort:  5432,
			EnvDefaults: map[string]string{
				"POSTGRES_USER":     "postgres",
				"POSTGRES_PASSWORD": "postgres",
				"POSTGRES_DB":       "postgres",
			},
			Volumes: []string{"postgres_data:/var/lib/postgresql/data"},
		},
		K8s: K8sMetadata{
			Replicas:     1,
			InternalPort: 5432,
			ServiceType:  "ClusterIP",
			Resources: ResourceLimits{
				Requests: MemoryCPU{Memory: "256Mi", CPU: "250m"},
				Limits:   MemoryCPU{Memory: "2Gi", CPU: "1000m"},
			},
			Probes: ProbesConfig{
				Liveness:  ProbeConfig{Initial: 30, Period: 10},
				Readiness: ProbeConfig{Initial: 5, Period: 5},
			},
		},
		Image: ImageMetadata{Name: "postgres", Tag: "17"},
	}

	c.infra[domain.InfraRedis] = Preset{
		ID:       "redis",
		Name:     "Redis",
		Category: CategoryInfra,
		Compose: ComposeMetadata{
			ContainerPort: 6379,
			ExternalPort:  6379,
			EnvDefaults:   map[string]string{},
		},
		K8s: K8sMetadata{
			Replicas:     1,
			InternalPort: 6379,
			ServiceType:  "ClusterIP",
			Resources: ResourceLimits{
				Requests: MemoryCPU{Memory: "128Mi", CPU: "100m"},
				Limits:   MemoryCPU{Memory: "512Mi", CPU: "500m"},
			},
			Probes: ProbesConfig{
				Liveness:  ProbeConfig{Initial: 30, Period: 10},
				Readiness: ProbeConfig{Initial: 5, Period: 5},
			},
		},
		Image: ImageMetadata{Name: "redis", Tag: "latest"},
	}

	c.infra[domain.InfraSeaweedFS] = Preset{
		ID:       "seaweedfs",
		Name:     "SeaweedFS",
		Category: CategoryInfra,
		Compose: ComposeMetadata{
			ContainerPort: 8080,
			ExternalPort:  8080,
			EnvDefaults:   map[string]string{},
		},
		K8s: K8sMetadata{
			Replicas:     1,
			InternalPort: 8080,
			ServiceType:  "ClusterIP",
			Resources:    ResourceLimits{},
			Probes:       ProbesConfig{},
		},
		Image: ImageMetadata{Name: "chrislusf/seaweedfs", Tag: "latest"},
	}

	c.presets["postgres"] = c.infra[domain.InfraPostgres]
	c.presets["redis"] = c.infra[domain.InfraRedis]
	c.presets["seaweedfs"] = c.infra[domain.InfraSeaweedFS]
}

func (c *Catalog) initServices() {
	services := []Preset{
		{
			ID:       "gateway",
			Name:     "Gateway API",
			Category: CategoryService,
			Compose: ComposeMetadata{
				BuildContext:  ".",
				Dockerfile:    "./apps/gateway/Dockerfile",
				ContainerPort: 3000,
				ExternalPort:  3000,
				DependsOn:     []string{"postgres", "authentication", "ot-client-interface", "profile", "social"},
				EnvDefaults: map[string]string{
					"NODE_ENV":      "production",
					"LISTEN_PORT":   "3000",
					"POSTGRES_HOST": "postgres",
					"POSTGRES_PORT": "5432",
					"REDIS_HOST":    "redis",
					"REDIS_PORT":    "6379",
				},
			},
			K8s: K8sMetadata{
				Replicas:     2,
				InternalPort: 3000,
				ServiceType:  "ClusterIP",
				Resources: ResourceLimits{
					Requests: MemoryCPU{Memory: "256Mi", CPU: "250m"},
					Limits:   MemoryCPU{Memory: "1Gi", CPU: "1000m"},
				},
				Probes: ProbesConfig{
					Liveness:  ProbeConfig{Path: "/api/mcp/sse", Port: 3000, Initial: 60, Period: 10},
					Readiness: ProbeConfig{Path: "/api/mcp/sse", Port: 3000, Initial: 30, Period: 5},
				},
			},
			Image: ImageMetadata{Name: "cjrutherford/optimistic_tanuki_gateway", Tag: "latest"},
			Dependencies: []Dependency{
				{ServiceID: "authentication", Required: true},
				{ServiceID: "profile", Required: false},
				{ServiceID: "social", Required: false},
				{ServiceID: "chat-collector", Required: false},
				{ServiceID: "assets", Required: false},
				{ServiceID: "prompt-proxy", Required: false},
				{ServiceID: "ai-orchestration", Required: false},
				{ServiceID: "telos-docs-service", Required: false},
				{ServiceID: "blogging", Required: false},
				{ServiceID: "permissions", Required: false},
				{ServiceID: "project-planning", Required: false},
				{ServiceID: "forum", Required: false},
				{ServiceID: "wellness", Required: false},
				{ServiceID: "classifieds", Required: false},
				{ServiceID: "payments", Required: false},
				{ServiceID: "store", Required: false},
				{ServiceID: "app-configurator", Required: false},
				{ServiceID: "system-configurator-api", Required: false},
				{ServiceID: "postgres", Required: true, Database: domain.InfraPostgres},
				{ServiceID: "redis", Required: false, Database: domain.InfraRedis},
			},
		},
		{
			ID:       "authentication",
			Name:     "Authentication Service",
			Category: CategoryService,
			Compose: ComposeMetadata{
				BuildContext:  ".",
				Dockerfile:    "./apps/authentication/Dockerfile",
				ContainerPort: 3001,
				ExternalPort:  3001,
				DependsOn:     []string{"postgres"},
				EnvDefaults: map[string]string{
					"NODE_ENV": "production",
					"PORT":     "3001",
				},
			},
			K8s: K8sMetadata{
				Replicas:     2,
				InternalPort: 3001,
				ServiceType:  "ClusterIP",
				Resources: ResourceLimits{
					Requests: MemoryCPU{Memory: "128Mi", CPU: "100m"},
					Limits:   MemoryCPU{Memory: "512Mi", CPU: "500m"},
				},
			},
			Image: ImageMetadata{Name: "cjrutherford/optimistic_tanuki_authentication", Tag: "latest"},
			Dependencies: []Dependency{
				{ServiceID: "postgres", Required: true, Database: domain.InfraPostgres},
			},
		},
		{
			ID:       "profile",
			Name:     "Profile Service",
			Category: CategoryService,
			Compose: ComposeMetadata{
				BuildContext:  ".",
				Dockerfile:    "./apps/profile/Dockerfile",
				ContainerPort: 3002,
				ExternalPort:  3002,
				DependsOn:     []string{"postgres"},
				EnvDefaults:   map[string]string{},
			},
			K8s: K8sMetadata{
				Replicas:     2,
				InternalPort: 3002,
				ServiceType:  "ClusterIP",
				Resources:    ResourceLimits{},
			},
			Image: ImageMetadata{Name: "cjrutherford/optimistic_tanuki_profile", Tag: "latest"},
			Dependencies: []Dependency{
				{ServiceID: "postgres", Required: true, Database: domain.InfraPostgres},
			},
		},
		{
			ID:       "social",
			Name:     "Social Service",
			Category: CategoryService,
			Compose: ComposeMetadata{
				BuildContext:  ".",
				Dockerfile:    "./apps/social/Dockerfile",
				ContainerPort: 3003,
				ExternalPort:  3003,
				DependsOn:     []string{"postgres"},
				EnvDefaults:   map[string]string{},
			},
			K8s: K8sMetadata{
				Replicas:     2,
				InternalPort: 3003,
				ServiceType:  "ClusterIP",
				Resources:    ResourceLimits{},
			},
			Image: ImageMetadata{Name: "cjrutherford/optimistic_tanuki_social", Tag: "latest"},
			Dependencies: []Dependency{
				{ServiceID: "postgres", Required: true, Database: domain.InfraPostgres},
			},
		},
		{
			ID:       "app-configurator",
			Name:     "App Configurator",
			Category: CategoryService,
			Compose: ComposeMetadata{
				BuildContext:  ".",
				Dockerfile:    "./apps/app-configurator/Dockerfile",
				ContainerPort: 3014,
				ExternalPort:  3014,
				DependsOn:     []string{"postgres", "redis"},
				EnvDefaults:   map[string]string{},
			},
			K8s: K8sMetadata{
				Replicas:     2,
				InternalPort: 3014,
				ServiceType:  "ClusterIP",
				Resources:    ResourceLimits{},
			},
			Image: ImageMetadata{Name: "cjrutherford/optimistic_tanuki_app-configurator", Tag: "latest"},
			Dependencies: []Dependency{
				{ServiceID: "postgres", Required: true, Database: domain.InfraPostgres},
				{ServiceID: "redis", Required: true, Database: domain.InfraRedis},
			},
		},
		{
			ID:       "system-configurator-api",
			Name:     "System Configurator API",
			Category: CategoryService,
			Compose: ComposeMetadata{
				BuildContext:  ".",
				Dockerfile:    "./apps/system-configurator-api/Dockerfile",
				ContainerPort: 3021,
				ExternalPort:  3021,
				DependsOn:     []string{"postgres"},
				EnvDefaults: map[string]string{
					"NODE_ENV":    "production",
					"PORT":        "3021",
					"DB_HOST":     "postgres",
					"DB_PORT":     "5432",
					"DB_USER":     "postgres",
					"DB_PASSWORD": "postgres",
					"DB_NAME":     "ot_system_configurator",
				},
			},
			K8s: K8sMetadata{
				Replicas:     2,
				InternalPort: 3021,
				ServiceType:  "ClusterIP",
				SecretRef:    "optimistic-tanuki-secrets",
				EnvFrom:      []string{"DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME"},
				Resources:    ResourceLimits{},
			},
			Image: ImageMetadata{Name: "cjrutherford/optimistic_tanuki_system-configurator-api", Tag: "latest"},
			Dependencies: []Dependency{
				{ServiceID: "postgres", Required: true, Database: domain.InfraPostgres},
			},
		},
		{
			ID:       "chat-collector",
			Name:     "Chat Collector",
			Category: CategoryService,
			Compose: ComposeMetadata{
				BuildContext:  ".",
				Dockerfile:    "./apps/chat-collector/Dockerfile",
				ContainerPort: 3007,
				ExternalPort:  3007,
				DependsOn:     []string{"postgres"},
				EnvDefaults:   map[string]string{},
			},
			K8s: K8sMetadata{
				Replicas:     2,
				InternalPort: 3007,
				ServiceType:  "ClusterIP",
				Resources:    ResourceLimits{},
			},
			Image: ImageMetadata{Name: "cjrutherford/optimistic_tanuki_chat-collector", Tag: "latest"},
			Dependencies: []Dependency{
				{ServiceID: "postgres", Required: true, Database: domain.InfraPostgres},
			},
		},
		{
			ID:       "assets",
			Name:     "Assets Service",
			Category: CategoryService,
			Compose: ComposeMetadata{
				BuildContext:  ".",
				Dockerfile:    "./apps/assets/Dockerfile",
				ContainerPort: 3005,
				ExternalPort:  3005,
				DependsOn:     []string{"postgres"},
				EnvDefaults: map[string]string{
					"STORAGE_STRATEGY": "local",
				},
				Volumes: []string{"${ASSETS_HOST_PATH:-/mnt/valhalla/media/tanuki-assets}:/usr/src/app/storage"},
			},
			K8s: K8sMetadata{
				Replicas:     2,
				InternalPort: 3005,
				ServiceType:  "ClusterIP",
				Resources:    ResourceLimits{},
			},
			Image: ImageMetadata{Name: "cjrutherford/optimistic_tanuki_assets", Tag: "latest"},
			Dependencies: []Dependency{
				{ServiceID: "postgres", Required: true, Database: domain.InfraPostgres},
			},
		},
		{
			ID:       "ai-orchestration",
			Name:     "AI Orchestration",
			Category: CategoryService,
			Compose: ComposeMetadata{
				BuildContext:  ".",
				Dockerfile:    "./apps/ai-orchestrator/Dockerfile",
				ContainerPort: 3010,
				ExternalPort:  3010,
				DependsOn:     []string{"postgres", "prompt-proxy", "telos-docs-service"},
				EnvDefaults:   map[string]string{},
			},
			K8s: K8sMetadata{
				Replicas:     2,
				InternalPort: 3010,
				ServiceType:  "ClusterIP",
				Resources:    ResourceLimits{},
			},
			Image: ImageMetadata{Name: "cjrutherford/optimistic_tanuki_ai-orchestrator", Tag: "latest"},
			Dependencies: []Dependency{
				{ServiceID: "postgres", Required: true, Database: domain.InfraPostgres},
				{ServiceID: "prompt-proxy", Required: false},
				{ServiceID: "telos-docs-service", Required: false},
			},
		},
		{
			ID:       "prompt-proxy",
			Name:     "Prompt Proxy",
			Category: CategoryService,
			Compose: ComposeMetadata{
				BuildContext:  ".",
				Dockerfile:    "./apps/prompt-proxy/Dockerfile",
				ContainerPort: 3009,
				ExternalPort:  3009,
				DependsOn:     []string{"postgres"},
				EnvDefaults:   map[string]string{},
			},
			K8s: K8sMetadata{
				Replicas:     2,
				InternalPort: 3009,
				ServiceType:  "ClusterIP",
				Resources:    ResourceLimits{},
			},
			Image: ImageMetadata{Name: "cjrutherford/optimistic_tanuki_prompt-proxy", Tag: "latest"},
			Dependencies: []Dependency{
				{ServiceID: "postgres", Required: true, Database: domain.InfraPostgres},
			},
		},
		{
			ID:       "telos-docs-service",
			Name:     "Telos Docs Service",
			Category: CategoryService,
			Compose: ComposeMetadata{
				BuildContext:  ".",
				Dockerfile:    "./apps/telos-docs-service/Dockerfile",
				ContainerPort: 3008,
				ExternalPort:  3008,
				DependsOn:     []string{"postgres"},
				EnvDefaults:   map[string]string{},
			},
			K8s: K8sMetadata{
				Replicas:     2,
				InternalPort: 3008,
				ServiceType:  "ClusterIP",
				Resources:    ResourceLimits{},
			},
			Image: ImageMetadata{Name: "cjrutherford/optimistic_tanuki_telos-docs-service", Tag: "latest"},
			Dependencies: []Dependency{
				{ServiceID: "postgres", Required: true, Database: domain.InfraPostgres},
			},
		},
		{
			ID:       "blogging",
			Name:     "Blogging Service",
			Category: CategoryService,
			Compose: ComposeMetadata{
				BuildContext:  ".",
				Dockerfile:    "./apps/blogging/Dockerfile",
				ContainerPort: 3011,
				ExternalPort:  3011,
				DependsOn:     []string{"postgres"},
				EnvDefaults:   map[string]string{},
			},
			K8s: K8sMetadata{
				Replicas:     2,
				InternalPort: 3011,
				ServiceType:  "ClusterIP",
				Resources:    ResourceLimits{},
			},
			Image: ImageMetadata{Name: "cjrutherford/optimistic_tanuki_blogging", Tag: "latest"},
			Dependencies: []Dependency{
				{ServiceID: "postgres", Required: true, Database: domain.InfraPostgres},
			},
		},
		{
			ID:       "permissions",
			Name:     "Permissions Service",
			Category: CategoryService,
			Compose: ComposeMetadata{
				BuildContext:  ".",
				Dockerfile:    "./apps/permissions/Dockerfile",
				ContainerPort: 3012,
				ExternalPort:  3012,
				DependsOn:     []string{"postgres"},
				EnvDefaults:   map[string]string{},
			},
			K8s: K8sMetadata{
				Replicas:     2,
				InternalPort: 3012,
				ServiceType:  "ClusterIP",
				Resources:    ResourceLimits{},
			},
			Image: ImageMetadata{Name: "cjrutherford/optimistic_tanuki_permissions", Tag: "latest"},
			Dependencies: []Dependency{
				{ServiceID: "postgres", Required: true, Database: domain.InfraPostgres},
			},
		},
		{
			ID:       "project-planning",
			Name:     "Project Planning Service",
			Category: CategoryService,
			Compose: ComposeMetadata{
				BuildContext:  ".",
				Dockerfile:    "./apps/project-planning/Dockerfile",
				ContainerPort: 3006,
				ExternalPort:  3006,
				DependsOn:     []string{"postgres"},
				EnvDefaults:   map[string]string{},
			},
			K8s: K8sMetadata{
				Replicas:     2,
				InternalPort: 3006,
				ServiceType:  "ClusterIP",
				Resources:    ResourceLimits{},
			},
			Image: ImageMetadata{Name: "cjrutherford/optimistic_tanuki_project-planning", Tag: "latest"},
			Dependencies: []Dependency{
				{ServiceID: "postgres", Required: true, Database: domain.InfraPostgres},
			},
		},
		{
			ID:       "forum",
			Name:     "Forum Service",
			Category: CategoryService,
			Compose: ComposeMetadata{
				BuildContext:  ".",
				Dockerfile:    "./apps/forum/Dockerfile",
				ContainerPort: 3015,
				ExternalPort:  3015,
				DependsOn:     []string{"postgres"},
				EnvDefaults:   map[string]string{},
			},
			K8s: K8sMetadata{
				Replicas:     2,
				InternalPort: 3015,
				ServiceType:  "ClusterIP",
				Resources:    ResourceLimits{},
			},
			Image: ImageMetadata{Name: "cjrutherford/optimistic_tanuki_forum", Tag: "latest"},
			Dependencies: []Dependency{
				{ServiceID: "postgres", Required: true, Database: domain.InfraPostgres},
			},
		},
		{
			ID:       "wellness",
			Name:     "Wellness Service",
			Category: CategoryService,
			Compose: ComposeMetadata{
				BuildContext:  ".",
				Dockerfile:    "./apps/wellness/Dockerfile",
				ContainerPort: 3018,
				ExternalPort:  3018,
				DependsOn:     []string{"postgres"},
				EnvDefaults:   map[string]string{},
			},
			K8s: K8sMetadata{
				Replicas:     2,
				InternalPort: 3018,
				ServiceType:  "ClusterIP",
				Resources:    ResourceLimits{},
			},
			Image: ImageMetadata{Name: "cjrutherford/optimistic_tanuki_wellness", Tag: "latest"},
			Dependencies: []Dependency{
				{ServiceID: "postgres", Required: true, Database: domain.InfraPostgres},
			},
		},
		{
			ID:       "classifieds",
			Name:     "Classifieds Service",
			Category: CategoryService,
			Compose: ComposeMetadata{
				BuildContext:  ".",
				Dockerfile:    "./apps/classifieds/Dockerfile",
				ContainerPort: 3017,
				ExternalPort:  3017,
				DependsOn:     []string{"postgres"},
				EnvDefaults:   map[string]string{},
			},
			K8s: K8sMetadata{
				Replicas:     2,
				InternalPort: 3017,
				ServiceType:  "ClusterIP",
				Resources:    ResourceLimits{},
			},
			Image: ImageMetadata{Name: "cjrutherford/optimistic_tanuki_classifieds", Tag: "latest"},
			Dependencies: []Dependency{
				{ServiceID: "postgres", Required: true, Database: domain.InfraPostgres},
			},
		},
		{
			ID:       "finance",
			Name:     "Finance Service",
			Category: CategoryService,
			Compose: ComposeMetadata{
				BuildContext:  ".",
				Dockerfile:    "./apps/finance/Dockerfile",
				ContainerPort: 3016,
				ExternalPort:  3016,
				DependsOn:     []string{"postgres"},
				EnvDefaults: map[string]string{
					"NODE_ENV": "production",
					"PORT":     "3016",
				},
			},
			K8s: K8sMetadata{
				Replicas:     2,
				InternalPort: 3016,
				ServiceType:  "ClusterIP",
				Resources: ResourceLimits{
					Requests: MemoryCPU{Memory: "128Mi", CPU: "100m"},
					Limits:   MemoryCPU{Memory: "512Mi", CPU: "500m"},
				},
				Probes: ProbesConfig{
					Liveness:  ProbeConfig{Port: 3016, Initial: 30, Period: 10},
					Readiness: ProbeConfig{Port: 3016, Initial: 10, Period: 5},
				},
			},
			Image: ImageMetadata{Name: "cjrutherford/optimistic_tanuki_finance", Tag: "latest"},
			Dependencies: []Dependency{
				{ServiceID: "postgres", Required: true, Database: domain.InfraPostgres},
			},
		},
		{
			ID:       "payments",
			Name:     "Payments Service",
			Category: CategoryService,
			Compose: ComposeMetadata{
				BuildContext:  ".",
				Dockerfile:    "./apps/payments/Dockerfile",
				ContainerPort: 3004,
				ExternalPort:  3004,
				DependsOn:     []string{"postgres"},
				EnvDefaults:   map[string]string{},
			},
			K8s: K8sMetadata{
				Replicas:     2,
				InternalPort: 3004,
				ServiceType:  "ClusterIP",
				Resources:    ResourceLimits{},
			},
			Image: ImageMetadata{Name: "cjrutherford/optimistic_tanuki_payments", Tag: "latest"},
			Dependencies: []Dependency{
				{ServiceID: "postgres", Required: true, Database: domain.InfraPostgres},
			},
		},
		{
			ID:       "store",
			Name:     "Store Service",
			Category: CategoryService,
			Compose: ComposeMetadata{
				BuildContext:  ".",
				Dockerfile:    "./apps/store/Dockerfile",
				ContainerPort: 3009,
				ExternalPort:  3013,
				DependsOn:     []string{"postgres"},
				EnvDefaults:   map[string]string{},
			},
			K8s: K8sMetadata{
				Replicas:     2,
				InternalPort: 3009,
				ServiceType:  "ClusterIP",
				Resources:    ResourceLimits{},
			},
			Image: ImageMetadata{Name: "cjrutherford/optimistic_tanuki_store", Tag: "latest"},
			Dependencies: []Dependency{
				{ServiceID: "postgres", Required: true, Database: domain.InfraPostgres},
			},
		},
		{
			ID:       "lead-tracker",
			Name:     "Lead Tracker",
			Category: CategoryService,
			Compose: ComposeMetadata{
				BuildContext:  ".",
				Dockerfile:    "./apps/lead-tracker/Dockerfile",
				ContainerPort: 3020,
				ExternalPort:  3020,
				DependsOn:     []string{"postgres"},
				EnvDefaults:   map[string]string{},
			},
			K8s: K8sMetadata{
				Replicas:     2,
				InternalPort: 3020,
				ServiceType:  "ClusterIP",
				Resources:    ResourceLimits{},
			},
			Image: ImageMetadata{Name: "cjrutherford/optimistic_tanuki_lead-tracker", Tag: "latest"},
			Dependencies: []Dependency{
				{ServiceID: "postgres", Required: true, Database: domain.InfraPostgres},
			},
		},
	}

	for _, s := range services {
		c.presets[s.ID] = s
	}
}

func (c *Catalog) initClients() {
	clients := []Preset{
		{
			ID:       "client-interface",
			Name:     "Client Interface",
			Category: CategoryClient,
			Compose: ComposeMetadata{
				ServiceName:   "ot-client-interface",
				BuildContext:  ".",
				Dockerfile:    "./apps/client-interface/Dockerfile",
				ContainerPort: 4000,
				ExternalPort:  8080,
				DependsOn:     []string{"gateway"},
				EnvDefaults: map[string]string{
					"NODE_ENV": "production",
					"PORT":     "4000",
				},
			},
			K8s: K8sMetadata{
				Replicas:     2,
				InternalPort: 4000,
				ServiceType:  "ClusterIP",
				Resources:    ResourceLimits{},
			},
			Image: ImageMetadata{Name: "cjrutherford/optimistic_tanuki_client-interface", Tag: "latest"},
			Dependencies: []Dependency{
				{ServiceID: "gateway", Required: true, ServicePoint: true},
			},
		},
		{
			ID:       "forgeofwill",
			Name:     "Forge of Will Client",
			Category: CategoryClient,
			Compose: ComposeMetadata{
				ServiceName:   "forgeofwill-client-interface",
				BuildContext:  ".",
				Dockerfile:    "./apps/forgeofwill/Dockerfile",
				ContainerPort: 4000,
				ExternalPort:  8081,
				DependsOn:     []string{"gateway"},
				EnvDefaults:   map[string]string{},
			},
			K8s: K8sMetadata{
				Replicas:     2,
				InternalPort: 4000,
				ServiceType:  "ClusterIP",
				Resources:    ResourceLimits{},
			},
			Image: ImageMetadata{Name: "cjrutherford/optimistic_tanuki_forgeofwill", Tag: "latest"},
			Dependencies: []Dependency{
				{ServiceID: "gateway", Required: true, ServicePoint: true},
			},
		},
		{
			ID:       "digital-homestead",
			Name:     "Digital Homestead Client",
			Category: CategoryClient,
			Compose: ComposeMetadata{
				ServiceName:   "digital-homestead-client-interface",
				BuildContext:  ".",
				Dockerfile:    "./apps/digital-homestead/Dockerfile",
				ContainerPort: 4000,
				ExternalPort:  8082,
				DependsOn:     []string{"gateway"},
				EnvDefaults:   map[string]string{},
			},
			K8s: K8sMetadata{
				Replicas:     2,
				InternalPort: 4000,
				ServiceType:  "ClusterIP",
				Resources:    ResourceLimits{},
			},
			Image: ImageMetadata{Name: "cjrutherford/optimistic_tanuki_digital-homestead", Tag: "latest"},
			Dependencies: []Dependency{
				{ServiceID: "gateway", Required: true, ServicePoint: true},
			},
		},
		{
			ID:       "hai",
			Name:     "HAI Client",
			Category: CategoryClient,
			Compose: ComposeMetadata{
				ServiceName:   "hai-client-interface",
				BuildContext:  ".",
				Dockerfile:    "./apps/hai/Dockerfile",
				ContainerPort: 4000,
				ExternalPort:  8088,
				DependsOn:     []string{"gateway"},
				EnvDefaults:   map[string]string{},
			},
			K8s: K8sMetadata{
				Replicas:     2,
				InternalPort: 4000,
				ServiceType:  "ClusterIP",
				Resources:    ResourceLimits{},
			},
			Image: ImageMetadata{Name: "cjrutherford/optimistic_tanuki_hai", Tag: "latest"},
			Dependencies: []Dependency{
				{ServiceID: "gateway", Required: true, ServicePoint: true},
			},
		},
		{
			ID:       "christopherrutherford-net",
			Name:     "Christopher Rutherford Client",
			Category: CategoryClient,
			Compose: ComposeMetadata{
				ServiceName:   "crdn-client-interface",
				BuildContext:  ".",
				Dockerfile:    "./apps/christopherrutherford-net/Dockerfile",
				ContainerPort: 4000,
				ExternalPort:  8083,
				DependsOn:     []string{"gateway"},
				EnvDefaults:   map[string]string{},
			},
			K8s: K8sMetadata{
				Replicas:     2,
				InternalPort: 4000,
				ServiceType:  "ClusterIP",
				Resources:    ResourceLimits{},
			},
			Image: ImageMetadata{Name: "cjrutherford/optimistic_tanuki_christopherrutherford-net", Tag: "latest"},
			Dependencies: []Dependency{
				{ServiceID: "gateway", Required: true, ServicePoint: true},
			},
		},
		{
			ID:       "owner-console",
			Name:     "Owner Console",
			Category: CategoryClient,
			Compose: ComposeMetadata{
				BuildContext:  ".",
				Dockerfile:    "./apps/owner-console/Dockerfile",
				ContainerPort: 4000,
				ExternalPort:  8084,
				DependsOn:     []string{"gateway"},
				EnvDefaults:   map[string]string{},
			},
			K8s: K8sMetadata{
				Replicas:     2,
				InternalPort: 4000,
				ServiceType:  "ClusterIP",
				Resources:    ResourceLimits{},
			},
			Image: ImageMetadata{Name: "cjrutherford/optimistic_tanuki_owner-console", Tag: "latest"},
			Dependencies: []Dependency{
				{ServiceID: "gateway", Required: true, ServicePoint: true},
			},
		},
		{
			ID:       "fin-commander",
			Name:     "Fin Commander",
			Category: CategoryClient,
			Compose: ComposeMetadata{
				BuildContext:  ".",
				Dockerfile:    "./apps/fin-commander/Dockerfile",
				ContainerPort: 4000,
				ExternalPort:  8089,
				DependsOn:     []string{"gateway"},
				EnvDefaults: map[string]string{
					"NODE_ENV":    "production",
					"PORT":        "4000",
					"GATEWAY_URL": "http://gateway:3000",
				},
			},
			K8s: K8sMetadata{
				Replicas:     2,
				InternalPort: 4000,
				ServiceType:  "LoadBalancer",
				Resources: ResourceLimits{
					Requests: MemoryCPU{Memory: "64Mi", CPU: "50m"},
					Limits:   MemoryCPU{Memory: "256Mi", CPU: "250m"},
				},
				Probes: ProbesConfig{
					Liveness:  ProbeConfig{Port: 4000, Initial: 30, Period: 10},
					Readiness: ProbeConfig{Port: 4000, Initial: 10, Period: 5},
				},
			},
			Image: ImageMetadata{Name: "cjrutherford/optimistic_tanuki_fin-commander", Tag: "latest"},
			Dependencies: []Dependency{
				{ServiceID: "gateway", Required: true, ServicePoint: true},
			},
		},
		{
			ID:       "marketing-generator",
			Name:     "Marketing Generator",
			Category: CategoryClient,
			Compose: ComposeMetadata{
				BuildContext:  ".",
				Dockerfile:    "./apps/marketing-generator/Dockerfile",
				ContainerPort: 4000,
				ExternalPort:  8092,
				DependsOn:     []string{"gateway"},
				EnvDefaults: map[string]string{
					"NODE_ENV":    "production",
					"PORT":        "4000",
					"GATEWAY_URL": "http://gateway:3000",
				},
			},
			K8s: K8sMetadata{
				Replicas:     2,
				InternalPort: 4000,
				ServiceType:  "ClusterIP",
				Resources:    ResourceLimits{},
			},
			Image: ImageMetadata{Name: "cjrutherford/optimistic_tanuki_marketing-generator", Tag: "latest"},
			Dependencies: []Dependency{
				{ServiceID: "gateway", Required: true, ServicePoint: true},
			},
		},
		{
			ID:       "store-client",
			Name:     "Store Client",
			Category: CategoryClient,
			Compose: ComposeMetadata{
				BuildContext:  ".",
				Dockerfile:    "./apps/store-client/Dockerfile",
				ContainerPort: 4000,
				ExternalPort:  8085,
				DependsOn:     []string{"gateway"},
				EnvDefaults:   map[string]string{},
			},
			K8s: K8sMetadata{
				Replicas:     2,
				InternalPort: 4000,
				ServiceType:  "ClusterIP",
				Resources:    ResourceLimits{},
			},
			Image: ImageMetadata{Name: "cjrutherford/optimistic_tanuki_store-client", Tag: "latest"},
			Dependencies: []Dependency{
				{ServiceID: "gateway", Required: true, ServicePoint: true},
			},
		},
		{
			ID:       "configurable-client",
			Name:     "Configurable Client",
			Category: CategoryClient,
			Compose: ComposeMetadata{
				BuildContext:  ".",
				Dockerfile:    "./apps/configurable-client/Dockerfile",
				ContainerPort: 4000,
				ExternalPort:  8090,
				DependsOn:     []string{"gateway", "app-configurator"},
				EnvDefaults:   map[string]string{},
			},
			K8s: K8sMetadata{
				Replicas:     2,
				InternalPort: 4000,
				ServiceType:  "ClusterIP",
				Resources:    ResourceLimits{},
			},
			Image: ImageMetadata{Name: "cjrutherford/optimistic_tanuki_configurable-client", Tag: "latest"},
			Dependencies: []Dependency{
				{ServiceID: "gateway", Required: true, ServicePoint: true},
				{ServiceID: "app-configurator", Required: false},
			},
		},
		{
			ID:       "system-configurator",
			Name:     "System Configurator",
			Category: CategoryClient,
			Compose: ComposeMetadata{
				BuildContext:  ".",
				Dockerfile:    "./apps/system-configurator/Dockerfile",
				ContainerPort: 4000,
				ExternalPort:  8091,
				DependsOn:     []string{"gateway", "system-configurator-api"},
				EnvDefaults: map[string]string{
					"NODE_ENV":    "production",
					"PORT":        "4000",
					"GATEWAY_URL": "http://gateway:3000",
				},
			},
			K8s: K8sMetadata{
				Replicas:     2,
				InternalPort: 4000,
				ServiceType:  "ClusterIP",
				Resources:    ResourceLimits{},
			},
			Image: ImageMetadata{Name: "cjrutherford/optimistic_tanuki_system-configurator", Tag: "latest"},
			Dependencies: []Dependency{
				{ServiceID: "gateway", Required: true, ServicePoint: true},
				{ServiceID: "system-configurator-api", Required: false},
			},
		},
		{
			ID:       "d6",
			Name:     "D6 Client",
			Category: CategoryClient,
			Compose: ComposeMetadata{
				BuildContext:  ".",
				Dockerfile:    "./apps/d6/Dockerfile",
				ContainerPort: 4000,
				ExternalPort:  8086,
				DependsOn:     []string{"gateway"},
				EnvDefaults:   map[string]string{},
			},
			K8s: K8sMetadata{
				Replicas:     2,
				InternalPort: 4000,
				ServiceType:  "ClusterIP",
				Resources:    ResourceLimits{},
			},
			Image: ImageMetadata{Name: "cjrutherford/optimistic_tanuki_d6", Tag: "latest"},
			Dependencies: []Dependency{
				{ServiceID: "gateway", Required: true, ServicePoint: true},
			},
		},
		{
			ID:       "local-hub",
			Name:     "Local Hub Client",
			Category: CategoryClient,
			Compose: ComposeMetadata{
				ServiceName:   "local-hub-client-interface",
				BuildContext:  ".",
				Dockerfile:    "./apps/local-hub/Dockerfile",
				ContainerPort: 4000,
				ExternalPort:  8087,
				DependsOn:     []string{"gateway"},
				EnvDefaults: map[string]string{
					"GATEWAY_URL":    "http://gateway:3000",
					"GATEWAY_WS_URL": "http://gateway:3300",
				},
			},
			K8s: K8sMetadata{
				Replicas:     2,
				InternalPort: 4000,
				ServiceType:  "ClusterIP",
				Resources:    ResourceLimits{},
			},
			Image: ImageMetadata{Name: "cjrutherford/optimistic_tanuki_local-hub", Tag: "latest"},
			Dependencies: []Dependency{
				{ServiceID: "gateway", Required: true, ServicePoint: true},
			},
		},
		{
			ID:       "leads-app",
			Name:     "Leads App",
			Category: CategoryClient,
			Compose: ComposeMetadata{
				BuildContext:  ".",
				Dockerfile:    "./apps/leads-app/Dockerfile",
				ContainerPort: 4000,
				ExternalPort:  4201,
				DependsOn:     []string{"gateway"},
				EnvDefaults:   map[string]string{},
			},
			K8s: K8sMetadata{
				Replicas:     2,
				InternalPort: 4000,
				ServiceType:  "ClusterIP",
				Resources:    ResourceLimits{},
			},
			Image: ImageMetadata{Name: "cjrutherford/optimistic_tanuki_leads-app", Tag: "latest"},
			Dependencies: []Dependency{
				{ServiceID: "gateway", Required: true, ServicePoint: true},
			},
		},
	}

	for _, client := range clients {
		c.presets[client.ID] = client
	}
}

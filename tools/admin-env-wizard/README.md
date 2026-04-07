# Admin Environment Wizard

A Go-based CLI tool for generating Docker Compose and Kubernetes deployment configurations for the Optimistic Tanuki project.

## Installation

```bash
cd tools/admin-env-wizard
go build -o admin-env ./cmd/admin-env/
```

Or run directly:

```bash
go run ./cmd/admin-env
```

## Usage

### Basic Generation

```bash
cd tools/admin-env-wizard
./admin-env
```

This generates deployment configurations in `dist/admin-env/<environment-name>/`.

### Programmatic Usage

The tool can be imported as a library:

```go
import (
    "github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/catalog"
    "github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/domain"
    "github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/generate"
    "github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/output"
)

cat := catalog.DefaultCatalog()

env := &domain.EnvironmentDefinition{
    Name:        "my-env",
    Namespace:   "optimistic-tanuki",
    Targets:     []domain.Target{domain.TargetCompose, domain.TargetK8s},
    ComposeMode: domain.ComposeModeImage,
    ImageOwner:  "cjrutherford",
    DefaultTag:  "latest",
    IncludeInfra: []domain.InfraKind{domain.InfraPostgres, domain.InfraRedis},
    Services: []domain.ServiceSelection{
        {ServiceID: "gateway", Enabled: true},
        {ServiceID: "authentication", Enabled: true},
    },
}

env.Normalize()

// Generate Compose
composeData, _ := generate.GenerateCompose(env, cat)
writer := output.NewWriter("dist/admin-env/my-env")
writer.WriteComposeFile(composeData)

// Generate K8s
k8sFiles, _ := generate.GenerateK8s(env, cat)
writer.WriteK8sFiles(k8sFiles)
```

## Configuration

### Environment Definition

| Field          | Type               | Description                                                  |
| -------------- | ------------------ | ------------------------------------------------------------ |
| `Name`         | string             | Environment name (used in output path)                       |
| `Namespace`    | string             | Kubernetes namespace                                         |
| `Targets`      | []Target           | `compose` and/or `k8s`                                       |
| `ComposeMode`  | ComposeMode        | `build` or `image`                                           |
| `ImageOwner`   | string             | Docker image owner (e.g., `cjrutherford`)                    |
| `DefaultTag`   | string             | Docker image tag                                             |
| `IncludeInfra` | []InfraKind        | Infrastructure to include (`postgres`, `redis`, `seaweedfs`) |
| `Services`     | []ServiceSelection | Selected services                                            |

### Targets

- `TargetCompose` - Generate Docker Compose file
- `TargetK8s` - Generate Kubernetes Kustomize bundle

### Compose Modes

- `ComposeModeBuild` - Uses local Dockerfiles
- `ComposeModeImage` - Uses pre-built images

### Infrastructure

- `InfraPostgres` - PostgreSQL database
- `InfraRedis` - Redis cache
- `InfraSeaweedFS` - SeaweedFS storage

## Apply Commands

After generation, apply with:

```bash
# Docker Compose
docker compose -f dist/admin-env/<env>/compose/docker-compose.yaml up -d

# Kubernetes
kubectl apply -k dist/admin-env/<env>/k8s
```

### Programmatic Apply

```go
import "github.com/cjrutherford/optimistic-tanuki/admin-env-wizard/internal/apply"

runner := &apply.CommandRunner{}

// Apply Compose
apply.ApplyCompose(runner, apply.ApplyOptions{
    ComposeFile: "dist/admin-env/demo/compose/docker-compose.yaml",
})

// Apply K8s
apply.ApplyK8s(runner, apply.ApplyOptions{
    K8sDir: "dist/admin-env/demo/k8s",
})
```

## Testing

```bash
go test ./...
```

## Available Presets

### Infrastructure

- postgres
- redis
- seaweedfs

### Services

- gateway
- authentication
- profile
- social
- app-configurator
- system-configurator-api
- chat-collector
- assets
- ai-orchestration
- prompt-proxy
- telos-docs-service
- blogging
- permissions
- project-planning
- forum
- wellness
- classifieds
- payments
- store
- lead-tracker

### Clients

- client-interface
- forgeofwill
- digital-homestead
- hai
- christopherrutherford-net
- owner-console
- store-client
- configurable-client
- system-configurator
- d6
- local-hub
- leads-app

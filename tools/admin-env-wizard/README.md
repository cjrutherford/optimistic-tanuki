# Admin Environment Wizard

`admin-env-wizard` is the Go-based deployment compiler for this repo.

It does three jobs:

- models the deployable service and client catalog
- generates deployment output for Compose and Kubernetes
- exports the canonical deployment inventory used by CI and parity checks

## What It Generates

The generator is capability-driven and provider-aware.

Inputs:

- deployment name
- provider: `akamai`, `vultr`, or `oci`
- target surface: `compose`, `k8s`, or both
- capability bundles
- optional direct service overrides

Outputs per deployment:

- `deploy.sh`
- `compose/docker-compose.yaml`
- `compose/deploy.sh`
- `compose/fragments/docker-compose.base.yaml`
- `compose/fragments/docker-compose.provider.yaml`
- `compose/fragments/docker-compose.capabilities.yaml`
- `gateway/composition.yaml`
- `k8s/kustomization.yaml`
- `k8s/deploy.sh`
- `k8s/base/*`
- `k8s/overlays/<provider>/*`

The gateway composition file is part of the deployment contract. It tells the shared gateway image which service-backed surfaces should exist for that deployment.

## Binaries

This module provides:

- `cmd/admin-env`
- `cmd/deployment-inventory`

## Build

```bash
cd tools/admin-env-wizard
go build -o admin-env ./cmd/admin-env
go build -o deployment-inventory ./cmd/deployment-inventory
```

## `admin-env` Usage

### Single deployment generation

```bash
cd tools/admin-env-wizard
GOCACHE=/tmp/go-build go run ./cmd/admin-env generate \
  -name demo \
  -namespace optimistic-tanuki \
  -targets compose,k8s \
  -infra postgres,redis \
  -services gateway,authentication \
  -compose-mode image \
  -output-dir /tmp/admin-env-demo
```

Supported flags:

- `-name`: deployment name
- `-namespace`: k8s namespace
- `-image-owner`: Docker image owner
- `-tag`: default image tag
- `-output-dir`: output directory override
- `-targets`: comma-separated `compose,k8s`
- `-infra`: comma-separated `postgres,redis,seaweedfs`
- `-services`: comma-separated app ids
- `-compose-mode`: `build` or `image`
- `-config`: workspace config YAML for multi-deployment generation

### Multi-deployment workspace generation

Use `-config` when the repo needs several deployment states for multiple clients.

Example workspace file:

```yaml
deployments:
  - name: client-a
    provider: vultr
    capabilities: [community]
    targets: [compose, k8s]
  - name: client-b
    provider: oci
    capabilities: [knowledge, creator]
    targets: [k8s]
```

Run it with:

```bash
cd tools/admin-env-wizard
GOCACHE=/tmp/go-build go run ./cmd/admin-env generate \
  -config /path/to/deployments.yaml \
  -output-dir /tmp/admin-env-workspace
```

That writes one generated deployment tree per entry:

```text
/tmp/admin-env-workspace/
  client-a/
  client-b/
```

### TUI mode

```bash
cd tools/admin-env-wizard
go run ./cmd/admin-env tui
```

The TUI is useful for:

- environment basics
- target selection
- Compose mode
- infra selection
- service selection
- output review

## Generator Model

The generator resolves deployments in this order:

1. capabilities and explicit service choices
2. service dependency closure
3. infra requirements
4. gateway composition
5. provider-specific workload shaping

Provider profiles currently shape:

- storage class and PVC sizing
- service annotations
- replica counts
- CPU and memory requests and limits
- Compose reservation memory
- restart policy
- selected probe timings

Workload-specific provider profiles now exist for:

- `gateway`
- `authentication`
- `social`
- `store`
- `permissions`
- `blogging`
- `wellness`
- `postgres`

Other services fall back to reusable generic `service` or `infra` defaults.

## Gateway Composition

Generated deployments include `gateway/composition.yaml`.

That file is consumed by the gateway runtime to decide:

- which controllers are exposed
- which realtime gateways are enabled
- which upstream TCP clients are real connections
- which upstream TCP clients are inert disabled proxies

This keeps one gateway codebase and image while allowing different deployed states to expose different service surfaces.

## `deployment-inventory` Usage

The deployment inventory is still the canonical machine-readable app list used by:

- `.github/workflows/build-push.yml`
- `scripts/validate-deployment-inventory.mjs`
- `scripts/validate-compose-k8s-parity.sh`
- `scripts/update-k8s-overlay-images.mjs`

Export it with:

```bash
cd tools/admin-env-wizard
GOCACHE=/tmp/go-build go run ./cmd/deployment-inventory
```

## Apply Generated Output

### Root deploy helper

Every generated deployment includes a root `deploy.sh`. The output directory defaults to `dist/admin-env/<env>` when using the TUI or when no `-output-dir` flag is given to the CLI. If you pass `-output-dir` to `admin-env generate`, replace the path below with your chosen directory.

Examples (using the default output path):

```bash
./dist/admin-env/<env>/deploy.sh
./dist/admin-env/<env>/deploy.sh compose
./dist/admin-env/<env>/deploy.sh k8s
```

If both targets exist, the default action applies both in order.

### Compose

```bash
docker compose -f dist/admin-env/<env>/compose/docker-compose.yaml up -d
```

### Kubernetes

```bash
kubectl apply -k dist/admin-env/<env>/k8s
```

The generated `k8s/kustomization.yaml` points at the generated base and provider overlay for that deployment.

## Typical Validation Flow

```bash
cd tools/admin-env-wizard
GOCACHE=/tmp/go-build go test ./...

GOCACHE=/tmp/go-build go run ./cmd/deployment-inventory > /tmp/deployment-inventory.json

cd /home/cjrutherford/workspace/optimistic-tanuki
DEPLOYMENT_INVENTORY_FILE=/tmp/deployment-inventory.json node scripts/validate-deployment-inventory.mjs
bash scripts/validate-compose-k8s-parity.sh
```

## Related Docs

- [Deployment Generation Process](../../docs/devops/deployment-generation.md)
- [Gateway Configuration](../../docs/devops/gateway.md)
- [Kubernetes Deployment](../../docs/devops/k8s.md)
- [Docker Compose Development](../../docs/devops/docker-compose.md)

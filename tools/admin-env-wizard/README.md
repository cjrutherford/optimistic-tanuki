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

- `deployment.yaml`
- `deploy.sh`
- `compose/docker-compose.yaml`
- `compose/deploy.sh`
- `compose/fragments/docker-compose.base.yaml`
- `compose/fragments/docker-compose.provider.yaml`
- `compose/fragments/docker-compose.capabilities.yaml`
- `config/app-registry.generated.json`
- `config/runtime.env`
- `config/db-setup.generated.yaml`
- `gateway/composition.yaml`
- `k8s/kustomization.yaml`
- `k8s/deploy.sh`
- `k8s/base/*`
- `k8s/overlays/<provider>/*`
- `reports/validation.txt`

The gateway composition file is part of the deployment contract. It tells the shared gateway image which service-backed surfaces should exist for that deployment.

## Binaries

This module provides:

- `cmd/admin-env`
- `cmd/deployment-inventory`

The repo now also carries a checked-in production preset at
`ops/deployments/production.yaml`. The new service mode reads that file as the
operator source of truth for the first control-center slice.

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
GOCACHE=/tmp/go-build go run ./cmd/admin-env tui
```

The terminal UI now behaves like a document-oriented workspace editor:

- top menus for file, navigation, edit, and diagnostics actions
- left-side document navigation
- a single active document view for `Deployment`, `Profile`, `Databases`, `Services`, `Images`, `Compose`, `Kubernetes`, `Secrets`, `Apply`, and `Diagnostics`
- contextual help tied to the active document
- database slot lifecycle summaries and service override previews

Useful keys:

- `Left` / `Right`: move across the top menus
- `Enter` / `Down`: open or activate the current menu item
- `e`: edit the active document where an editor exists
- `a` / `d`: add or delete a database slot from the `Databases` document
- `space`: toggle the active service from the `Services` document
- `s`: save deployment/secrets files
- `g`: regenerate the workspace artifacts
- `p`: open the deploy dialog from `Apply`
- `r`: refresh diagnostics

Rollout behavior:

- the local TUI can trigger a real deployment from the host machine
- Compose deploys reuse the existing production script:
  - `pnpm run docker:prod:bootstrap`
  - `scripts/docker-compose-deploy.sh`
- the selected immutable tag is passed through as `PRODUCTION_IMAGE_TAG`
- rollout state is written to `tmp/admin-env/rollouts/<deployment>.json`
- Kubernetes deploys continue to apply the generated `dist/admin-env/<env>/k8s`
  output

### Service mode

```bash
cd tools/admin-env-wizard
GOCACHE=/tmp/go-build go run ./cmd/admin-env serve \
  -deployment ../../ops/deployments/production.yaml \
  -address :8098
```

Environment variable equivalents:

- `ADMIN_ENV_DEPLOYMENT_PATH`
- `ADMIN_ENV_SECRETS_PATH`
- `ADMIN_ENV_ADDRESS`
- `ADMIN_ENV_WORKSPACE_ROOT`
- `ADMIN_ENV_COMPOSE_ENV_FILE`

Current endpoints:

- `/healthz`
- `/api/status/public`
- `/api/rollouts/preview?tag=<image-tag>`
- `/api/rollouts/latest`
- `/api/rollouts/start`
- `/api/oauth/inspect`

### Compose service mode

The containerized service can also trigger host-side Compose deployments when it
has:

- the repo mounted at `ADMIN_ENV_WORKSPACE_ROOT`
- access to `/var/run/docker.sock`
- an optional Compose env file through `ADMIN_ENV_COMPOSE_ENV_FILE`

The checked-in `docker-compose*.yaml` files now wire those mounts for
`admin-env` so the owner console and the service mode reuse the same deployment
path as production.

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

Every generated deployment includes a root `deploy.sh`. The output directory defaults to `dist/admin-env/<env>` when using the TUI or when no `-output-dir` flag is given to the CLI. Generated workspaces also include `deployment.yaml`, `config/runtime.env`, `config/db-setup.generated.yaml`, and `reports/validation.txt`. If you pass `-output-dir` to `admin-env generate`, replace the path below with your chosen directory.

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

### Compose rollout using the production pipeline

For production-style Compose updates, use the existing repo deployment entrypoint
instead of invoking `docker compose pull` and `up` by hand:

```bash
PRODUCTION_IMAGE_TAG=sha-abcdef0 pnpm run docker:prod:bootstrap
```

That script:

- validates the image tag shape
- batches pulls with `DOCKER_PULL_BATCH_SIZE`
- recreates containers with `docker compose up -d --no-build --force-recreate`
- runs `pnpm run docker:prod:seed`
- cleans up old images while preserving the active and optional rollback tags

Optional environment variables:

- `COMPOSE_ENV_FILE=/path/to/production.env`
- `DOCKER_PULL_BATCH_SIZE=4`
- `ROLLBACK_IMAGE_TAG=sha-previous`

The admin TUI and admin API both reuse this script for Compose rollouts so local
operator actions and automated service-triggered deployments follow the same
path.

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

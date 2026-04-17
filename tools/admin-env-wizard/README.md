# Admin Environment Wizard

`admin-env-wizard` is the Go-based deployment catalog and environment generator for the repo.

It serves two roles:

- generate Compose and Kubernetes output for selected apps and infra
- export the canonical deployment inventory used by CI, parity checks, and overlay image promotion

## Binaries

This module currently provides:

- `cmd/admin-env`
- `cmd/deployment-inventory`

## Build

```bash
cd tools/admin-env-wizard
go build -o admin-env ./cmd/admin-env
go build -o deployment-inventory ./cmd/deployment-inventory
```

Or run directly with `go run`.

## `admin-env` Usage

### Generate mode

```bash
cd tools/admin-env-wizard
go run ./cmd/admin-env generate \
  -name demo \
  -namespace optimistic-tanuki \
  -targets compose,k8s \
  -infra postgres,redis \
  -services gateway,authentication,app-configurator \
  -image-owner cjrutherford \
  -tag latest
```

Supported flags:

- `-name`: environment name
- `-namespace`: k8s namespace
- `-image-owner`: Docker image owner
- `-tag`: default image tag
- `-output-dir`: output directory override
- `-targets`: comma-separated `compose,k8s`
- `-infra`: comma-separated `postgres,redis,seaweedfs`
- `-services`: comma-separated app ids
- `-compose-mode`: `build` or `image`

Output is written under `dist/admin-env/<name>/` unless `-output-dir` is set.

### TUI mode

```bash
cd tools/admin-env-wizard
go run ./cmd/admin-env tui
```

The TUI is a Bubble Tea wizard for:

- environment basics
- target selection
- Compose mode
- infra selection
- service selection
- review
- generation result paths

## `deployment-inventory` Usage

The deployment inventory is the canonical machine-readable app list used by:

- `.github/workflows/build-push.yml`
- `scripts/validate-deployment-inventory.mjs`
- `scripts/validate-compose-k8s-parity.sh`
- `scripts/update-k8s-overlay-images.mjs`

Export it with:

```bash
cd tools/admin-env-wizard
go run ./cmd/deployment-inventory
```

Typical local validation flow:

```bash
cd tools/admin-env-wizard
GOCACHE=/tmp/go-build go run ./cmd/deployment-inventory > /tmp/deployment-inventory.json

cd /home/cjrutherford/workspace/optimistic-tanuki
DEPLOYMENT_INVENTORY_FILE=/tmp/deployment-inventory.json node scripts/validate-deployment-inventory.mjs
bash scripts/validate-compose-k8s-parity.sh
```

## Apply Generated Output

```bash
# Compose
docker compose -f dist/admin-env/<env>/compose/docker-compose.yaml up -d

# Kubernetes
kubectl apply -k dist/admin-env/<env>/k8s
```

## Included App Surface

The catalog currently covers both services and clients used by the deployment workflows, including the k8s-managed additions such as:

- `classifieds`
- `payments`
- `lead-tracker`
- `leads-app`
- `local-hub`

## Testing

```bash
cd tools/admin-env-wizard
GOCACHE=/tmp/go-build go test ./...
```

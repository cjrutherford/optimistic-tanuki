# Registry Tool

This Go tool generates the platform application registry JSON from
[apps.yaml](apps.yaml).

The generated JSON is used in two places:

- Angular apps consume
  [libs/app-registry/src/lib/default-registry.json](../../libs/app-registry/src/lib/default-registry.json)
  as the build-time fallback registry.
- Gateway mounts that same JSON at runtime through `APP_REGISTRY_PATH` in
  `docker-compose*.yaml`.

## Working Directory

Run commands from `tools/registry`:

```bash
cd tools/registry
```

The CLI now resolves the default input path correctly from either the repo root
or `tools/registry`, but running it here keeps the commands shorter.

## Recommended Dev Workflow

After editing
[apps.yaml](apps.yaml),
rebuild the registry with the Go CLI, sync the backend seed copy, then restart
the local gateway so the mounted file is re-read.

```bash
cd tools/registry
go run ./cmd/registry validate
go run ./cmd/registry generate \
  --output ../../libs/app-registry/src/lib/default-registry.json
cp ../../libs/app-registry/src/lib/default-registry.json \
  ../../libs/app-registry-backend/src/lib/default-registry.json
docker compose -f ../../docker-compose.yaml -f ../../docker-compose.dev.yaml restart gateway
```

If your local Go cache needs to stay under `/tmp`, use:

```bash
cd tools/registry
GOCACHE=/tmp/go-build GOPATH=/tmp/go GOMODCACHE=/tmp/go/pkg/mod \
  go run ./cmd/registry validate
GOCACHE=/tmp/go-build GOPATH=/tmp/go GOMODCACHE=/tmp/go/pkg/mod \
  go run ./cmd/registry generate \
  --output ../../libs/app-registry/src/lib/default-registry.json
cp ../../libs/app-registry/src/lib/default-registry.json \
  ../../libs/app-registry-backend/src/lib/default-registry.json
docker compose -f ../../docker-compose.yaml -f ../../docker-compose.dev.yaml restart gateway
```

## Generate

Write the generated registry into the Angular fallback file:

```bash
go run ./cmd/registry generate \
  --output ../../libs/app-registry/src/lib/default-registry.json
```

Equivalent command with a stable Go build cache path:

```bash
GOCACHE=/tmp/go-build go run ./cmd/registry generate \
  --output ../../libs/app-registry/src/lib/default-registry.json
```

If you just want to inspect the generated JSON, omit `--output`:

```bash
go run ./cmd/registry generate
```

## Validate

```bash
go run ./cmd/registry validate
```

## Edit The Source Registry

Add an app:

```bash
go run ./cmd/registry add \
  --appId store \
  --name "HAI Store" \
  --domain haidev.com \
  --subdomain store
```

Remove an app:

```bash
go run ./cmd/registry remove --appId legacy-app
```

Export app URLs as environment lines:

```bash
go run ./cmd/registry export
```

## Inject Into The Platform

After regenerating the JSON:

1. Sync the backend seed copy if you have not already:

```bash
cp ../../libs/app-registry/src/lib/default-registry.json \
  ../../libs/app-registry-backend/src/lib/default-registry.json
```

2. Commit the updated source and generated files:

```bash
git add \
  apps.yaml \
  ../../libs/app-registry/src/lib/default-registry.json \
  ../../libs/app-registry-backend/src/lib/default-registry.json
```

3. For local Docker runs, restart `gateway` so it remounts the updated file:

```bash
docker compose -f ../../docker-compose.yaml -f ../../docker-compose.dev.yaml restart gateway
```

4. For Kubernetes, also sync the generated file into the K8s config source:

```bash
cp ../../libs/app-registry/src/lib/default-registry.json ../../k8s/base/config/app-registry.json
```

Then apply your normal K8s rollout flow.

## Mobile Configuration

Apps of type `client` may include an optional `mobile` block to enable Capacitor
mobile app generation:

```yaml
mobile:
  enabled: true # Enable mobile app generation
  bundleId: com.example.app # Reverse-DNS bundle ID (required if enabled)
  project: app-mobile # Optional Nx project name override
  appName: Example App # Optional display name override
```

- `enabled`: Boolean to enable/disable mobile app generation (required if block present)
- `bundleId`: Reverse-DNS package identifier like `com.example.app` (required if enabled). Must match pattern `^[a-zA-Z][a-zA-Z0-9]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$`
- `project`: Optional Nx project name for mobile app; defaults to appId if omitted
- `appName`: Optional display name for mobile app; defaults to app name if omitted

The mobile block is only valid for apps with `appType: client`.

## Runtime Wiring

- Docker Compose mounts
  `libs/app-registry/src/lib/default-registry.json` into gateway as
  `/usr/src/app/config/app-registry.json`.
- Gateway reads that path from `APP_REGISTRY_PATH`.
- If `APP_REGISTRY_PATH` is absent, gateway falls back to the bundled default
  registry.

## OAuth Routing Contract

The registry contains routing data, not OAuth credentials. Gateway uses the
registered `client-interface.uiBaseUrl` as the default shared provider callback
bridge and uses all registered `uiBaseUrl` origins to validate cross-application
OAuth return targets.

For production, keep every `uiBaseUrl` explicit in
`apps.production.sample.yaml`. Provider client IDs and secrets belong in the
gateway `config.yaml` or in non-empty gateway environment variables; environment
values take final precedence. `.secrets` files are consumed by deployment tools
to generate those runtime environment values and are not another runtime config
source.

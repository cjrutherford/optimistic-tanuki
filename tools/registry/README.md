# Registry Tool

This Go tool generates the platform application registry JSON from
[apps.yaml](/home/cjrutherford/workspace/optimistic-tanuki/tools/registry/apps.yaml).

The generated JSON is used in two places:

- Angular apps consume
  [libs/app-registry/src/lib/default-registry.json](/home/cjrutherford/workspace/optimistic-tanuki/libs/app-registry/src/lib/default-registry.json)
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

1. Commit the updated source and generated file:

```bash
git add apps.yaml ../../libs/app-registry/src/lib/default-registry.json
```

2. For local Docker runs, restart `gateway` so it remounts the updated file:

```bash
docker compose -f ../../docker-compose.yaml -f ../../docker-compose.dev.yaml restart gateway
```

3. For Kubernetes, also sync the generated file into the K8s config source:

```bash
cp ../../libs/app-registry/src/lib/default-registry.json ../../k8s/base/config/app-registry.json
```

Then apply your normal K8s rollout flow.

## Runtime Wiring

- Docker Compose mounts
  `libs/app-registry/src/lib/default-registry.json` into gateway as
  `/usr/src/app/config/app-registry.json`.
- Gateway reads that path from `APP_REGISTRY_PATH`.
- If `APP_REGISTRY_PATH` is absent, gateway falls back to the bundled default
  registry.

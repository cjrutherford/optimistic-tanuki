# Deployment Generation

This document covers the deployment-generation workflow for the repo as it exists now.

Use it when you need to:

- define a new client deployment state
- generate Compose output
- generate Kubernetes output
- understand how provider tuning is applied
- validate generated deployment artifacts

## Overview

Deployment generation is handled by `tools/admin-env-wizard`.

The flow is:

1. choose capabilities and any direct service overrides
2. choose the target provider: `akamai`, `vultr`, or `oci`
3. generate Compose, Kubernetes, or both
4. review the generated gateway composition
5. apply the generated output
6. validate inventory and parity if the deployment surface changed

The generator supports both one-off deployments and multi-client workspace generation in the same repo.

## Single Deployment Process

Generate one deployment:

```bash
cd tools/admin-env-wizard
GOCACHE=/tmp/go-build go run ./cmd/admin-env generate \
  -name demo \
  -targets compose,k8s \
  -infra postgres,redis \
  -services gateway,authentication
```

Review the output:

```text
dist/admin-env/demo/
  compose/
  gateway/
  k8s/
```

Key files:

- `deploy.sh`
- `compose/docker-compose.yaml`
- `compose/deploy.sh`
- `compose/fragments/docker-compose.provider.yaml`
- `gateway/composition.yaml`
- `k8s/base/kustomization.yaml`
- `k8s/deploy.sh`
- `k8s/overlays/<provider>/provider-patch.yaml`

Apply the deployment:

```bash
./dist/admin-env/demo/deploy.sh
```

Or target one surface explicitly:

```bash
./dist/admin-env/demo/deploy.sh compose
./dist/admin-env/demo/deploy.sh k8s
```

## Multi-Client Workspace Process

Use a workspace file when the repo needs several deployment states.

Example:

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

Generate it:

```bash
cd tools/admin-env-wizard
GOCACHE=/tmp/go-build go run ./cmd/admin-env generate \
  -config /path/to/deployments.yaml \
  -output-dir /tmp/admin-env-workspace
```

Each deployment gets its own isolated output tree under the workspace output root.

## Provider Tuning Process

Provider-specific behavior is generated from reusable provider profiles.

Those profiles shape:

- storage class and PVC size
- gateway service annotations
- service replicas
- resource requests and limits
- Compose reservation memory
- restart policy
- selected probe timing defaults

There are two levels of tuning:

- generic defaults for `service` and `infra`
- workload-specific overrides for important domains such as `social`, `store`, `permissions`, `blogging`, `wellness`, `gateway`, `authentication`, and `postgres`

That means a deployment for OCI and a deployment for Vultr can share capabilities while still producing different workload shapes.

## Gateway Deployment Process

Every generated deployment includes `gateway/composition.yaml`.

That file is part of the deployment process, not optional metadata.

The gateway uses it to decide:

- which controllers are registered
- which realtime gateways are enabled
- which upstream service clients are active
- which upstream service clients resolve to disabled proxies

When a deployment state changes, review this file first. It is the clearest representation of what the deployment will expose.

## Validation Process

Run generator tests:

```bash
cd tools/admin-env-wizard
GOCACHE=/tmp/go-build go test ./...
```

If deployment inventory behavior changed, also run:

```bash
cd /home/cjrutherford/workspace/optimistic-tanuki
node scripts/validate-deployment-inventory.mjs
bash scripts/validate-compose-k8s-parity.sh
```

If gateway behavior changed, run:

```bash
NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test gateway
```

## When To Edit What

Edit the Go catalog when:

- adding a deployable app
- adding a capability bundle
- changing dependency closure

Edit provider profiles when:

- tuning workload shape for Akamai, Vultr, or OCI
- adding a workload-specific service override
- changing storage or service-annotation defaults

Edit gateway composition behavior when:

- changing which service domains map to gateway controllers
- changing which services enable realtime or MCP surfaces

## Related Docs

- [Admin Environment Wizard](../../tools/admin-env-wizard/README.md)
- [Gateway Configuration](./gateway.md)
- [Kubernetes Deployment](./k8s.md)
- [Docker Compose](./docker-compose.md)

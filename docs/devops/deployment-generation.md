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

The recommended operator flow is documented in [Deployment Workspace Workflow](./deployment-workspace-workflow.md). This document focuses on generation mechanics and generated artifact structure.

The flow is:

1. choose capabilities and any direct service overrides
2. choose the target provider: `akamai`, `vultr`, or `oci`
3. generate Compose, Kubernetes, or both
4. review the generated gateway composition
5. apply the generated output
6. validate inventory and parity if the deployment surface changed

The generator supports both one-off deployments and multi-client workspace generation in the same repo.

## Preferred Tooling

Use the deployment dashboard first when you are managing an existing environment:

```bash
cd tools/admin-env-wizard
GOCACHE=/tmp/go-build go run ./cmd/admin-env tui -deployment ../../dist/admin-env/<deployment>/deployment.yaml
```

Use direct `generate` CLI flows when:

- bootstrapping a brand new deployment
- generating several deployments from one config file
- scripting reproducible generation in CI or local automation

When using the TUI, treat it as the primary source editor for deployment intent:

- open a generated workspace
- edit document sections
- read the contextual help for the current section
- regenerate from the saved workspace

Do not treat the root `k8s/` and root Compose files as the primary edit surfaces for new deployment work.

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

The generated deployment workspace may now also include:

- database-slot-driven service env wiring
- generated ArgoCD application metadata
- backend-materialized Compose and Kubernetes config/secrets outputs

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

## Database Slot Generation

The workspace model now carries deployment-level database slots plus per-service overrides.

Generation uses the resolved effective binding for each service when producing deployment artifacts. Today that means generated Compose and Kubernetes service outputs can carry:

- `DATABASE_NAME`
- `DATABASE_USER_KEY`
- `DATABASE_PASSWORD_KEY`

The generated artifacts also now consume resolved service-level backend config where a service has an explicit contract in the catalog. That contract is not inferred from `EnvDefaults`; it is declared intentionally and validated before output-writing actions proceed.

Structured backend files can now carry service-specific values under `services.<service-id>` with optional target overrides under `services.<service-id>.targets.compose` and `services.<service-id>.targets.k8s`.

Validation behavior is now split intentionally:

- `save` can persist an incomplete workspace
- `generate` / `regenerate` fail when required service config is missing
- `materialize` fails on the same missing-key conditions

This does not yet add a second secret backend. The current goal is alignment between workspace intent, generated service artifacts, and explicit blocking validation when required runtime config is absent.

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

If you are validating a generated deployment workspace during migration, point those same validators at the generated output:

```bash
cd /home/cjrutherford/workspace/optimistic-tanuki
DEPLOYMENT_WORKSPACE_DIR=dist/admin-env/demo node scripts/validate-deployment-inventory.mjs
DEPLOYMENT_WORKSPACE_DIR=dist/admin-env/demo bash scripts/validate-compose-k8s-parity.sh
```

The repo-level staging and production deploy scripts now do that resolution automatically. If `dist/admin-env/staging/` or `dist/admin-env/production/` exists with a generated `deployment.yaml`, they will validate and apply from that generated workspace first. If not, they fall back to the legacy root ArgoCD template and root overlays.

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

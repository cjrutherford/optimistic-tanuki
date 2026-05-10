# Workspace Map

This document explains how the monorepo is organized and how contributors should navigate it.

Use it when you need to answer any of these quickly:

- where should a change go
- which app owns a feature
- which library should be reused instead of creating a new one
- how local development and deployment outputs fit together

## Read This First

If you are new to the repo, use this sequence:

1. [Main README](../../README.md) for the current platform and local-stack overview.
2. [Getting Started](../getting-started/README.md) for first-run setup and common contributor workflows.
3. [Deployment Generation](../devops/deployment-generation.md) if your work affects deployable services, Compose, or Kubernetes.
4. [Workspace Catalog](../reference/workspace-catalog.md) when you need the full project inventory.

## Top-Level Layout

```text
apps/      deployable services, frontend applications, and e2e projects
libs/      shared UI, domain, infrastructure, and contract libraries
docs/      curated documentation, guides, architecture notes, and process docs
k8s/       base manifests, overlays, and ArgoCD application config
scripts/   deployment, validation, seeding, and operational scripts
tools/     Go tooling for deployment generation and terminal workflows
```

## How To Decide Where A Change Belongs

Put code in `apps/` when:

- it is a deployable runtime
- it owns an external API surface
- it needs its own container or process

Put code in `libs/` when:

- two or more apps should reuse it
- it is shared UI, models, contracts, database helpers, or utilities
- it should not be deployed as a standalone service

Put docs in `docs/` when:

- the explanation is cross-cutting
- the workflow applies to multiple apps
- the information would be hard to discover from a single project README

## Apps

`apps/` contains three kinds of projects:

- backend services such as `gateway`, `authentication`, `profile`, `social`, and `project-planning`
- frontend applications such as `client-interface`, `forgeofwill`, `christopherrutherford-net`, and `video-client`
- e2e projects such as `local-hub-e2e`, `fin-commander-e2e`, and `video-client-e2e`

The full inventory is in [Workspace Catalog](../reference/workspace-catalog.md).

## Libraries

`libs/` contains the shared implementation layer for the workspace.

The main groups are:

- UI libraries such as `common-ui`, `auth-ui`, `blogging-ui`, `chat-ui`, `store-ui`, and `theme-ui`
- domain and contract libraries such as `models`, `ui-models`, `constants`, `app-catalog-contracts`, and `theme-models`
- platform libraries such as `database`, `logger`, `storage`, `encryption`, `permission-lib`, and `prompt-generation`

Use an existing library before creating a new one. If the code is still app-specific after extraction pressure, keep it in the app.

## Local Development Surfaces

There are three practical contributor workflows:

1. Full Compose dev stack
   Use this for cross-service validation and integrated behavior.
2. Hybrid inner loop
   Use shared infra in Docker and run one app locally with Nx.
3. Project-only iteration
   Use `pnpm exec nx serve <project>` or `pnpm exec nx test <project>` when Docker is unnecessary.

The canonical local-stack guide is [Docker Compose](../devops/docker-compose.md).

## Deployment Surfaces

This repo has two deployment models that coexist:

1. Static repo-level Kubernetes overlays under `k8s/overlays/`
   These are the current staging and production GitOps targets.
2. Generated deployment states from `tools/admin-env-wizard`
   These produce per-client Compose and K8s output plus gateway composition contracts.

The generated deployment flow is documented in [Deployment Generation](../devops/deployment-generation.md).

## Gateway And Service Graph

The gateway is the shared entrypoint for HTTP, SSE, and WebSocket traffic.

Important current rule:

- deployment generation decides which services are active
- generated `gateway/composition.yaml` decides which gateway surfaces are active
- the gateway image stays shared across deployments

If your change affects controllers, realtime gateways, or upstream service clients, read [Gateway Configuration](../devops/gateway.md) and [tools/admin-env-wizard/README.md](../../tools/admin-env-wizard/README.md).

## Validation Paths

Use Nx for normal project validation:

```bash
pnpm exec nx test <project>
pnpm exec nx build <project>
```

Use the Go tool validation path when deployable inventory or generated output changes:

```bash
cd tools/admin-env-wizard
GOCACHE=/tmp/go-build go test ./...
```

Use deployment-contract checks when repo-level deployment shape changes:

```bash
node scripts/validate-deployment-inventory.mjs
bash scripts/validate-compose-k8s-parity.sh
```

## Common Mistakes

- putting reusable code into an app when it belongs in `libs/`
- editing static `k8s/` files when the real source of truth is generated deployment output
- treating the gateway as fixed when the active surface is now deployment-composable
- starting with the full Docker dev stack when a single-project Nx loop would be faster

## Related Docs

- [Workspace Catalog](../reference/workspace-catalog.md)
- [Getting Started](../getting-started/README.md)
- [Docker Compose](../devops/docker-compose.md)
- [Deployment Generation](../devops/deployment-generation.md)

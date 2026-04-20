# Optimistic Tanuki

Optimistic Tanuki is an Nx monorepo for a multi-app platform built around NestJS services, Angular and SSR clients, a Docker Compose development stack, and a Kubernetes GitOps deployment surface.

The repo currently has three operational layers:

- local development through Docker Compose and Nx
- deployment inventory and environment generation through Go tooling in `tools/`
- Kubernetes delivery through Kustomize overlays, ArgoCD, and GitHub Actions

## Getting Started

Start with [docs/getting-started/README.md](./docs/getting-started/README.md) if you need first-time setup. For most contributors, the shortest path is:

```bash
git clone https://github.com/cjrutherford/optimistic-tanuki.git
cd optimistic-tanuki
pnpm install
pnpm run docker:dev
```

Primary local endpoints:

- Main app: `http://localhost:8080`
- Leads app: `http://localhost:4201`
- Gateway: `http://localhost:3000`

Prerequisites:

- Node.js 20+
- pnpm
- Docker and Docker Compose
- Go 1.24+ if you want to run the Go tools in `tools/`

## Local Development

The day-to-day development path is the Docker dev stack, not plain `docker compose up`.

```bash
# Build dist/ and start the development stack
pnpm run docker:dev

# First-time bootstrap with seed data
pnpm run docker:dev:bootstrap

# Keep dist/ updated for hot reload in a second terminal
pnpm run watch:build

# Inspect or stop the dev stack
pnpm run docker:dev:ps
pnpm run docker:dev:logs
pnpm run docker:dev:down
```

Why this matters: the dev containers run built output from `dist/`, so `pnpm run docker:dev` performs the required build before bringing services up. The full workflow is documented in [docs/devops/docker-compose.md](./docs/devops/docker-compose.md).

## Deployment Model

The current deployment path is GitOps-oriented and catalog-driven.

1. The canonical deployable app inventory is exported from the Go configurator in [tools/admin-env-wizard](./tools/admin-env-wizard/README.md).
2. GitHub Actions validates that inventory against the image build matrix, Kustomize base resources, and overlay image lists.
3. Image promotion updates Kustomize overlay `images:` entries instead of rewriting every manifest.
4. ArgoCD applies [k8s/argo-app/application.yaml](./k8s/argo-app/application.yaml) against the selected overlay under `k8s/overlays/`.

Key files:

- [build-push.yml](./.github/workflows/build-push.yml)
- [deploy.yml](./.github/workflows/deploy.yml)
- [k8s/base/kustomization.yaml](./k8s/base/kustomization.yaml)
- [k8s/overlays/staging/kustomization.yaml](./k8s/overlays/staging/kustomization.yaml)
- [k8s/overlays/production/kustomization.yaml](./k8s/overlays/production/kustomization.yaml)
- [validate-deployment-inventory.mjs](./scripts/validate-deployment-inventory.mjs)
- [validate-compose-k8s-parity.sh](./scripts/validate-compose-k8s-parity.sh)
- [update-k8s-overlay-images.mjs](./scripts/update-k8s-overlay-images.mjs)

## Go Tooling

Two Go tools now document and drive part of the platform surface:

- [tools/admin-env-wizard](./tools/admin-env-wizard/README.md)
  - `admin-env generate` for non-interactive environment generation
  - `admin-env tui` for the Bubble Tea configurator
  - `cmd/deployment-inventory` for exporting the canonical deployment inventory used by CI and scripts
- [tools/stack-client](./tools/stack-client/README.md)
  - `stack-client tui` for an authenticated terminal client to the stack through the gateway

## Testing

Common commands:

```bash
# Unit tests
pnpm exec nx test <project>

# E2E tests
pnpm exec nx e2e <project>-e2e

# Repo-wide validation examples
pnpm exec nx run-many --target=build --all
pnpm exec nx run-many --target=test --all
```

Before running Playwright suites for the first time:

```bash
pnpm exec playwright install
```

See [docs/testing/quick-reference.md](./docs/testing/quick-reference.md) and [docs/testing/e2e-testing.md](./docs/testing/e2e-testing.md) for the deeper test workflow.

## Repository Layout

- `apps/`: NestJS services and frontend applications
- `libs/`: shared libraries
- `k8s/`: base manifests, overlays, and the ArgoCD application
- `scripts/`: deployment, validation, seeding, and operational scripts
- `tools/`: Go utilities and other developer tooling
- `docs/`: curated project documentation

Use [docs/README.md](./docs/README.md) as the documentation index.

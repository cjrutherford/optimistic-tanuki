# DevOps Documentation

This directory contains the infrastructure and deployment docs for the active repo workflows.

## Contents

- [Architecture Overview](architecture.md) - High-level infrastructure design
- [Kubernetes Deployment](k8s.md) - Kustomize base and overlays, local scripts, and cluster apply flow
- [Service Ports Reference](ports.md) - Port mappings for all services
- [Gateway Configuration](gateway.md) - Gateway service configuration
- [Docker Compose](docker-compose.md) - Local development with Docker Compose
- [ArgoCD](argocd.md) - GitOps deployment with the parameterized Argo application

## Quick Reference

### Local Development Stack

```bash
# Build dist/ and start the full Docker dev stack
npm run docker:dev

# First-time bootstrap with seed data
npm run docker:dev:bootstrap

# Keep hot reload active
npm run watch:build

# Inspect or stop the stack
npm run docker:dev:ps
npm run docker:dev:logs
npm run docker:dev:down
```

### Deployment Environments

- **Development**: Docker Compose via `npm run docker:dev`
- **Staging**: Kubernetes overlay in `k8s/overlays/staging/`
- **Production**: Kubernetes overlay in `k8s/overlays/production/`

## Deployment Contract

The current deployment pipeline is inventory-driven:

1. `tools/admin-env-wizard/cmd/deployment-inventory` exports the canonical app inventory.
2. `scripts/validate-deployment-inventory.mjs` verifies that the GitHub Actions build matrix, base Kustomize resources, and overlay image lists match that inventory.
3. `scripts/validate-compose-k8s-parity.sh` checks Compose and Kubernetes parity for apps marked deployable to k8s.
4. `scripts/update-k8s-overlay-images.mjs` updates overlay `images:` entries with the promoted tag.
5. ArgoCD syncs the environment overlay selected by `k8s/argo-app/application.yaml`.

## Key Components

- **Gateway**: API gateway using NestJS and routing requests into the service graph
- **Kustomize**: base resources plus staging and production overlays
- **ArgoCD**: GitOps deployment controller
- **PostgreSQL**: primary data store
- **Redis**: cache and session store
- **SeaweedFS**: object storage where required by the stack

## Scripts

Deployment and management scripts are located in `scripts/`.

### Deployment Scripts

| Script | Description |
| --- | --- |
| `deploy-production.sh` | Validate inventory, apply infra, and sync the production overlay |
| `deploy-staging.sh` | Validate inventory, apply infra, and sync the staging overlay |
| `apply-terraform.sh` | Apply Terraform configuration |
| `teardown.sh` | Tear down Kubernetes resources |

### Validation Scripts

| Script | Description |
| --- | --- |
| `validate-compose-k8s-parity.sh` | Validate Docker Compose ↔ k8s parity for k8s deployable apps |
| `validate-deployment-inventory.mjs` | Validate workflow, base resources, and overlay image lists |
| `update-k8s-overlay-images.mjs` | Update overlay image tags from the exported inventory |

### Usage

```bash
# Production deployment
./scripts/deploy-production.sh

# Staging deployment
./scripts/deploy-staging.sh

# Validate the deployment contract locally
node scripts/validate-deployment-inventory.mjs
bash scripts/validate-compose-k8s-parity.sh
```

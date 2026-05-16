# CI/CD Pipeline Documentation

## Overview

This document describes the current GitHub Actions deployment path in the repository. The most important change is that deployable apps are now driven by a generated inventory from `tools/admin-env-wizard`, not by hand-maintained workflow lists and manifest rewrites.

## Pipeline Architecture

```text
deployment inventory -> contract validation -> image build/push -> compatibility overlay image update -> ArgoCD sync
```

The inventory exported from `tools/admin-env-wizard/cmd/deployment-inventory` is the source used to keep these compatibility-era surfaces aligned:

- `.github/workflows/build-push.yml`
- `k8s/base/kustomization.yaml`
- `k8s/overlays/staging/kustomization.yaml`
- `k8s/overlays/production/kustomization.yaml`

## Workflows

### Build and Push (`.github/workflows/build-push.yml`)

Trigger:

- push to `main`
- push to `mvp-polish`
- manual dispatch

Stages:

1. **Validate deployment contract**
   - run Go generator tests in `tools/admin-env-wizard`
   - export the deployment inventory
   - validate workflow matrix, base resources, and overlay image names
   - validate Compose ↔ k8s parity
2. **Build and push images**
   - build a service and client image matrix
   - publish branch tags and `sha-<commit>` tags
3. **Update staging overlay**
   - rewrite `k8s/overlays/staging/kustomization.yaml` image tags to the current commit SHA
   - commit the overlay update back to the branch

### Deploy (`.github/workflows/deploy.yml`)

Trigger:

- push to `main`
- push to `mvp-polish`
- manual dispatch with `staging` or `production`

Staging path:

- resolve a generated deployment workspace when present, otherwise fall back to the root Argo template
- sync `optimistic-tanuki-staging`
- wait for reconciliation
- run a smoke check against the staging gateway endpoint

Production path:

- manual only
- promote `k8s/overlays/production/kustomization.yaml` to `sha-<commit>` for the compatibility path
- commit the production overlay change
- resolve a generated deployment workspace when present, otherwise fall back to the root Argo template
- sync `optimistic-tanuki`
- run a smoke check against the production gateway endpoint

## Validation Scripts

The deployment workflows depend on these scripts:

- `scripts/validate-deployment-inventory.mjs`
- `scripts/validate-compose-k8s-parity.sh`
- `scripts/update-k8s-overlay-images.mjs`

## Local Validation

Before changing the deployment surface, run:

```bash
cd tools/admin-env-wizard
GOCACHE=/tmp/go-build go test ./internal/catalog/... ./internal/generate/... ./cmd/deployment-inventory/...

cd /home/cjrutherford/workspace/optimistic-tanuki
node scripts/validate-deployment-inventory.mjs
bash scripts/validate-compose-k8s-parity.sh
```

For generated workspaces, prefer:

```bash
DEPLOYMENT_WORKSPACE_DIR=dist/admin-env/<deployment> node scripts/validate-deployment-inventory.mjs
DEPLOYMENT_WORKSPACE_DIR=dist/admin-env/<deployment> bash scripts/validate-compose-k8s-parity.sh
```

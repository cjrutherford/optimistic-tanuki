# CI/CD Pipeline Documentation

## Overview

This document describes the current GitHub Actions deployment path in the repository. The most important change is that deployable apps are now driven by a generated inventory from `tools/admin-env-wizard`, not by hand-maintained workflow lists and manifest rewrites.

## Pipeline Architecture

```text
plan once -> validate + affected quality gates -> image cache warmup -> image publish -> image-backed e2e -> staging overlay update -> ArgoCD sync
```

The inventory exported from `tools/admin-env-wizard/cmd/deployment-inventory` is the source used to keep these compatibility-era surfaces aligned:

- `.github/workflows/ci-cd.yml`
- `k8s/base/kustomization.yaml`
- `k8s/overlays/staging/kustomization.yaml`
- `k8s/overlays/production/kustomization.yaml`

## Workflows

### CI/CD (`.github/workflows/ci-cd.yml`)

Trigger:

- pull requests targeting `main`, `develop`, or `mvp-polish`
- pushes to `main`, `develop`, or `mvp-polish`
- manual dispatch

Stages:

1. **Plan**
   - generate changed and full Docker plans once
   - decide whether this run should publish images and deploy staging
2. **Validate**
   - format checks, workspace validation, UI heuristics
   - deployment inventory generation and Compose ↔ k8s parity checks
3. **Quality gates**
   - affected `lint`, `test`, and `build` complete before any image publish
4. **Image check**
   - build changed Docker images without pushing
   - persist Buildx cache for the publish phase
5. **Image publish**
   - trusted branch pushes publish the full deployable image set with immutable `sha-<short-commit>` tags
6. **Image-backed e2e**
   - microservice and UI suites pull published images instead of rebuilding containers in the workflow
7. **Staging deploy**
   - update `k8s/overlays/staging/kustomization.yaml`
   - sync ArgoCD only after e2e succeeds

### Deploy Production (`.github/workflows/deploy.yml`)

Trigger:

- manual dispatch with `production`

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
- `scripts/docker-compose-deploy.sh`
- `scripts/docker-image-cleanup.sh`

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

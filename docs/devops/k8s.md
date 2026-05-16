# Kubernetes Deployment

## Overview

The Kubernetes surface is organized as:

- generated deployment workspaces under `dist/admin-env/<deployment>/k8s/`
- root `k8s/base/` for compatibility-era shared manifests
- root `k8s/overlays/staging/` and `k8s/overlays/production/` for compatibility-era environment overlays
- root `k8s/argo-app/application.yaml` as the legacy parameterized ArgoCD `Application`

For new deployment management, prefer the generated workspace Kubernetes output. Root `k8s/base` and `k8s/overlays/*` remain important migration and CI compatibility surfaces.

The preferred operator path is:

1. open the deployment workspace in `tools/admin-env-wizard`
2. edit `Deployment`, `Profile`, `Services`, `Kubernetes`, and `Secrets`
3. use the contextual help region to understand the consequence of the current field or document
4. regenerate the workspace
5. validate and apply from `dist/admin-env/<deployment>/k8s/`

## Prerequisites

- Kubernetes cluster
- `kubectl` configured
- ingress controller installed
- ArgoCD installed for GitOps sync

## Directory Structure

```text
dist/admin-env/<deployment>/
├── argocd/
│   └── application.yaml
└── k8s/
    ├── base/
    ├── overlays/
    └── kustomization.yaml
```

Legacy compatibility surfaces still exist at the repo root:

- `k8s/base/`
- `k8s/overlays/staging/`
- `k8s/overlays/production/`
- `k8s/argo-app/application.yaml`

## Deploying

### Option 1: Local deployment scripts

```bash
./scripts/deploy-staging.sh
./scripts/deploy-production.sh
```

These scripts:

1. generate secrets when available
2. export and validate the deployment inventory
3. validate Compose ↔ k8s parity
4. apply Terraform if needed
5. apply the ArgoCD application with the selected overlay
6. optionally bootstrap-apply the overlay for first-time setup
7. wait for Argo and core workloads

When `dist/admin-env/staging/` or `dist/admin-env/production/` exists, those scripts now resolve and use the generated workspace first.

### Option 2: Direct Kustomize apply

```bash
kubectl apply -k dist/admin-env/<deployment>/k8s
```

### Option 3: ArgoCD application apply

```bash
kubectl apply -f dist/admin-env/<deployment>/argocd/application.yaml
```

## Inventory-Driven Resources

The current base includes the existing service and client manifests plus the newer k8s-managed apps added through the inventory work:

- `classifieds`
- `payments`
- `lead-tracker`
- `leads-app`
- `local-hub`

If a deployable app is added to the Go catalog, the following should change together:

- `.github/workflows/build-push.yml`
- generated workspace k8s output expectations
- compatibility-era `k8s/base/kustomization.yaml`
- compatibility-era `k8s/overlays/staging/kustomization.yaml`
- compatibility-era `k8s/overlays/production/kustomization.yaml`
- any relevant Compose parity expectations

## Overlays

Both overlays reference `../../base` and carry environment-specific settings:

- namespace
- config map literals such as `NODE_ENV` and `LOG_LEVEL`
- replica overrides
- image tags in `images:`

Image tags are updated by `scripts/update-k8s-overlay-images.mjs` in local workflows and GitHub Actions.

## Troubleshooting

```bash
kubectl get pods -n optimistic-tanuki
kubectl get pods -n optimistic-tanuki-staging
kubectl logs -f deployment/gateway -n optimistic-tanuki
kubectl port-forward svc/gateway 3000:3000 -n optimistic-tanuki
```

## Related Files

- `dist/admin-env/<deployment>/k8s/`
- `dist/admin-env/<deployment>/argocd/application.yaml`
- `k8s/argo-app/application.yaml`
- `scripts/deploy-staging.sh`
- `scripts/deploy-production.sh`
- `scripts/validate-deployment-inventory.mjs`
- `scripts/validate-compose-k8s-parity.sh`
- `scripts/update-k8s-overlay-images.mjs`

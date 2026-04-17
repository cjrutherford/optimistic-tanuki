# Kubernetes Deployment

## Overview

The Kubernetes surface is organized as:

- `k8s/base/` for deployable application manifests and shared infra
- `k8s/overlays/staging/` and `k8s/overlays/production/` for environment-specific config and image tags
- `k8s/argo-app/application.yaml` for the parameterized ArgoCD `Application`

The base resources and overlay image lists are expected to match the exported deployment inventory from `tools/admin-env-wizard/cmd/deployment-inventory`.

## Prerequisites

- Kubernetes cluster
- `kubectl` configured
- ingress controller installed
- ArgoCD installed for GitOps sync

## Directory Structure

```text
k8s/
├── base/
│   ├── clients/
│   ├── services/
│   ├── gateway.yaml
│   ├── ingress.yaml
│   ├── postgres.yaml
│   ├── redis.yaml
│   └── kustomization.yaml
├── overlays/
│   ├── production/
│   └── staging/
└── argo-app/
    └── application.yaml
```

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

### Option 2: Direct Kustomize apply

```bash
kubectl apply -k k8s/overlays/staging
kubectl apply -k k8s/overlays/production
```

### Option 3: ArgoCD application apply

```bash
sed \
  -e "s|\${ARGO_APP_NAME:-optimistic-tanuki}|optimistic-tanuki-staging|g" \
  -e "s|\${ARGO_NAMESPACE:-optimistic-tanuki}|optimistic-tanuki-staging|g" \
  -e "s|\${ARGO_ENV:-production}|staging|g" \
  k8s/argo-app/application.yaml | kubectl apply -f -
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
- `k8s/base/kustomization.yaml`
- `k8s/overlays/staging/kustomization.yaml`
- `k8s/overlays/production/kustomization.yaml`
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

- `k8s/argo-app/application.yaml`
- `scripts/deploy-staging.sh`
- `scripts/deploy-production.sh`
- `scripts/validate-deployment-inventory.mjs`
- `scripts/validate-compose-k8s-parity.sh`
- `scripts/update-k8s-overlay-images.mjs`

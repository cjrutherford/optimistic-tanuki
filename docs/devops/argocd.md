# ArgoCD Deployment

## Overview

ArgoCD is used for GitOps-based deployment to Kubernetes. The application definitions are in `k8s/argo-app/`.

## Setup

### 1. Install ArgoCD

```bash
# Install ArgoCD
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Get admin password
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
```

### 2. Access ArgoCD UI

```bash
# Port forward
kubectl port-forward svc/argocd-server 8080:443 -n argocd
```

Navigate to `https://localhost:8080` and login with:

- Username: `admin`
- Password: (from above)

## Application Definition

The ArgoCD Application is defined in `k8s/argo-app/application.yaml`:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: optimistic-tanuki
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/your-repo/optimistic-tanuki
    targetRevision: main
    path: k8s/overlays/production
  destination:
    server: https://kubernetes.default.svc
    namespace: optimistic-tanuki
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

## Deploying

### Option 1: CLI

```bash
# Apply application definition
kubectl apply -f k8s/argo-app/application.yaml

# Sync (deploy)
argocd app sync optimistic-tanuki
```

### Option 2: UI

1. Open ArgoCD UI
2. Click "New Application"
3. Fill in details:
   - Application Name: `optimistic-tanuki`
   - Project: `default`
   - Source: Repository URL
   - Path: `k8s/overlays/production`
   - Destination: Cluster URL, namespace `optimistic-tanuki`
4. Click "Create"
5. Click "Sync" to deploy

## Sync Options

| Option    | Description                       |
| --------- | --------------------------------- |
| Manual    | Click Sync button in UI           |
| Automatic | Auto-sync on Git push             |
| Prune     | Remove resources deleted from Git |
| Self-Heal | Reconcile drift                   |

## Monitoring

```bash
# View application status
argocd app get optimistic-tanuki

# Watch sync progress
argocd app wait optimistic-tanuki

# View resource status
argocd app resources optimistic-tanuki
```

## Rollback

```bash
# List history
argocd app history optimistic-tanuki

# Rollback to previous revision
argocd app rollback optimistic-tanuki <revision>
```

## Troubleshooting

```bash
# View sync status
argocd app sync optimistic-tanuki

# View logs
argocd app logs optimistic-tanuki

# Sync with force
argocd app sync optimistic-tanuki --force
```

## Directory Structure

```
k8s/
├── base/                    # Base Kustomize
│   ├── kustomization.yaml
│   ├── gateway.yaml
│   ├── clients/
│   └── services/
├── overlays/
│   ├── production/          # Production Kustomize
│   │   └── kustomization.yaml
│   └── staging/            # Staging Kustomize
│       └── kustomization.yaml
└── argo-app/
    └── application.yaml   # ArgoCD Application
```

## Kustomize Overlays

### Production Overlay

```yaml
# k8s/overlays/production/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - ../../base

namespace: optimistic-tanuki
```

### Staging Overlay

```yaml
# k8s/overlays/staging/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - ../../base

namespace: optimistic-tanuki-staging
```

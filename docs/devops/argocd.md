# ArgoCD Deployment

## Overview

ArgoCD is used for GitOps deployment to Kubernetes. The repo now uses a single parameterized application manifest at `k8s/argo-app/application.yaml` and points it at environment-specific Kustomize overlays.

## Application Definition

The ArgoCD application is defined in `k8s/argo-app/application.yaml`:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: ${ARGO_APP_NAME:-optimistic-tanuki}
  namespace: argocd
spec:
  project: default
  source:
    repoURL: ${ARGO_REPO_URL:-https://github.com/cjrutherford/optimistic-tanuki.git}
    targetRevision: ${ARGO_TARGET_REVISION:-main}
    path: k8s/overlays/${ARGO_ENV:-production}
  destination:
    server: https://kubernetes.default.svc
    namespace: ${ARGO_NAMESPACE:-optimistic-tanuki}
```

## Applying the Application

### Production

```bash
sed \
  -e "s|\${ARGO_APP_NAME:-optimistic-tanuki}|optimistic-tanuki|g" \
  -e "s|\${ARGO_NAMESPACE:-optimistic-tanuki}|optimistic-tanuki|g" \
  -e "s|\${ARGO_ENV:-production}|production|g" \
  k8s/argo-app/application.yaml | kubectl apply -f -
```

### Staging

```bash
sed \
  -e "s|\${ARGO_APP_NAME:-optimistic-tanuki}|optimistic-tanuki-staging|g" \
  -e "s|\${ARGO_NAMESPACE:-optimistic-tanuki}|optimistic-tanuki-staging|g" \
  -e "s|\${ARGO_ENV:-production}|staging|g" \
  k8s/argo-app/application.yaml | kubectl apply -f -
```

## Syncing

```bash
argocd app sync optimistic-tanuki
argocd app sync optimistic-tanuki-staging

argocd app wait optimistic-tanuki
argocd app wait optimistic-tanuki-staging
```

## Image Promotion

ArgoCD does not pick image tags itself. The promoted tags live in:

- `k8s/overlays/staging/kustomization.yaml`
- `k8s/overlays/production/kustomization.yaml`

Those `images:` lists are updated by:

- `scripts/update-k8s-overlay-images.mjs`
- `.github/workflows/build-push.yml`
- `.github/workflows/deploy.yml`

The overlay image names are expected to stay aligned with the exported deployment inventory.

## Directory Structure

```text
k8s/
├── base/
├── overlays/
│   ├── production/
│   └── staging/
└── argo-app/
    └── application.yaml
```

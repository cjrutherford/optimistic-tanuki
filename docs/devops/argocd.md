# ArgoCD Deployment

## Overview

ArgoCD is used for GitOps deployment to Kubernetes.

The preferred path now comes from generated deployment workspaces:

- `dist/admin-env/<deployment>/argocd/application.yaml`
- `dist/admin-env/<deployment>/k8s`

The root `k8s/argo-app/application.yaml` template still exists as a compatibility path for environments that have not fully moved to generated workspaces.

For operators, the intended place to manage ArgoCD metadata is the `Kubernetes` document in `tools/admin-env-wizard`, not the root template file.

## Application Definition

The generated workspace application points ArgoCD at the repo-relative workspace path:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: <app-name>
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/cjrutherford/optimistic-tanuki.git
    targetRevision: main
    path: dist/admin-env/<deployment>/k8s
  destination:
    server: https://kubernetes.default.svc
    namespace: <namespace>
```

## Applying the Application

The normal workflow is:

1. open `dist/admin-env/<deployment>/deployment.yaml` in `admin-env`
2. edit ArgoCD app/project/namespace/repo/revision in the `Kubernetes` document
3. regenerate the workspace
4. apply `dist/admin-env/<deployment>/argocd/application.yaml`

### Preferred workspace path

```bash
kubectl apply -f dist/admin-env/<deployment>/argocd/application.yaml
```

### Legacy compatibility path

```bash
sed \
  -e "s|\${ARGO_APP_NAME:-optimistic-tanuki}|optimistic-tanuki|g" \
  -e "s|\${ARGO_NAMESPACE:-optimistic-tanuki}|optimistic-tanuki|g" \
  -e "s|\${ARGO_ENV:-production}|production|g" \
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
dist/admin-env/<deployment>/
├── argocd/
│   └── application.yaml
└── k8s/
    ├── base/
    ├── overlays/
    └── kustomization.yaml
```

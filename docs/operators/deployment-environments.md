---
title: Deployment Environments
summary: Manage generated deployment workspaces, validation, and apply flow for staging or production-style environments.
category: operators
audience: operator
section: operators
parent: docs/operators/overview
docRole: guide
featured: true
order: 3
tags:
  - k8s
  - argocd
  - deployment
---

# Deployment Environments

## When To Use

Use this page when you are operating a generated deployment workspace under `dist/admin-env/<deployment>/`.

## Prerequisites

- access to the repo root and generated deployment workspace
- `kubectl` and `argocd` access for the target environment
- `tools/admin-env-wizard` build dependencies available locally

## Primary Tooling

The preferred operator interface is `tools/admin-env-wizard`.

Open an existing deployment workspace:

```bash
cd tools/admin-env-wizard
GOCACHE=/tmp/go-build go run ./cmd/admin-env tui -deployment ../../dist/admin-env/<deployment>/deployment.yaml
```

Create a new deployment workspace:

```bash
cd tools/admin-env-wizard
GOCACHE=/tmp/go-build go run ./cmd/admin-env generate \
  -name <deployment> \
  -targets compose,k8s \
  -profile small-server \
  -env-file .env/<deployment>.yaml \
  -argocd-app <argocd-app-name>
```

## Commands

### Standard Workflow

1. Open or generate the deployment workspace.
2. Review `Deployment`, `Profile`, `Services`, `Images`, `Kubernetes`, and `Secrets`.
3. Inspect generated artifacts under `dist/admin-env/<deployment>/`.
4. Validate inventory and Compose/Kubernetes parity.
5. Apply the workspace.

### Required Validation

Run validations from the repo root:

```bash
DEPLOYMENT_WORKSPACE_DIR=dist/admin-env/<deployment> node scripts/validate-deployment-inventory.mjs
DEPLOYMENT_WORKSPACE_DIR=dist/admin-env/<deployment> bash scripts/validate-compose-k8s-parity.sh
```

Expected result:

- inventory validation exits successfully
- parity validation exits successfully

Do not treat the workspace as ready to apply until both validations pass.

### Apply Paths

Generated helper:

```bash
./dist/admin-env/<deployment>/deploy.sh
```

Repo-level entry points:

```bash
DEPLOYMENT_NAME=<deployment> ./scripts/deploy-staging.sh
DEPLOYMENT_NAME=<deployment> ./scripts/deploy-production.sh
```

### ArgoCD Path

Workspace-backed Argo application:

```bash
kubectl apply -f dist/admin-env/<deployment>/argocd/application.yaml
```

Use the `Kubernetes` document in `admin-env-wizard` to manage:

- Argo app name
- namespace
- repo URL
- target revision
- generated k8s path

## Failure Signals

- validation fails for deployment inventory or Compose/Kubernetes parity
- generated artifacts do not reflect the intended service or image set
- the ArgoCD application does not converge after apply
- required secrets or runtime config are missing from the target environment

## Recovery Steps

- reopen the workspace in `admin-env-wizard`
- inspect the `Services`, `Images`, `Kubernetes`, and `Secrets` documents
- regenerate the workspace before applying if the generated surfaces are stale
- re-run validation before retrying `deploy.sh` or ArgoCD sync

## Files To Inspect

- `dist/admin-env/<deployment>/deployment.yaml`
- `dist/admin-env/<deployment>/argocd/application.yaml`
- `dist/admin-env/<deployment>/compose/docker-compose.yaml`
- `dist/admin-env/<deployment>/gateway/composition.yaml`
- `dist/admin-env/<deployment>/k8s/kustomization.yaml`

## Related Docs

- [Runbooks](./runbooks.md)
- [Troubleshooting](./troubleshooting.md)
- [Deployment Workspace Workflow](../devops/deployment-workspace-workflow.md)
- [Deployment Generation](../devops/deployment-generation.md)
- [ArgoCD](../devops/argocd.md)

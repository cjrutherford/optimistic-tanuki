---
title: Runbooks
summary: Repeatable operator procedures for startup, verification, deployment validation, and recovery.
category: operators
audience: operator
section: operators
parent: docs/operators/overview
docRole: runbook
order: 4
tags:
  - procedures
  - runbooks
---

# Runbooks

## When To Use

Use this page when you want the shortest repeatable procedure for a common operator task.

## Prerequisites

- repo dependencies installed with `pnpm install`
- Docker available for local-stack procedures
- generated deployment workspace present for deployment procedures

## Bootstrap The Local Stack

Use when a contributor needs the shared environment from scratch.

```bash
pnpm install
pnpm run docker:dev:bootstrap
pnpm run docker:dev:ps
```

Expected result:

- dependencies install successfully
- the phased dev stack starts
- seeded shared data is available

## Verify Local Stack Health

Use when the stack is already running and you need a quick health pass.

```bash
pnpm run docker:dev:ps
pnpm run docker:dev:logs
```

Expected result:

- required services show as running
- logs show successful startup rather than crash loops

## Validate A Generated Deployment Workspace

Use before apply, promotion, or troubleshooting a generated environment.

```bash
DEPLOYMENT_WORKSPACE_DIR=dist/admin-env/<deployment> node scripts/validate-deployment-inventory.mjs
DEPLOYMENT_WORKSPACE_DIR=dist/admin-env/<deployment> bash scripts/validate-compose-k8s-parity.sh
```

Expected result:

- deployment inventory is aligned with workflows and overlays
- Compose and Kubernetes parity checks pass

## Apply A Generated Deployment Workspace

Use after validation passes.

```bash
./dist/admin-env/<deployment>/deploy.sh
```

Expected result:

- generated deployment artifacts are applied for the selected targets

## Refresh ArgoCD Application State

Use when the generated workspace changed and the cluster application needs to track the new state.

```bash
kubectl apply -f dist/admin-env/<deployment>/argocd/application.yaml
argocd app sync <app-name>
argocd app wait <app-name>
```

Expected result:

- ArgoCD points at the intended workspace path
- sync completes without unresolved drift

## Related Docs

- [Local Stack Operations](./local-stack.md)
- [Deployment Environments](./deployment-environments.md)
- [Troubleshooting](./troubleshooting.md)

---
title: Operator Reference
summary: High-frequency commands, paths, and source-of-truth docs for platform operations.
category: operators
audience: operator
section: operators
parent: docs/operators/overview
docRole: reference
order: 6
tags:
  - commands
  - reference
---

# Operator Reference

## When To Use

Use this page when you need a high-frequency command, file path, or source-of-truth link without reading the longer guide pages.

## Local Stack Commands

```bash
pnpm run docker:dev
pnpm run docker:dev:bootstrap
pnpm run docker:dev:ps
pnpm run docker:dev:logs
pnpm run docker:dev:seed
pnpm run docker:dev:down
pnpm run docker:dev:reset
pnpm run docker:infra:up
```

## Deployment Workspace Commands

```bash
cd tools/admin-env-wizard
GOCACHE=/tmp/go-build go run ./cmd/admin-env tui -deployment ../../dist/admin-env/<deployment>/deployment.yaml
GOCACHE=/tmp/go-build go run ./cmd/admin-env generate -name <deployment> -targets compose,k8s
DEPLOYMENT_WORKSPACE_DIR=dist/admin-env/<deployment> node scripts/validate-deployment-inventory.mjs
DEPLOYMENT_WORKSPACE_DIR=dist/admin-env/<deployment> bash scripts/validate-compose-k8s-parity.sh
./dist/admin-env/<deployment>/deploy.sh
kubectl apply -f dist/admin-env/<deployment>/argocd/application.yaml
```

## High-Value Paths

- local stack workflow: `docs/devops/docker-compose.md`
- deployment workflow: `docs/devops/deployment-workspace-workflow.md`
- deployment generation mechanics: `docs/devops/deployment-generation.md`
- multi-domain routing guide: `docs/operators/multi-domain-deployments.md`
- sample public ingress map: `docs/operators/k8s/multi-domain-ingress.sample.yaml`
- ArgoCD workflow: `docs/devops/argocd.md`
- generated deployment workspaces: `dist/admin-env/<deployment>/`
- deployment tooling: `tools/admin-env-wizard/`

## Default Operator Rule

Prefer the generated deployment workspace and the repo scripts that understand it.

Compatibility-era root manifests still exist, but they are not the primary operator surface for new deployment work.

## Related Docs

- [Operator Handbook](./overview.md)
- [Local Stack Operations](./local-stack.md)
- [Deployment Environments](./deployment-environments.md)
- [Manual Docker Stacks](../devops/manual-docker-stacks.md)

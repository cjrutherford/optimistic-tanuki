---
title: Troubleshooting
summary: Recovery paths for common local-stack and deployment-environment operator failures.
category: operators
audience: operator
section: operators
parent: docs/operators/overview
docRole: runbook
featured: true
order: 5
tags:
  - recovery
  - troubleshooting
---

# Troubleshooting

## When To Use

Use this page when the operator workflow did not produce the expected local-stack or deployment-environment result.

## Failure Signals

- the local stack starts but a target app never becomes reachable
- source changes stop propagating into running containers
- seed data is missing after startup
- deployment validation fails
- ArgoCD remains out of sync after apply

## Recovery Steps

## Local Stack Failures

### Stack starts but the app does not load

Commands:

```bash
pnpm run docker:dev:ps
pnpm run docker:dev:logs
ls dist/apps
```

Recovery:

- rerun `pnpm run docker:dev` if required `dist/` output is missing
- use `pnpm run watch:build:scope -- --projects=<project>` when only one app needs active rebuilds

### Source changes do not appear in containers

Commands:

```bash
pnpm run watch:build
```

Recovery:

- confirm the relevant project rebuilds into `dist/`
- if only one app is changing, switch to `watch:build:scope`
- if a service is easier to run locally, use `pnpm exec nx serve <project>`

### Seed data is missing or partial

Commands:

```bash
pnpm run docker:dev:seed
```

Recovery:

- if the stack itself is suspect, rerun `pnpm run docker:dev:bootstrap`

### Broad environment drift

Commands:

```bash
pnpm run docker:dev:reset
```

Use only when:

- stale images, volumes, or shared-library drift make narrower recovery ineffective

## Deployment Environment Failures

### Generated workspace does not validate

Commands:

```bash
DEPLOYMENT_WORKSPACE_DIR=dist/admin-env/<deployment> node scripts/validate-deployment-inventory.mjs
DEPLOYMENT_WORKSPACE_DIR=dist/admin-env/<deployment> bash scripts/validate-compose-k8s-parity.sh
```

Recovery:

- reopen the workspace in `admin-env-wizard`
- review service selection, images, and generated target surfaces
- regenerate the workspace before rerunning validation

### ArgoCD application is out of date

Commands:

```bash
kubectl apply -f dist/admin-env/<deployment>/argocd/application.yaml
argocd app sync <app-name>
argocd app wait <app-name>
```

Recovery:

- confirm the generated application points at `dist/admin-env/<deployment>/k8s`
- confirm the selected revision and namespace match the intended environment

### Required runtime config is missing

Recovery:

- review the `Secrets` document in `admin-env-wizard`
- confirm the structured env backend has all required keys
- regenerate or materialize again after the missing keys resolve

## Related Docs

- [Local Stack Operations](./local-stack.md)
- [Deployment Environments](./deployment-environments.md)
- [Runbooks](./runbooks.md)

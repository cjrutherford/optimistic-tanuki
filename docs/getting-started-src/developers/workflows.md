---
id: developer-workflows
title: Daily Workflows
slug: workflows
summary: Use targeted Nx commands to build, test, and lint the parts of the workspace you change.
order: 30
---

# Daily Workflows

For the current Docker-backed local workflow, use the canonical guide: `docs/devops/docker-compose.md`.

Use targeted Nx commands while iterating:

```bash
pnpm exec nx build client-interface
pnpm exec nx test common-ui
pnpm exec nx lint gateway
pnpm run build:dev:scope -- --projects=gateway
pnpm run watch:build:scope -- --projects=gateway,authentication
pnpm exec nx serve authentication
pnpm exec nx serve client-interface
```

Use `watch:build:scope` when you are iterating on one app or a small dependency set.

Use `watch:build` only when you intentionally need the whole Docker dev stack to stay rebuildable.

Prefer the hybrid inner loop when one app is changing quickly:

- keep infra in Docker with `pnpm run docker:infra:up`
- run the active app locally with `pnpm exec nx serve <project>`
- avoid the full Compose stack unless you need cross-service validation

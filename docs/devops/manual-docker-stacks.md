---
title: Manual Docker Stacks
summary: Reference for the Docker and Compose entrypoints hidden behind repo-level pnpm scripts.
category: devops
section: operators
docRole: reference
order: 18
tags:
  - docker
  - compose
  - scripts
---

# Manual Docker Stacks

This page documents the Docker and Compose flows that are reachable through repo-level `pnpm` scripts but are easy to miss when you only read `package.json`.

## Full Development Stack

Primary entrypoint:

```bash
pnpm run docker:dev
```

This expands to:

1. `pnpm run build:docker:dev`
2. `pnpm run docker:build:dev`
3. `pnpm run docker:dev:up`

Operational meaning:

- Nx builds the development artifact set into `dist/`
- batched Docker image builds run through `scripts/docker-build-batched.sh`
- phased startup runs through `scripts/docker-start-phased.sh docker-compose.dev.yaml 5`

Use it when:

- you need the integrated local platform
- cross-service validation matters more than fast iteration

## Infra-Only Stack

Primary entrypoints:

```bash
pnpm run docker:infra:up
pnpm run docker:infra:logs
pnpm run docker:infra:down
```

Compose surface:

- `docker-compose.yaml`
- `docker-compose.dev.yaml`

Services started:

- `postgres`
- `redis`
- `db-setup`

Use it when:

- one app runs locally with `pnpm exec nx serve <project>`
- you only need shared infrastructure

## Seeded Development Bootstrap

Primary entrypoint:

```bash
pnpm run docker:dev:bootstrap
```

This expands to:

1. full development stack startup
2. `pnpm run docker:dev:seed`

The seed flow is implemented in `scripts/dev-seed.sh`. It refreshes selected containers and runs the shared seed scripts for:

- telos docs
- permissions
- store
- social
- classifieds
- payments
- business-site
- videos
- assets

Use it when:

- the stack is present but shared platform data is missing or stale

## Batched Build Paths

Primary entrypoints:

```bash
pnpm run docker:build
pnpm run docker:build:batched
pnpm run docker:build:batched:dev
pnpm run docker:build:batched:prod
pnpm run docker:build:batched:quick
pnpm run docker:build:slow
```

Implementation detail:

- `scripts/docker-build-batched.sh` derives a bake file from Compose and builds services in batches
- `docker:build:slow` is the explicit sequential fallback

Use batched builds for normal work. Use `docker:build:slow` only when you need a transparent, one-service-at-a-time path for debugging build failures.

## Forge Of Will Stack

Primary entrypoints:

```bash
pnpm run fow:docker:build:dev
pnpm run fow:docker:dev
pnpm run fow:docker:down
```

Compose surface:

- `fow.docker-compose.yaml`
- `fow.docker-compose.dev.yaml`

Operational meaning:

- this is a narrower stack for the Forge of Will surface
- after startup it seeds `telos-docs-service`

Use it when:

- you want a narrower workflow than the full platform stack
- the Forge of Will-specific container path is enough

## E2E Docker Stacks

Primary entrypoints:

```bash
pnpm run e2e:docker:up
pnpm run e2e:docker:test
pnpm run e2e:docker:down
```

Compose surface:

- `docker-compose.local-hub-e2e.yaml`

The repo also contains suite-specific E2E compose files under `apps/*-e2e/project.json`.

Use these when:

- you need suite-scoped browser validation backed by containers instead of the full dev stack

## Source Files

- `scripts/docker-build-batched.sh`
- `scripts/docker-start-phased.sh`
- `scripts/dev-seed.sh`
- `docker-compose.yaml`
- `docker-compose.dev.yaml`
- `docker-compose.local-hub-e2e.yaml`
- `fow.docker-compose.yaml`
- `fow.docker-compose.dev.yaml`

## Related Docs

- [Docker Compose Development](./docker-compose.md)
- [Operator Handbook](../operators/overview.md)
- [Runbooks](../operators/runbooks.md)

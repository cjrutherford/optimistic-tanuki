---
title: Local Stack Operations
summary: Formal operating guide for the shared Docker Compose development stack.
category: operators
audience: operator
section: operators
parent: docs/operators/overview
docRole: guide
featured: true
order: 2
tags:
  - docker
  - local
---

# Local Stack Operations

## When To Use

Use this page when you are administering the shared local platform running through Docker Compose.

## Prerequisites

- Docker Engine or Docker Desktop with Compose support
- Node.js and `pnpm`
- workspace dependencies installed with `pnpm install`

## Commands

### Full Stack Startup

Use when you need the integrated environment:

```bash
pnpm run docker:dev
pnpm run watch:build
```

Expected result:

- compiled artifacts land in `dist/`
- dev images are rebuilt
- the phased development stack starts

### First-Time Bootstrap

Use when you need the shared seed step after startup:

```bash
pnpm run docker:dev:bootstrap
```

Expected result:

- the stack starts
- shared seed data is applied to the dev environment

### Infra-Only Inner Loop

Use when one app runs locally and only shared services stay containerized:

```bash
pnpm run docker:infra:up
```

Expected result:

- Postgres, Redis, and the `db-setup` job are available

## Expected Result

- the chosen stack path starts without crash loops
- `dist/` contains the application artifacts required by the selected workflow
- shared infrastructure services stay reachable long enough for bootstrap, seed, and app startup

## Health Checks

Run these in order:

```bash
pnpm run docker:dev:ps
pnpm run docker:dev:logs
ls dist/apps
```

Healthy signals:

- expected containers show as running
- service logs show startup rather than restart loops
- the relevant app exists under `dist/apps`

## Failure Signals

- containers are running but the app does not load
- source changes do not appear in the stack
- rebuild latency is too high for active work
- seed commands fail or leave the stack partially initialized

## Recovery Steps

### Tail Stack Logs

```bash
pnpm run docker:dev:logs
```

Use when:

- the stack starts but a frontend or service does not respond
- a seed or migration step appears incomplete

### Re-Run The Shared Seed Step

```bash
pnpm run docker:dev:seed
```

Use when:

- the environment is up
- shared roles, permissions, or seeded data are missing

### Stop The Stack Cleanly

```bash
pnpm run docker:dev:down
```

Use when:

- you need to free local resources
- you are preparing for a clean restart

### Reset Broad Image Or Volume Drift

```bash
pnpm run docker:dev:reset
```

Use only when:

- image drift, stale volumes, or broad shared-library drift make targeted recovery unreliable

## Related Docs

- [Troubleshooting](./troubleshooting.md)
- [Manual Docker Stacks](../devops/manual-docker-stacks.md)
- [Docker Compose Development](../devops/docker-compose.md)

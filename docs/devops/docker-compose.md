# Docker Compose Development

This page is the canonical local-stack guide for this repository. Other docs should link here instead of restating the workflow.

## Relationship to the Deployment Inventory

Compose is now part of the deployment contract instead of a separate drifting surface.

- The canonical app list comes from `tools/admin-env-wizard/cmd/deployment-inventory`.
- `scripts/validate-compose-k8s-parity.sh` checks that apps marked as deployable to k8s have matching Compose and base k8s manifests.
- `scripts/validate-deployment-inventory.mjs` checks that the same inventory matches the GitHub Actions build matrix and Kustomize overlays.

That means adding a new deployable app usually requires coordinated changes across:

- the Go catalog in `tools/admin-env-wizard`
- `docker-compose.yaml`
- `k8s/base/`
- the overlay image lists

## Local Development Modes

### 1. Full Compose Dev Stack

Use this when you need the integrated platform running inside Docker.

```bash
pnpm run docker:dev
pnpm run watch:build
```

What `docker:dev` actually does:

- runs `build:docker:dev`
- builds the dev images with `docker:build:dev`
- starts the stack with `docker:dev:up`, which uses `scripts/docker-start-phased.sh`

This is intentionally slower than a local single-app loop because it rebuilds a large Nx project set, rebuilds Docker images, and starts the stack in phases.

Common commands:

```bash
pnpm run docker:dev:bootstrap
pnpm run docker:dev:ps
pnpm run docker:dev:logs
pnpm run docker:dev:down
pnpm run docker:dev:reset
```

### 2. Hybrid Inner Loop

Use this when you are actively editing one app and want the fastest turnaround.

- keep shared dependencies in Docker
- run the active app locally with `pnpm exec nx serve <project>`
- use targeted build/watch commands instead of rebuilding the whole workspace

Backend recipe:

```bash
pnpm run docker:infra:up
pnpm exec nx serve authentication
```

Frontend or SSR recipe:

1. Start the full stack once if peer services are needed.
2. Stop the container for the app you are editing.
3. Run that app locally with `pnpm exec nx serve <project>`.

Example:

```bash
pnpm run docker:dev
docker compose -f docker-compose.yaml -f docker-compose.dev.yaml stop ot-client-interface
pnpm exec nx serve client-interface
```

Scoped build helpers for container-backed iteration:

```bash
pnpm run build:dev:scope -- --projects=gateway
pnpm run watch:build:scope -- --projects=gateway,authentication
pnpm run watch:build:scope -- --projects=client-interface
```

Use `watch:build:scope` when you are iterating on one app or a small dependency set. Use `watch:build` only when you intentionally need the whole Docker dev stack to stay rebuildable.

### 3. Plain Production-Like Compose

Use this when you want the non-debug image startup path.

```bash
docker compose up -d
```

## Dist-Driven Restart Flow

The Docker dev stack does not compile TypeScript inside containers. Source changes only appear after Nx rebuilds the affected project into `dist/`, and the container restarts when `nodemon` sees the compiled output change.

```text
src/ -> nx build --watch -> dist/ -> bind mount -> nodemon restart
```

This is restart on compiled-output change, not HMR and not source-level reload inside containers.

## Choosing A Workflow

| Goal                                       | Recommended path                                  |
| ------------------------------------------ | ------------------------------------------------- |
| Validate the integrated stack              | `pnpm run docker:dev` plus `pnpm run watch:build` |
| Iterate on one app quickly                 | hybrid inner loop                                 |
| Verify image or container startup behavior | `docker compose up -d`                            |

## Dev Restart Support Matrix

The dev stack already has restart-on-compiled-output support for several services beyond the ones fixed in this change. The key question is whether the service has all three pieces wired together:

- an override in `docker-compose.dev.yaml`
- a mounted `dist/` path that matches the runtime path
- a `nodemon` command watching compiled output

The services called out below are the ones this cleanup verified directly because they were previously misleading or incomplete:

| Service                                              | Dev restart support | Notes                                             |
| ---------------------------------------------------- | ------------------- | ------------------------------------------------- |
| `wellness`                                           | supported           | watches mounted `dist/apps/wellness`              |
| `assets`                                             | supported           | nodemon watches compiled output in `/usr/src/app` |
| `videos`                                             | supported           | nodemon watches compiled output in `/usr/src/app` |
| `video-client`                                       | supported           | nodemon watches the SSR server bundle             |
| `video-transcoder-worker`                            | unsupported         | separate workflow, no repo-wide watch integration |
| services not overridden in `docker-compose.dev.yaml` | unsupported         | use hybrid inner loop or rebuild the image        |

## Recommended Turnaround Strategy

1. Use the hybrid inner loop while actively changing one app.
2. Use `watch:build:scope` for the active app or a very small dependency set.
3. Use the full Compose dev stack only when validating cross-service integration.
4. Fall back to `pnpm run docker:dev:reset` only when image, volume, or broad shared-library drift makes targeted iteration unreliable.

Do not default to `pnpm run docker:dev` when:

- you are editing only one frontend
- you are editing only one Nest service
- you only need Postgres or Redis

## Infra-Only Commands

```bash
pnpm run docker:infra:up
pnpm run docker:infra:logs
pnpm run docker:infra:down
```

These commands are meant for the hybrid inner loop. They only start shared infrastructure and the `db-setup` job.

## Primary Local URLs

### Frontends

- Main app: `http://localhost:8080`
- Leads app: `http://localhost:4201`
- Forge of Will: `http://localhost:8081`
- Digital Homestead: `http://localhost:8082`
- christopherrutherford.net: `http://localhost:8083`
- Owner Console: `http://localhost:8084`
- Store Client: `http://localhost:8085`
- D6: `http://localhost:8086`
- Local Hub: `http://localhost:8087`
- Configurable Client: `http://localhost:8090`
- Hardware Configurator: `http://localhost:8091`

### Backend and Infra

- Gateway HTTP: `http://localhost:3000`
- Gateway chat socket: `ws://localhost:3300`
- Gateway social socket: `ws://localhost:3301`
- Postgres: `localhost:5432`
- Redis: `localhost:6379`
- Lead Tracker: `http://localhost:3020`

## Common Failure Modes

### `docker:dev` starts containers but the app still does not load

```bash
pnpm run docker:dev:ps
ls dist/apps
```

If `dist/` is incomplete, rerun:

```bash
pnpm run docker:dev
```

Remember that `docker:dev:up` is phased startup, not a raw `docker compose up -d`, so reproducing the same behavior means using the repo scripts.

### Source changes do not appear in the running stack

The containers do not build TypeScript for you. Make sure the relevant watch process is running:

```bash
pnpm run watch:build
```

If only one app is changing, prefer:

```bash
pnpm run watch:build:scope -- --projects=<project>
```

Then confirm the service is either listed in the verified matrix above or has the same `dist` mount plus `nodemon` pattern in `docker-compose.dev.yaml`.

### Rebuild latency is too high

- switch from `watch:build` to `watch:build:scope`
- run the active app locally with `pnpm exec nx serve <project>`
- reserve `pnpm run docker:dev:reset` for stale-image or stale-volume problems

### Seed commands fail

Use the bootstrap command so the seed scripts target the same dev Compose stack:

```bash
pnpm run docker:dev:bootstrap
```

If you need to rerun only the seed phase:

```bash
pnpm run docker:dev:seed
```

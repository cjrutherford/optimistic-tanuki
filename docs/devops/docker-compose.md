# Docker Compose Development

This repository has two Compose paths:

- `docker compose up -d`: the standard container stack
- `npm run docker:dev`: the full development stack with debug ports, rebuilt `dist/`, and dev-oriented overrides

For day-to-day local work, use `npm run docker:dev`.

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

## Why `docker:dev` Needs a Build First

The development override mounts built application output from `dist/` into many containers and runs those artifacts under `nodemon`.

That means `docker compose up -d` on its own is not enough for a reliable full-stack startup:

- SSR frontends wait for built server bundles in `dist/apps/*/server`
- Nest services run built entrypoints from `dist/apps/*`
- if `dist/` is missing or stale, containers can come up but not actually serve the app you expect

The root `docker:dev` script handles that by running `build:dev` before Compose startup.

## Full-Stack Commands

```bash
# Start the full development stack
npm run docker:dev

# First-time bootstrap with seed data
npm run docker:dev:bootstrap

# Keep hot reload active
npm run watch:build

# Inspect and control the stack
npm run docker:dev:ps
npm run docker:dev:logs
npm run docker:dev:down
npm run docker:dev:reset
```

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
npm run docker:dev:ps
ls dist/apps
```

If `dist/` is incomplete, rerun:

```bash
npm run docker:dev
```

### Source changes do not appear in the running stack

The containers do not build TypeScript for you. Make sure the watch process is running:

```bash
npm run watch:build
```

### Seed commands fail

Use the bootstrap command so the seed scripts target the same dev Compose stack:

```bash
npm run docker:dev:bootstrap
```

If you need to rerun only the seed phase:

```bash
npm run docker:dev:seed
```

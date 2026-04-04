# Docker Compose Development

This repository has two Compose paths:

- `docker compose up -d`: the standard container stack
- `npm run docker:dev`: the full development stack with debug ports and `nodemon`

For day-to-day local work, use `docker:dev`.

## Why `docker:dev` Needs a Build First

The development override mounts built application output from `dist/` into many containers and runs those artifacts under `nodemon`.

That means `docker compose ... up -d` on its own is not enough for a reliable full-stack startup:

- SSR frontends wait for built server bundles in `dist/apps/*/server`
- Nest services run built entrypoints from `dist/apps/*`
- if `dist/` is missing or stale, containers can come up but not actually serve the app you expect

The root `docker:dev` script now handles that by running `build:dev` before Compose startup.

## Full-Stack Commands

### Start the full development stack

```bash
npm run docker:dev
```

This does:

1. `npm run build:dev`
2. `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml up -d --remove-orphans`

### First-time bootstrap with seed data

```bash
npm run docker:dev:bootstrap
```

This starts the full dev stack, then runs the seed scripts against the same Compose project.

The bootstrap seed step uses `scripts/dev-seed.sh`, which runs with explicit `-w` values per service. Most seeds use `docker compose exec -T`, while the social seeds use `docker compose run --rm --no-deps` because `exec` is not reliable for the long-running dev social container in this stack.

### Keep hot reload active

Run this in a second terminal after `docker:dev`:

```bash
npm run watch:build
```

Changes flow like this:

1. source changes in `apps/` or `libs/`
2. Nx rebuilds into `dist/`
3. mounted `dist/` changes become visible in containers
4. `nodemon` restarts the affected service

### Inspect and control the stack

```bash
npm run docker:dev:ps
npm run docker:dev:logs
npm run docker:dev:down
npm run docker:dev:reset
```

## Services in the Dev Stack

The merged dev Compose configuration currently includes these services:

```text
redis
postgres
db-setup
telos-docs-service
blogging
forum
wellness
assets
digital-homestead-client-interface
authentication
leads-app
ot-client-interface
project-planning
prompt-proxy
ai-orchestration
classifieds
forgeofwill-client-interface
profile
chat-collector
lead-tracker
permissions
social
payments
gateway
local-hub-client-interface
store-client
app-configurator
app-configurator-seed
system-configurator-api
crdn-client-interface
owner-console
store
d6
configurable-client
system-configurator
```

To verify that list locally:

```bash
docker compose -f docker-compose.yaml -f docker-compose.dev.yaml config --services
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

### Backend / infra

- Gateway HTTP: `http://localhost:3000`
- Gateway chat socket: `ws://localhost:3300`
- Gateway social socket: `ws://localhost:3301`
- Postgres: `localhost:5432`
- Redis: `localhost:6379`
- Lead Tracker: `http://localhost:3020`

## Debug Ports

The development override exposes Node inspector ports for many services. A few common ones:

- gateway: `9000`
- authentication: `9229`
- profile: `9234`
- social: `9232`
- lead-tracker: `9233`
- assets: `9235`
- leads-app SSR server: `9244`

See `docker-compose.dev.yaml` for the full mapping.

## Common Failure Modes

### `docker:dev` starts containers but the app still does not load

Check whether the build artifacts exist and the containers are healthy:

```bash
npm run docker:dev:ps
ls dist/apps
```

If `dist/` is incomplete, rerun:

```bash
npm run docker:dev
```

### A specific service is exiting or waiting forever

Inspect that service directly:

```bash
docker compose -f docker-compose.yaml -f docker-compose.dev.yaml logs -f <service-name>
```

Examples:

```bash
docker compose -f docker-compose.yaml -f docker-compose.dev.yaml logs -f gateway
docker compose -f docker-compose.yaml -f docker-compose.dev.yaml logs -f leads-app
docker compose -f docker-compose.yaml -f docker-compose.dev.yaml logs -f lead-tracker
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

If you see an error like `current working directory is outside of container mount namespace root`, the fix is to use the scripted seed path above rather than ad hoc `docker compose exec` calls without an explicit `-w`.

## Standard Stack vs Dev Stack

| Task | Command |
| --- | --- |
| Full local development | `npm run docker:dev` |
| Full local development + seeds | `npm run docker:dev:bootstrap` |
| Hot reload loop | `npm run watch:build` |
| Stop development stack | `npm run docker:dev:down` |
| Production-like local compose | `docker compose up -d` |

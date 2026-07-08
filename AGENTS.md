<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->

<!-- operational guidance for this repo respectively -->

# General Note on working with this project

This is a large project and needs to be handled with care or there will be a long turn around on changes. When working on a task, please track which apps and libs are being touched to ensure we can streamline the rebuild process.

We want to have the quickest turnaround on changes, so please use the most efficient script (preferably with pnpm) to apply the changes to the local stack.

New components and UX should either try to use existing component elements or build new libraries to allow for reusability. The defining goal in the architecture is that the platform provides, apps shouldn't have to create their own elements unless it's for structure or unique to that specific application.

## E2E Check Process

- Treat the three primary UX validation targets as `client-interface`, `forgeofwill`, and `business-site` unless the user narrows scope.
- Default all Nx-driven verification to `NX_DAEMON=false` and `NX_ISOLATE_PLUGINS=false`.
- Prefer running the checked-in Nx e2e target first. If the suite is intended to validate against an already-running Docker stack, set the suite-specific skip flags so global setup does not rebuild or restart infrastructure.
- When validating against the live Docker stack, confirm the expected app ports are already up before rerunning tests:
  - `client-interface` at `http://127.0.0.1:8080`
  - `forgeofwill` at `http://127.0.0.1:8081`
  - `business-site` at `http://127.0.0.1:8094`
- Prefer the system Chrome channel for Playwright-based e2e runs in this repo. If Playwright-managed browser installation is missing or unsupported on the host, do not stop at the install failure; rerun with the checked-in config that targets Chrome.
- For `SKIP_SETUP=true` or other live-stack runs, teardown must not bring down shared Docker services. Respect the existing environment flags before stopping compose stacks.
- When an e2e failure appears after a UX refactor, inspect shared libraries first for DRY fixes before patching multiple app suites independently.
- After changes, rerun the smallest failing e2e slice first, then rerun the affected app suite, and only then rerun broader cross-app validation.

## Standalone Audio Models Server (External)

The `audio-models` service runs PyTorch-based MusicGen and Demucs on a GPU server and is **not** part of the main Docker Compose stack. It requires NVIDIA GPUs and must be operated separately.

### Setup

```bash
# On the target server (must have NVIDIA GPU + nvidia-container-toolkit installed):
git clone <repo-url>
cd optimistic-tanuki

# Build the audio-models image
docker build -t optimistic-tanuki-audio-models:latest docker/audio-models/

# Run with GPU passthrough
docker run -d \
  --name ot_audio_models \
  --gpus all \
  -p 3100:3100 \
  -v audio-model-data:/models \
  -e OLLAMA_HOST=http://<host>:3009 \
  optimistic-tanuki-audio-models:latest
```

### Service connectivity

The `audio-workstation` microservice expects `audio-models` at `SERVICE_AUDIO_MODELS_HOST` (default: `audio-models`) on port `3100`. When running on an external server:

1. Set `AUDIO_MODELS_HOST=<external-ip>` in the `audio-workstation` environment in either compose file.
2. Or use Docker's `extra_hosts` to point the `audio-models` hostname to the external IP.

### Health check

```
curl http://<external-ip>:3100/health
```

The model server exposes:

- `POST /generate` — generate music from prompt (MusicGen)
- `POST /separate` — separate stems (Demucs)
- `GET /health` — health check

## E2E Testing for Orchestra Features

Two e2e projects exist for the audio/orchestra features:

### orchestra-client-e2e (Playwright)

Browser-based E2E tests for the Orchestra SSR app at `apps/orchestra-client-e2e/`.

Tests cover:

- Projects page loads with empty state
- Create a new project → navigate to workspace
- Collaboration mode selection (Full Auto / Cover / Full Collab)
- Stem management and generation prompts
- Chat panel with all three agents (Composer, Mix, Master)
- Arrangement / Mix tab switching
- Export dialog and transport bar

Run against the running Docker stack:

```bash
pnpm exec nx run orchestra-client-e2e:e2e
```

### audio-workstation-e2e (Jest)

TCP microservice E2E tests for the audio-workstation at `apps/audio-workstation-e2e/`.

Tests exercise all TCP message patterns:

- Project CRUD (create, get, update, list, delete)
- Track management (create, list, update, delete)
- Generation requests and status polling
- Mix snapshot save and listing
- Export start, status, and listing

Run against the running Docker stack:

```bash
HOST=localhost PORT=3025 pnpm exec nx run audio-workstation-e2e:e2e
```

### Docker Compose for standalone e2e runs

Each project has a minimal Docker compose file under `e2e/`:

- `e2e/docker-compose.orchestra-client-e2e.yaml` — full stack (db, redis, audio-workstation, gateway, orchestra-client)
- `e2e/docker-compose.audio-workstation-e2e.yaml` — minimal stack (db, redis, audio-workstation only)

Usage:

```bash
docker compose -f e2e/docker-compose.audio-workstation-e2e.yaml up -d
pnpm exec nx run audio-workstation-e2e:e2e
docker compose -f e2e/docker-compose.audio-workstation-e2e.yaml down
```

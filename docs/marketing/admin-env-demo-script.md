# Demo Script: Admin Environment Wizard to Running Gateway

This script is written for an ops or platform-engineering audience. The goal is to show that the repo can generate a deployment shape, start the stack from generated output, and expose a live gateway contract through Swagger UI.

## Demo Goal

Show three things in one pass:

1. the deployment shape is generated from one catalog-driven tool
2. the generated output can start a concrete stack
3. the gateway exposes a discoverable API surface immediately after startup

## Setup Notes

- prerequisites: Docker, Docker Compose, Node.js, pnpm, and Go
- audience framing: "This is the operator path from catalog selection to a runnable environment."
- preferred window layout: terminal for generation, terminal for startup, browser for Swagger UI

## Walkthrough

### 1. Introduce the generator

Narration:

> "The admin environment wizard is the deployment compiler for this repo. It takes service and capability selections and turns them into concrete Compose and Kubernetes output."

Command:

```bash
cd /tmp/workspace/cjrutherford/optimistic-tanuki/tools/admin-env-wizard
```

Optional TUI mention:

```bash
go run ./cmd/admin-env tui
```

Narration:

> "The TUI is useful for showing the operator experience, but for a repeatable demo I will generate the same output with the CLI so the exact deployment contract stays visible in the terminal."

### 2. Generate a deployment

Command:

```bash
GOCACHE=/tmp/go-build go run ./cmd/admin-env generate \
  -name demo \
  -namespace optimistic-tanuki \
  -targets compose \
  -infra postgres,redis \
  -services gateway,authentication \
  -compose-mode image \
  -output-dir /tmp/admin-env-demo
```

Narration:

> "This produces a deployment tree with generated Compose output, provider-aware fragments, and gateway composition. The important point is that the stack definition comes from one catalog-driven source of truth instead of hand-maintained environment files."

### 3. Show the generated artifacts

Call out these paths:

- `/tmp/admin-env-demo/deploy.sh`
- `/tmp/admin-env-demo/compose/docker-compose.yaml`
- `/tmp/admin-env-demo/gateway/composition.yaml`

Narration:

> "The generated gateway composition tells the shared gateway image which service-backed surfaces should exist in this deployment. That gives us one gateway codebase with deployment-specific exposure."

### 4. Start the generated stack

Command:

```bash
docker compose -f /tmp/admin-env-demo/compose/docker-compose.yaml up -d
```

Narration:

> "Now we are not hand-assembling containers. We are starting the exact stack that the generator produced for this deployment shape."

### 5. Verify the gateway surface

Open:

- `http://localhost:3000/api-docs`

Narration:

> "Swagger UI is the fastest proof that the generated deployment is alive and that the gateway contract is discoverable. For a platform team, this is the handoff point from environment generation to service verification."

Optional terminal check:

```bash
docker compose -f /tmp/admin-env-demo/compose/docker-compose.yaml ps
```

### 6. Close with the platform message

Narration:

> "The value here is not just local startup. The same generator also emits Kubernetes output and deployment inventory data, so the platform can keep Compose, K8s, CI validation, and gateway composition aligned from one toolchain."

## Demo Ending

Finish by pointing back to:

- `tools/admin-env-wizard/README.md`
- `docs/devops/deployment-generation.md`
- `apps/gateway/README.md`

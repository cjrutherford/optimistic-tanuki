# Environment-First SMTP Configuration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Supply Stalwart SMTP configuration to authentication directly from deployment environment variables.

**Architecture:** Authentication already reads `SMTP_*` values from Nest configuration. Docker Compose must pass the six variables through to the service, matching the existing Kubernetes secret injection. The Setup Console remains optional and is not part of runtime configuration.

**Tech Stack:** Docker Compose, NestJS configuration, Nx.

---

### Task 1: Wire local Docker Compose environment

**Files:**

- Modify: `docker-compose.yaml`

**Step 1: Validate the current failure mode**

Run: `docker compose -f docker-compose.yaml config`

Expected: The resolved `authentication` environment does not contain `SMTP_HOST`.

**Step 2: Add the six SMTP pass-through variables**

Add `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM` to the `authentication` service environment, with safe host/port/TLS/from defaults and no default password.

**Step 3: Validate the resolved contract**

Run: `docker compose -f docker-compose.yaml config`

Expected: The resolved `authentication` environment contains all six SMTP keys.

**Step 4: Verify source quality**

Run: `git diff --check`

Expected: no output.

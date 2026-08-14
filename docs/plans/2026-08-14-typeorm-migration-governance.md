# TypeORM Migration Governance Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make CLI-generated TypeORM migrations the workspace standard, validate migration ordering before CI bootstrap, and replace the malformed active migration timestamps that block `db-setup`.

**Architecture:** Every service with a registered TypeORM DataSource receives identical Nx `typeorm:migration:{generate,run,revert,show}` targets, each using that service's actual static DataSource. A repository validator inspects registered TypeORM migration classes and rejects non-CLI timestamps, name/file timestamp divergence, and non-monotonic runtime ordering. The active malformed classifieds and videos migrations are replaced with CLI-generated, 13-digit-timestamp migrations; data backfills use a CLI-created scaffold with explicit reversible SQL. Forge of Will's unregistered frontend-only artifact is out of scope. Their service tests and a fresh composed `db-setup` run verify bootstrap.

**Tech Stack:** Nx 21, NestJS, TypeORM 0.3, PostgreSQL, Docker Compose, Jest, Node.js.

**Workspace constraint:** Work in the current checkout. Do not create a worktree for this repository.

---

### Task 1: Establish migration policy and an executable validation gate

**Files:**

- Modify: `AGENTS.md`
- Modify: `docs/guides/agents.md`
- Create: `scripts/validate-typeorm-migrations.mjs`
- Modify: `scripts/setup-and-migrate.sh`
- Create: `scripts/tests/setup-and-migrate.test.mjs`
- Modify: `package.json`

**Step 1: Write a failing validator invocation**

Run: `pnpm run validate:typeorm-migrations`

Expected: FAIL because the registered classifieds and videos migration classes use 14-digit timestamps.

**Step 2: Add the validator**

Inspect each DataSource that loads migrations, resolve the registered migration files/classes, and fail on an invalid 13-digit class timestamp, filename/class timestamp mismatch, duplicate runtime timestamp, or non-monotonic order.

**Step 3: Add project directives**

Require the Nx `typeorm:migration:generate` target for schema changes. Permit CLI `migration:create` only for non-schema/data migrations with an explanatory header and reversible `up`/`down` behavior. Require review of generated SQL and a fresh migration run before merge.

**Step 4: Re-run the validator**

Expected: It continues to fail only for the known malformed active migrations until Task 3.

**Step 5: Make db-setup fail before database creation**

Invoke the validator in `scripts/setup-and-migrate.sh` after dependencies are available but before `create-dbs.sh`. Add a Node test that proves this order so malformed migration metadata cannot leave a partially initialized CI database behind.

### Task 2: Register a uniform CLI workflow for every active TypeORM service

**Files:**

- Modify: `apps/app-configurator/project.json`
- Modify: `apps/blogging/project.json`
- Modify: `apps/chat-collector/project.json`
- Modify: `apps/classifieds/project.json`
- Modify: `apps/finance/project.json`
- Modify: `apps/forum/project.json`
- Modify: `apps/store/project.json`
- Modify: `apps/system-configurator-api/project.json`
- Modify: `apps/telos-docs-service/project.json`
- Modify: `apps/videos/project.json`
- Modify: `apps/wellness/project.json`

**Step 1: Inspect a working target contract**

Use `profile` and `social` as references for command shape, `TS_NODE_PROJECT`, and app working directory.

**Step 2: Add missing generate/run/revert/show targets**

Use each project's `src/app/staticDatabase.ts`. Generation takes its destination through forwarded Nx arguments, e.g. `pnpm exec nx run classifieds:typeorm:migration:generate --args='migrations/add-classified-user-index'`.

**Step 3: Verify target resolution**

Run: `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm exec nx show project <project> --json`

Expected: Each active service exposes all four TypeORM targets.

### Task 3: Replace malformed active migration timestamps through the CLI workflow

**Files:**

- Delete: `apps/classifieds/migrations/20260809110000-index-classified-user-id.ts`
- Delete: `apps/videos/migrations/20260417143000-community-broadcast.ts`
- Delete: `apps/videos/migrations/20260418170000-video-processing-pipeline.ts`
- Create: CLI-generated replacement migrations in the same service migration locations
- Modify: affected imports and migration tests

**Step 1: Capture the intended schema delta with a clean PostgreSQL database**

Run each service's generated-migration target after its baseline migration is applied. Do not manually choose a timestamp.

**Step 2: Verify the generated source**

Confirm each replacement has a 13-digit file/class timestamp, correct `up` and `down` SQL, and no migration calls another migration directly.

**Step 3: Verify migration order**

Run the validator and relevant Jest suites. Expected: baseline migrations precede their dependent schema changes under TypeORM runtime ordering.

### Task 4: Prove clean-stack bootstrap and CI coverage

**Files:**

- Modify: `.github/workflows/performance.yml` only if the validator is not already included by existing validation coverage.

**Step 1: Run focused service checks**

Run affected `classifieds` and `videos` Nx tests, then builds.

**Step 2: Run a fresh minimal db-setup composition**

Use a distinct Compose project and fresh volumes. Confirm `db-setup` exits successfully before starting the full performance workload.

**Step 3: Run the repository migration validator and relevant CI-equivalent check**

Expected: all registered migration ordering checks pass; no existing stack is stopped or reused.

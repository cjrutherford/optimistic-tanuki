# Publish, Preview, Audit Trust Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make owner configuration updates, publishes, and rollbacks safe against stale writes and record the trusted actor for every public release revision.

**Architecture:** Add a monotonic `revision` column to the app-configuration aggregate. All owner mutations carry `expectedRevision`; the service performs an owner-scoped conditional update so a competing writer receives a conflict rather than silently overwriting state. Release history remains the human-readable audit trail, extended with actor data derived exclusively from the gateway-provided ownership context.

**Tech Stack:** NestJS microservice, TypeORM/PostgreSQL, Angular owner console, Nx/Jest, gateway request forwarding.

---

### Task 1: Persist and expose one aggregate revision

**Files:**

- Modify: `apps/app-configurator/src/configurations/entities/app-configuration.entity.ts`
- Modify: `libs/app-config-models/src/lib/app-configuration.model.ts`
- Create: generated file under `apps/app-configurator/migrations/`
- Test: `apps/app-configurator/src/app/configurations.service.spec.ts`

1. Write tests showing a created configuration begins at revision `1`, and a mutation returns the incremented revision.
2. Run the focused Nx Jest target and confirm the tests fail because the field and contract do not exist.
3. Add `revision` to the entity and shared owner response/DTO contract. Add `expectedRevision` to update, publish, and rollback DTOs.
4. Generate the migration with `app-configurator:typeorm:migration:generate`; inspect its SQL and keep the generated timestamp/class unchanged.
5. Rerun focused tests and typecheck/build the affected projects.

### Task 2: Make owner mutations conflict-safe and auditable

**Files:**

- Modify: `apps/app-configurator/src/app/configurations.service.ts`
- Test: `apps/app-configurator/src/app/configurations.service.spec.ts`

1. Add failing tests for stale update, stale publish, and stale rollback; each must produce Nest `ConflictException` and preserve the current aggregate.
2. Add failing tests verifying publish and rollback history contain `releasedByUserId`, `releasedByProfileId`, and `appScope` from the trusted request context.
3. Implement a single owner-scoped conditional persistence helper that updates only when `{ id, owner context, revision: expectedRevision }` matches, increments revision, and maps zero affected rows to `ConflictException`.
4. Use the helper for update, publish, and rollback; omit `expectedRevision` only for backwards-compatible noninteractive/internal callers, while all owner-console calls provide it.
5. Rerun focused service tests.

### Task 3: Keep the gateway contract and owner recovery UX aligned

**Files:**

- Modify: `apps/gateway/src/controllers/app-config/app-config.controller.ts` only if conflict mapping needs explicit handling
- Modify: `apps/owner-console/src/app/components/app-config-designer/app-config-designer.component.ts`
- Modify: `apps/owner-console/src/app/components/theme-management.component.ts`
- Test: corresponding `*.spec.ts` files

1. Write failing component tests that publish, rollback, and save with the currently loaded `revision`.
2. On a `409` conflict, retain unsaved data, show a clear refresh/retry message, and reload only when the owner chooses to retry; never hide or auto-discard draft work.
3. Confirm gateway request DTO forwarding retains the precondition and protected routes remain guarded.
4. Rerun the smallest owner-console and gateway test targets.

### Task 4: Verify release-state behavior and update the program tracker

**Files:**

- Modify: `docs/reports/configurable-platform-program/index.html`
- Test: app-configurator, owner-console, gateway, and migration validation targets

1. Run the service and owner-console focused tests, then affected Nx builds/tests with `NX_DAEMON=false NX_ISOLATE_PLUGINS=false`.
2. Generate/review the migration, apply it to a fresh database, and run `pnpm run validate:typeorm-migrations`.
3. Run the app-configurator/business-site release-flow E2E that exercises publish then rollback against the stack when available.
4. Record evidence and any residual E2E gap in Slice 6; mark it complete only after conflict, audit, and rollback proof are green.

# Canonical Workspace Identity Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Establish a dedicated Workspace service that resolves a canonical workspace identity for existing business sites and communities without moving product records, membership, or authorization ownership out of their current services.

**Architecture:** A new Workspace service owns only canonical identity records: stable UUID, kind, slug, display name, app scope, owner identities, lifecycle status, and an opaque source reference to the business-site configuration or social community. Business/store and social remain the source of their product records; permissions remains the source of role and permission decisions. The gateway calls the Workspace resolver only on opt-in routes and enriches downstream calls with an additive `workspaceContext`; Slice 16 will make workspace context mandatory for authorization-sensitive routes.

**Tech Stack:** NestJS/TCP microservice, TypeORM/PostgreSQL migrations, Nx, shared TypeScript contracts, gateway controller/decorator tests, Jest/Supertest.

---

## Scope decisions

- New service name: `workspace` (dedicated Nest microservice with its own database/schema).
- Initial workspace kinds: `business-site` and `community`.
- Canonical slug uniqueness: unique across `(kind, slug)`, not globally across unrelated kinds.
- Source reference: `{ sourceService, sourceId }` is opaque to Workspace; no business config JSON or community membership is copied.
- Owner identities: `ownerUserId` and `ownerProfileId` are stored for resolution/display only. They are not a replacement for live authorization checks.
- Lifecycle values: `draft`, `active`, `suspended`, `archived`. A product-specific `published` flag stays in its owning service.
- Membership, invitations, moderation delegation, and role target enforcement are deferred to Slices 16–18.

### Task 1: Create shared workspace contracts and pure resolver rules

**Files:**

- Create: `libs/models/src/lib/libs/workspaces/workspace.dto.ts`
- Create: `libs/models/src/lib/libs/workspaces/workspace-context.dto.ts`
- Create: `libs/models/src/lib/libs/workspaces/index.ts`
- Modify: `libs/models/src/index.ts`
- Create: `libs/constants/src/lib/libs/workspace.ts`
- Modify: `libs/constants/src/index.ts`
- Test: `libs/models/src/lib/libs/workspaces/workspace.dto.spec.ts`

**Step 1: Write failing contract tests**

Cover valid workspace kinds/lifecycle values and verify a resolver response cannot omit `workspaceId`, `kind`, `slug`, `appScope`, `ownerUserId`, `ownerProfileId`, `status`, or source reference.

**Step 2: Run the focused test to verify it fails**

Run the owning library’s Nx test target with `NX_DAEMON=false`, `NX_ISOLATE_PLUGINS=false`, and `NX_SKIP_NX_CACHE=true`.

**Step 3: Implement minimal types and command constants**

Define `WorkspaceKind`, `WorkspaceStatus`, `WorkspaceSource`, `ResolvedWorkspace`, `ResolveWorkspaceRequest`, and the `WorkspaceCommands` pattern. Keep the contracts transport-neutral and avoid importing TypeORM, NestJS, store, or social code.

**Step 4: Run focused tests to green**

Verify type/fixture tests pass and ensure the barrel exports are intentional.

### Task 2: Scaffold and persist the dedicated Workspace service

**Files:**

- Create: `apps/workspace/**` via the Nx Nest generator
- Create: `apps/workspace/src/workspaces/entities/workspace.entity.ts`
- Create: `apps/workspace/src/workspaces/workspaces.service.ts`
- Create: `apps/workspace/src/workspaces/workspaces.controller.ts`
- Create: `apps/workspace/src/workspaces/workspaces.module.ts`
- Generate: `apps/workspace/migrations/<generated>-create-workspaces.ts`
- Test: `apps/workspace/src/workspaces/workspaces.service.spec.ts`
- Test: `apps/workspace/src/workspaces/workspaces.controller.spec.ts`

**Step 1: Invoke the Nx generator skill before scaffolding**

Use the workspace’s Nx generator discovery; do not hand-create the app shell.

**Step 2: Write failing service tests**

Test that a workspace can be registered idempotently for one source reference, resolves by `(kind, slug)`, rejects a duplicate slug in the same kind, and returns no result for a missing/suspended workspace when `requireActive` is requested.

**Step 3: Run service tests red**

Run the workspace service Nx test target. Confirm failure is from missing resolver behavior, not dependency wiring.

**Step 4: Implement entity and service behavior**

Use a UUID primary key, unique `(kind, slug)`, unique `(sourceService, sourceId)`, owner IDs, app scope, status, timestamps, and an optional display name. Implement explicit idempotent registration and resolver queries; never accept owner IDs from a browser-facing resolver request.

**Step 5: Generate the TypeORM migration**

Use the Workspace service’s `typeorm:migration:generate` Nx target. Review generated SQL, run against a fresh database, and validate migrations through `pnpm run validate:typeorm-migrations` before merge.

**Step 6: Run service/controller tests green**

Verify known, missing, suspended, duplicate, and source-idempotent cases.

### Task 3: Backfill and register existing business-site and community sources

**Files:**

- Create: `apps/workspace/src/workspaces/workspace-source-registration.service.ts`
- Modify: `apps/store/src/trainer-config/trainer-config.service.ts`
- Modify: `apps/social/src/app/services/community.service.ts` or the existing community creation owner
- Modify: `libs/constants/src/lib/libs/trainer.ts`
- Create or modify: source registration command constants and DTOs
- Test: `apps/store/src/trainer-config/trainer-config.service.spec.ts`
- Test: `apps/social/src/app/services/community.service.spec.ts`
- Test: `apps/workspace/src/workspaces/workspace-source-registration.service.spec.ts`

**Step 1: Write failing source-registration tests**

Business registration must derive slug, app scope, and owner identities from the existing trainer-site config—not client input. Community registration must use `Community.id`, slug, creator identity, and its app scope. Repeat registration must keep the same workspace ID.

**Step 2: Run tests red**

Run the smallest owning-service and workspace test targets.

**Step 3: Implement opt-in registration commands**

After a business config or community is created/claimed, publish/register its canonical identity through the Workspace command. Keep failures observable and retry-safe; do not block public reads on a backfill retry.

**Step 4: Provide a one-time safe backfill command**

Implement a bounded administrative command that enumerates existing business configs and communities, registers them idempotently, and reports conflicts (same kind/slug with different sources) without auto-merging. This is a data backfill exception: document reversible behavior and use the owning TypeORM migration only for schema changes.

**Step 5: Run source tests green**

Confirm no source record payload or membership collection is copied into Workspace.

### Task 4: Add gateway resolver and additive request context

**Files:**

- Create: `apps/gateway/src/workspace/workspace-context.resolver.ts`
- Create: `apps/gateway/src/decorators/workspace-context.decorator.ts`
- Modify: `apps/gateway/src/app/gateway-service-providers.ts`
- Modify: `apps/gateway/src/controllers/trainer/trainer.controller.ts`
- Modify: `apps/gateway/src/controllers/social/community/community.controller.ts`
- Test: `apps/gateway/src/workspace/workspace-context.resolver.spec.ts`
- Test: `apps/gateway/src/controllers/trainer/trainer.controller.spec.ts`
- Test: `apps/gateway/src/controllers/social/community/community.controller.spec.ts`

**Step 1: Write failing resolver tests**

Verify resolver behavior for a known business slug/community slug, unknown slug, mismatched kind, and a client-supplied owner/profile ID. The latter must be ignored; returned owner context must come from Workspace.

**Step 2: Run tests red**

Run the focused gateway resolver test target.

**Step 3: Implement additive resolver behavior**

Resolve from an explicit route/query slug plus a declared kind. Preserve `@AppScope`, `@FinanceTenantId`, `@PermissionTarget`, and `PermissionsGuard` behavior. Enrich only migrated store/social RPC payloads with `workspaceContext`; do not infer permission `targetId` from workspace ID.

**Step 4: Run gateway tests green**

Confirm existing slug-owner comparison and accepted-client logic still execute after context resolution.

### Task 5: Compose, verify, and close out the slice

**Files:**

- Modify: deployment registry/configuration containing gateway and workspace service closure
- Modify: `docs/reports/configurable-platform-program/index.html`
- Test: minimal composed gateway/workspace integration test or checked-in E2E target

1. Add Workspace only to the smallest development and E2E composition that exercises resolver calls; do not restart unrelated services.
2. Verify command registration and gateway availability so resolver failures are not hidden as generic 500 responses.
3. Run fresh focused model, workspace, store, social, and gateway tests through Nx; run the new service migration against a fresh database and `pnpm run validate:typeorm-migrations`.
4. Run a composed known-slug/unknown-slug gateway test for business and community.
5. Run `git diff --check`.
6. Update Slice 14 with evidence and residual risk. Mark it complete only when newly migrated APIs receive a canonical resolver result, browser inputs cannot supply ownership, and product records remain owned by their original services.

## Explicitly deferred

- Mandatory workspace context on every legacy API and socket event (Slice 16).
- Role assignment uniqueness change to support multiple target-scoped memberships (Slice 16).
- Registration/claim transaction, verification, and owner role bootstrap (Slice 15).
- Workspace membership/invite state machine (Slice 17).
- A public directory policy or any browser API that exposes non-public workspace records.

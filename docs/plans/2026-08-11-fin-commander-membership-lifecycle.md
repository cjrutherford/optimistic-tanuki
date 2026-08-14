# Fin Commander membership lifecycle implementation plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let an entity owner add, change, and remove an existing Fin Commander member, and prove owner/member/non-member isolation in browser E2E.

**Architecture:** Keep the Finance service as the authorization source of truth: an active membership grants scoped access and an owner alone manages memberships. Gateway adds authenticated owner-only HTTP endpoints and resolves selected Fin Commander profiles without exposing arbitrary user records. Fin Commander adds an entity-members page using the shared Finance client; a two-user Playwright suite proves the server boundary, not just client visibility.

**Tech Stack:** Angular standalone components/signals, NestJS gateway and Finance microservice, TypeORM, shared models/constants, Jest, Playwright, Nx.

---

## Scope and decision

- This slice manages **existing, searchable Fin Commander profiles**. It does not send email invitations or create unregistered users; that needs a separate invitation/token/notification domain.
- Roles are `finance_admin` and `finance_member`. Owners cannot be removed or demoted through the member endpoint.
- The owner selects an existing profile by name. Profile search is limited to the active app scope and excludes existing members.

### Task 1: Define contracts and command boundaries

**Files:**

- Modify: `libs/models/src/lib/libs/finance/finance-tenant.dto.ts`
- Modify: `libs/constants/src/lib/libs/finance.ts`
- Test: `libs/models/src/lib/libs/finance/finance-tenant.dto.spec.ts`

1. Write DTO validation tests for create, role update, and remove-member payloads.
2. Add `CreateFinanceTenantMemberDto` and `UpdateFinanceTenantMemberRoleDto`; constrain roles to the two supported values.
3. Add Finance tenant commands for create, update role, and deactivate membership.
4. Run the focused models test through Nx.

### Task 2: Enforce owner-only lifecycle in Finance

**Files:**

- Modify: `apps/finance/src/app/services/finance-tenant.service.ts`
- Modify: `apps/finance/src/app/services/finance-tenant.service.spec.ts`
- Modify: `apps/finance/src/app/app.controller.ts`
- Modify: `apps/finance/src/app/app.controller.spec.ts`

1. Write failing service tests for owner add, duplicate prevention, role update, removal, member-as-manager denial, and owner self-protection.
2. Implement one ownership assertion used by every mutation; do not use client-provided role claims.
3. Add message handlers that resolve the caller scope before invoking the service.
4. Run Finance focused tests, then its full Nx test target.

### Task 3: Add gateway and scoped profile search APIs

**Files:**

- Modify: `apps/gateway/src/controllers/finance/finance.controller.ts`
- Modify: `apps/gateway/src/controllers/finance/finance.controller.spec.ts`
- Modify: `apps/gateway/src/controllers/profile/profile.controller.ts`
- Modify: `apps/gateway/src/controllers/profile/profile.controller.spec.ts`
- Modify: `apps/profile/src/app/profile.service.ts`
- Modify: `apps/profile/src/app/profile.service.test.ts`

1. Write gateway tests proving only the owner can call member mutations and profile results are app-scope limited.
2. Add protected member create/update/delete endpoints with the active finance-tenant header propagated to Finance.
3. Add a bounded profile-search endpoint for entity membership selection; return only profile id, display name, and avatar.
4. Run focused gateway/profile tests, then lint the affected projects.

### Task 4: Expose lifecycle operations in Fin Commander

**Files:**

- Modify: `libs/finance-ui/src/lib/finance-ui/services/finance.service.ts`
- Modify: `apps/fin-commander/src/app/app.routes.ts`
- Create: `apps/fin-commander/src/app/pages/entity-members/entity-members-page.component.ts`
- Create: `apps/fin-commander/src/app/pages/entity-members/entity-members-page.component.spec.ts`
- Modify: `apps/fin-commander/src/app/pages/tenant-shell/tenant-shell.component.ts`

1. Write component tests for owner controls, member read-only state, add/update/remove actions, and API error messages.
2. Add typed Finance client methods; every call carries the active tenant via the existing interceptor/context.
3. Add a tenant-scoped Entity members route and navigation entry. Use “Entity,” never “Account,” in new interface copy.
4. Run the component and client tests, then Fin Commander lint/build.

### Task 5: Prove two-user isolation end-to-end

**Files:**

- Modify: `apps/fin-commander-e2e/src/user-journey.spec.ts` or create `apps/fin-commander-e2e/src/entity-membership.spec.ts`
- Modify: `apps/fin-commander-e2e/src/fixtures/fin-commander.fixture.ts`
- Modify: `apps/fin-commander-e2e/src/support/db.ts` only if deterministic second-user setup is needed

1. Add independent owner, invited-member, and non-member browser contexts.
2. Prove owner adds member; member sees the shared entity and its persisted plan; non-member receives no entity in the selector and direct tenant route is denied.
3. Prove owner removal immediately removes the member’s access after refresh.
4. Run the smallest new E2E test against the live Docker stack, then the full `fin-commander-e2e` Nx target with its checked-in live-stack flags.

### Task 6: Report and delivery verification

**Files:**

- Modify: `docs/audits/2026-08-11-fin-commander-scorecard.md`
- Modify: `docs/audits/fin-commander-scorecard-report/index.html`

1. Record before/after ownership, access, and E2E evidence in the Next slice artifact tab.
2. Run affected test, lint, build, and E2E targets with `NX_DAEMON=false NX_ISOLATE_PLUGINS=false`.
3. Run fresh browser owner/member/non-member checks and publish the final artifact state.

## Acceptance criteria

- Only an entity owner can list and mutate entity membership.
- An owner can add an existing Fin Commander profile, change its role, and remove it; duplicate memberships are rejected.
- A member can select the shared entity and access persisted plans; a non-member cannot discover or directly load it.
- Removing a member revokes access on the next authenticated request.
- The completed-work artifact contains the exact before/after E2E evidence and remaining limitations.

# User-Facing Domain 5 Completion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Raise the remaining user-facing domains toward `5` across security, appscope isolation, owner/user isolation, SOLID adherence, owner-console integration, and implementation completeness.

**Architecture:** Continue the same pattern used in the profile/community and business-site/store work: tighten server-side policy first, then make owner-console workflows explicit, then add request-level and denial-path tests that prove the boundary. Prefer shared policy helpers over duplicated per-screen logic, and keep store/business-site/social/forum boundaries explicit instead of merging domains.

**Tech Stack:** NestJS gateway/controllers/guards, Angular owner-console/client-interface, Nx workspace, Jest, existing permission and business-data-access libraries.

---

### Task 1: Shared Catalog Readiness Policy

**Files:**

- Create: `libs/business-data-access/src/lib/catalog-readiness.ts`
- Modify: `libs/business-data-access/src/index.ts`
- Modify: `apps/gateway/src/controllers/trainer/trainer.controller.ts`
- Modify: `apps/owner-console/src/app/components/business-site-catalog-management.component.ts`
- Test: `libs/business-data-access/src/lib/catalog-readiness.spec.ts`

**Step 1: Write the failing test**

```ts
describe('getStoreCatalogReadinessIssues', () => {
  it('flags missing active services, blank descriptions, and zero prices', () => {
    expect(getStoreCatalogReadinessIssues([{ id: 'svc-1', type: 'service', active: true, description: '', price: 0 }] as any)).toEqual(['At least one active store service product is required for store mode.', 'Every store service product should have a public-facing description.', 'Every store service product should have a price greater than zero.']);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/jest -c libs/business-data-access/jest.config.ts libs/business-data-access/src/lib/catalog-readiness.spec.ts --runInBand`

Expected: FAIL because the helper does not exist yet.

**Step 3: Write minimal implementation**

Create a shared helper that:

- filters to active `service` products
- returns the same readiness issue strings already surfaced in owner-console
- exposes a `isStoreCatalogPublishReady(products)` convenience wrapper

**Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/jest -c libs/business-data-access/jest.config.ts libs/business-data-access/src/lib/catalog-readiness.spec.ts --runInBand`

Expected: PASS

**Step 5: Commit**

```bash
git add libs/business-data-access/src/lib/catalog-readiness.ts libs/business-data-access/src/lib/catalog-readiness.spec.ts libs/business-data-access/src/index.ts apps/gateway/src/controllers/trainer/trainer.controller.ts apps/owner-console/src/app/components/business-site-catalog-management.component.ts
git commit -m "refactor: share store catalog readiness policy"
```

### Task 2: Cross-Scope Permission Hardening For Remaining Commerce Mutations

**Files:**

- Modify: `apps/gateway/src/controllers/trainer/trainer.controller.ts`
- Modify: `apps/gateway/src/guards/permissions.guard.spec.ts`
- Modify: `apps/owner-console/src/app/owner-console-mutation-matrix.ts`
- Test: `apps/gateway/src/controllers/trainer/trainer.controller.spec.ts`

**Step 1: Write the failing test**

Add a guard/spec case proving each business-site governance mutation is evaluated in `business-site` scope and not accidentally granted by unrelated scopes.

**Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/jest -c apps/gateway/jest.config.ts apps/gateway/src/guards/permissions.guard.spec.ts --runInBand`

Expected: FAIL for the new cross-scope case.

**Step 3: Write minimal implementation**

Ensure the mutation metadata and guard assumptions stay explicit for:

- `business-site.catalog.update`
- future business-site governance mutations added alongside catalog source

If any mutation still inherits generic assumptions, narrow it now.

**Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/jest -c apps/gateway/jest.config.ts apps/gateway/src/guards/permissions.guard.spec.ts --runInBand`

Expected: PASS

**Step 5: Commit**

```bash
git add apps/gateway/src/controllers/trainer/trainer.controller.ts apps/gateway/src/guards/permissions.guard.spec.ts apps/owner-console/src/app/owner-console-mutation-matrix.ts apps/gateway/src/controllers/trainer/trainer.controller.spec.ts
git commit -m "test: harden business-site commerce scope boundaries"
```

### Task 3: Forum And Social Owner Console Integration Pass

**Files:**

- Modify: `apps/owner-console/src/app/operator-workspaces.ts`
- Modify: `apps/owner-console/src/app/app.routes.ts`
- Modify: `apps/owner-console/src/app/owner-console-mutation-matrix.ts`
- Create: `apps/owner-console/src/app/components/social-governance.component.ts`
- Create: `apps/owner-console/src/app/components/forum-governance.component.ts`
- Test: `apps/owner-console/src/app/app.routes.spec.ts`

**Step 1: Write the failing test**

Add route/navigation expectations for social and forum governance surfaces in owner-console.

**Step 2: Run test to verify it fails**

Run: `./node_modules/.bin/jest -c apps/owner-console/jest.config.ts apps/owner-console/src/app/app.routes.spec.ts --runInBand`

Expected: FAIL because the routes and workspace entries do not exist yet.

**Step 3: Write minimal implementation**

Add explicit owner-console governance pages that:

- summarize moderation and isolation expectations for `social`
- summarize moderation and isolation expectations for `forum`
- link to permission-sensitive operations rather than generic docs-only placeholders

Do not overbuild. A real governance shell with state summary, route ownership, and mutation matrix linkage is enough for this pass.

**Step 4: Run test to verify it passes**

Run: `./node_modules/.bin/jest -c apps/owner-console/jest.config.ts apps/owner-console/src/app/app.routes.spec.ts --runInBand`

Expected: PASS

**Step 5: Commit**

```bash
git add apps/owner-console/src/app/operator-workspaces.ts apps/owner-console/src/app/app.routes.ts apps/owner-console/src/app/owner-console-mutation-matrix.ts apps/owner-console/src/app/components/social-governance.component.ts apps/owner-console/src/app/components/forum-governance.component.ts apps/owner-console/src/app/app.routes.spec.ts
git commit -m "feat: add owner-console social and forum governance shells"
```

### Task 4: Social / Forum Isolation And Denial Coverage

**Files:**

- Modify: `apps/gateway/src/controllers/social/**`
- Modify: `apps/gateway/src/guards/permissions.guard.spec.ts`
- Modify: `apps/client-interface/src/app/components/social/**`
- Test: `apps/gateway/src/controllers/social/**/*.spec.ts`
- Test: `apps/client-interface/src/app/components/**/*.spec.ts`

**Step 1: Write the failing test**

Pick one mutation each from social and forum and add:

- a denial-path test for missing permission
- a scope-mismatch test
- a user/owner isolation test when the acting profile differs from the governed resource

**Step 2: Run test to verify it fails**

Run the narrowest relevant Jest targets for the touched controller/component specs.

Expected: FAIL on the new isolation assertions.

**Step 3: Write minimal implementation**

Move any implicit ownership assumptions into explicit guards/helpers and make the client surfaces consume the resulting error states cleanly.

**Step 4: Run test to verify it passes**

Run the same narrow Jest targets again.

Expected: PASS

**Step 5: Commit**

```bash
git add apps/gateway/src/controllers/social apps/gateway/src/guards/permissions.guard.spec.ts apps/client-interface/src/app/components/social
git commit -m "test: enforce social and forum isolation boundaries"
```

### Task 5: Messaging / Notifications / Search / Privacy Boundary Pass

**Files:**

- Modify: `libs/notification-ui/**`
- Modify: `libs/search-ui/**`
- Modify: `apps/gateway/src/controllers/social/notification/**`
- Modify: `apps/gateway/src/controllers/social/**`
- Test: affected Jest specs under `libs/notification-ui`, `libs/search-ui`, and `apps/gateway/src/controllers/social`

**Step 1: Write the failing test**

Add one failing spec per domain seam:

- notifications only read/write the authenticated profile stream
- search history is isolated by acting profile
- privacy state cannot be toggled across profile boundaries

**Step 2: Run test to verify it fails**

Run only the affected specs.

Expected: FAIL on the new profile-isolation assertions.

**Step 3: Write minimal implementation**

Centralize profile scoping rather than spreading ad hoc filters across UI services and controllers.

**Step 4: Run test to verify it passes**

Run the same targeted specs again.

Expected: PASS

**Step 5: Commit**

```bash
git add libs/notification-ui libs/search-ui apps/gateway/src/controllers/social
git commit -m "fix: tighten profile isolation across notifications search and privacy"
```

### Task 6: Final User-Facing Score Re-Audit

**Files:**

- Modify: `docs/plans/2026-05-12-user-facing-domain-5-completion.md`
- Create: `docs/plans/2026-05-12-user-facing-domain-scorecard-refresh.md`

**Step 1: Write the failing test**

No code test. Instead, define the scorecard criteria in the refresh doc before reassessing domains.

**Step 2: Verify the evidence set**

Collect links to:

- gateway request/denial tests
- owner-console governance routes
- domain-specific UI isolation tests
- mutation matrix rows
- Community Ops evidence refresh in `docs/plans/2026-05-12-community-ops-domain-refresh.md`

**Step 3: Write minimal implementation**

Refresh the scorecard with:

- updated domain ratings
- remaining non-5 blockers per domain
- direct references to the tests and code that justify each score

**Step 4: Verify completeness**

Manually confirm every `5` is backed by implementation plus tests, not just docs.

**Task 6 Outcome (2026-05-12):**

- Re-audit completed in `docs/plans/2026-05-12-user-facing-domain-scorecard-refresh.md`.
- Result: no user-facing domain currently justifies a `5` yet.
- Refreshed ratings:
  - Governance: `4/5`
  - Experience: `4/5`
  - Commerce: `4/5`
  - Community Ops: `4/5`
- Evidence used for the re-audit includes:
  - Commerce request/permission hardening: `apps/gateway/src/controllers/trainer/trainer.controller.spec.ts`, `apps/gateway/src/guards/permissions.guard.spec.ts`
  - Owner-console governance routes: `apps/owner-console/src/app/app.routes.spec.ts`, `apps/owner-console/src/app/operator-workspaces.ts`
  - Social/forum/message/privacy isolation: `apps/gateway/src/controllers/social/social.controller.test.ts`, `apps/gateway/src/controllers/forum/forum.controller.spec.ts`, `apps/gateway/src/controllers/social/notification/notification.controller.spec.ts`, `apps/gateway/src/controllers/profile/profile.controller.spec.ts`, `apps/client-interface/src/app/components/social/feed.component.spec.ts`, `libs/notification-ui/src/lib/notification.service.spec.ts`, `libs/search-ui/src/lib/search.service.spec.ts`
  - Community Ops evidence refresh: `docs/plans/2026-05-12-community-ops-domain-refresh.md`
  - Mutation matrix source of truth: `apps/owner-console/src/app/owner-console-mutation-matrix.ts`

**Re-Audit Notes:**

- Governance remains below `5` because role-permission add/remove is still marked `partial` in the mutation matrix.
- Experience remains below `5` because theme persistence is still a proof-of-concept without backend mutation support.
- Commerce remains below `5` because resource CRUD is still `missing` in owner-console and the planned shared catalog-readiness helper is not present in `libs/business-data-access/src/lib/`.
- Community Ops remains below `5` because social/forum governance is still represented by `partial` owner-console shells rather than routed moderation workflows.

**Step 5: Commit**

```bash
git add docs/plans/2026-05-12-user-facing-domain-5-completion.md docs/plans/2026-05-12-user-facing-domain-scorecard-refresh.md
git commit -m "docs: refresh user-facing domain scorecard plan"
```

Plan complete and saved to `docs/plans/2026-05-12-user-facing-domain-5-completion.md`. Two execution options:

1. Subagent-Driven (this session) - I dispatch fresh subagent per task, review between tasks, fast iteration
2. Parallel Session (separate) - Open new session with executing-plans, batch execution with checkpoints

Which approach?

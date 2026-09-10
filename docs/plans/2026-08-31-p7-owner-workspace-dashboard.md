# P7.1 Owner Workspace Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a protected, workspace-scoped owner dashboard to \`configurable-client\` that exposes authoritative identity, status, edit/author/preview/publish actions, and safe publishing feedback while preserving existing business-site and public entry points.

**Architecture:** Build a read-model/data-access facade over the existing authenticated workspace and app-configuration contracts; never authorize from client-provided IDs, profile IDs, or roles. Add \`/owner\` and \`/owner/workspace/:workspaceSlug\` to \`configurable-client\`, compose reusable feature links from the resolved workspace context, and keep business-site’s existing owner routes intact while adding regression coverage for its dashboard contract.

**Tech Stack:** Angular standalone components and router, HttpOnly cookie sessions, NestJS/Gateway app-config contracts, TypeScript, Jest, Playwright/Agent Browser, Nx, pnpm.

---

## Constraints and execution notes

- Work in the current checkout at \`/home/cjrutherford/workspace/optimistic-tanuki\`; this repository explicitly forbids creating or using a Git worktree.
- Use TDD: write the smallest failing test before each implementation change, then run the focused Nx target.
- Use only the existing authenticated session and server-resolved workspace/app context. A URL slug is navigation context, not authorization.
- Do not create a migration unless the existing release/publish contract is insufficient. If schema work is proven necessary, first run the owning service’s existing migrations against a fresh database, inspect generated SQL, invoke the Nx TypeORM target, and run \`pnpm run validate:typeorm-migrations\`; never hand-create a migration.
- Keep the accepted P5 contrast waiver unchanged. Do not alter the tracker during implementation until the final tracker task below.
- All Nx commands use \`NX_DAEMON=false NX_ISOLATE_PLUGINS=false\`.

## Turn-sized implementation tasks

### Task 1: Lock the P7.1 contract with failing model and data-access tests

**Files:**

- Create: \`libs/app-config-data-access/src/lib/owner-workspace-dashboard.model.ts\`
- Create: \`libs/app-config-data-access/src/lib/owner-workspace-dashboard.store.spec.ts\`
- Modify: \`libs/app-config-data-access/src/index.ts\`
- Test: \`libs/app-config-data-access/src/lib/workspace-discovery.store.spec.ts\`

Define a view model containing authoritative workspace identity, app identity/scope, membership role/status, \`canEdit\`, \`canPublish\`, revision, active state, release status, and safe workspace-scoped URLs. Include explicit \`loading\`, \`ready\`, \`empty\`, \`unavailable\`, and \`error\` states. P7 dashboard reads and owner actions are owner-only: admin, moderator, and member memberships are denied rather than shown a read-only dashboard. Write failing tests for that denial, release states mapping to draft/published/pending/rolled-back, and foreign or inactive workspace data being rejected rather than displayed.

Run:

\`\`\`bash
NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test app-config-data-access --runInBand --outputStyle=static
\`\`\`

Expected: FAIL because the dashboard model/store and capability mapping do not yet exist.

### Task 2: Implement the scoped dashboard data-access facade

**Files:**

- Create: \`libs/app-config-data-access/src/lib/owner-workspace-dashboard.store.ts\`
- Modify: \`libs/app-config-data-access/src/lib/workspace-discovery-api.service.ts\`
- Modify: \`libs/app-config-data-access/src/lib/app-config-data-access.ts\`
- Modify: \`libs/app-config-data-access/src/index.ts\`
- Test: \`libs/app-config-data-access/src/lib/owner-workspace-dashboard.store.spec.ts\`
- Test: \`libs/app-config-data-access/src/lib/workspace-discovery-api.service.spec.ts\`

Implement the minimum facade needed by the owner UI. Resolve owned workspaces through the existing discovery API, resolve configuration through the authenticated app-config API, combine only matching workspace/app IDs and scope, and expose commands for \`refresh\`, \`publish\`, and \`retry\`. Publish must return an observable/promise state transition and must not optimistically claim success. Add tests for owner visibility, foreign-slug rejection, non-owner publish denial, publish failure retaining the prior status, and publish success updating server-confirmed release status and revision.

Run:

\`\`\`bash
NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test app-config-data-access --runInBand --outputStyle=static
\`\`\`

Expected: PASS for the new facade and existing data-access tests.

### Task 3: Verify or narrowly complete the backend owner read/publish contract

**Files:**

- Inspect/modify only if required: \`apps/app-configurator/src/configurations/configurations.controller.ts\`
- Inspect/modify only if required: \`apps/app-configurator/src/app/configurations.service.ts\`
- Inspect/modify only if required: \`apps/app-configurator/src/configurations/app-config-context.contract.ts\`
- Test: \`apps/app-configurator/src/configurations/configurations.controller.spec.ts\`
- Test: \`apps/app-configurator/src/app/configurations.service.spec.ts\`

First write failing contract tests for authenticated owner-only read and publish, including workspace/app-scope matching, active owner membership, explicit denial for admin/moderator/member memberships, foreign workspace denial, and a response containing the resulting release/revision. Reuse existing \`resolveContext\`, \`get\`, and \`publish\` behavior when it already satisfies the contract. Add only the smallest DTO/guard/response change needed if a test proves the UI cannot obtain the read model or publish result. Do not weaken operator-wide endpoints or infer authorization from request-body owner fields.

Run:

\`\`\`bash
NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test app-configurator --runInBand --outputStyle=static
NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx build app-configurator --configuration=production
\`\`\`

Expected: focused contract tests and the production build pass. If no backend change is needed, record that conclusion in the implementation handoff and continue without a migration.

### Task 4: Add protected owner routes and the dashboard shell

**Files:**

- Modify: \`apps/configurable-client/src/app/app.routes.ts\`
- Create: \`apps/configurable-client/src/app/guards/owner-workspace.guard.ts\`
- Create: \`apps/configurable-client/src/app/components/owner-workspace-dashboard.component.ts\`
- Create: \`apps/configurable-client/src/app/components/owner-workspace-dashboard.component.scss\`
- Create: \`apps/configurable-client/src/app/components/owner-workspace-dashboard.component.spec.ts\`
- Modify: \`apps/configurable-client/src/app/app.routes.spec.ts\`
- Modify: \`apps/configurable-client/src/app/services/auth-session.service.ts\` only if route restoration requires a narrowly scoped contract fix

Add \`/owner\` as the authenticated owner entry and \`/owner/workspace/:workspaceSlug\` as the explicit scoped route. Preserve safe \`returnTo\` handling and redirect unauthenticated users to \`/login\`. The component must render workspace/app identity, role/status, draft/saved/published/pending/rolled-back status, primary edit/author/preview/publish actions, gated controls, loading/empty/unavailable/error/retry states, and no cross-workspace data during resolution.

Write component/router tests first for route protection, safe return intent, context identity, capability gating, and state rendering.

Run:

\`\`\`bash
NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test configurable-client --runInBand --outputStyle=static
\`\`\`

Expected: PASS for route and dashboard tests.

### Task 5: Add publishing confirmation, progress, success, and error UX

**Files:**

- Modify: \`apps/configurable-client/src/app/components/owner-workspace-dashboard.component.ts\`
- Modify: \`apps/configurable-client/src/app/components/owner-workspace-dashboard.component.scss\`
- Test: \`apps/configurable-client/src/app/components/owner-workspace-dashboard.component.spec.ts\`
- Test: \`libs/app-config-data-access/src/lib/owner-workspace-dashboard.store.spec.ts\`

Implement confirmation naming the selected workspace/app and revision before publish. During the request disable duplicate submission and show progress. On success show the server-confirmed published revision/time and refresh the public preview link. On error show a safe message, retain draft state, and provide retry without losing context. Test cancellation, double-click protection, success, failure, and stale-revision responses.

Run:

\`\`\`bash
NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test configurable-client --runInBand --outputStyle=static
NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test app-config-data-access --runInBand --outputStyle=static
\`\`\`

Expected: PASS with no optimistic published state on failure.

### Task 6: Wire edit, author, preview, and publish links without breaking entry points

**Files:**

- Modify: \`apps/configurable-client/src/app/components/owner-workspace-dashboard.component.ts\`
- Modify: \`apps/configurable-client/src/app/app.routes.ts\`
- Test: \`apps/configurable-client/src/app/components/owner-workspace-dashboard.component.spec.ts\`
- Regression test: \`libs/business-portal-ui/src/lib/business-owner-dashboard-page.component.spec.ts\`
- Regression test: \`apps/business-site/src/app/app.routes.spec.ts\`

Generate every action from resolved workspace context. Link editing to the existing configuration/editor surface, authoring to the appropriate store/blog/forum/social shell, preview to the scoped public app route, and publish to the confirmation action. Preserve business-site \`/owner\`, \`/owner/dashboard\`, \`/owner/site\`, and \`/sites/:siteSlug/owner/...\` routes and business metrics. Introduce a business-site adapter only where needed; do not replace its dashboard in P7.1.

Run:

\`\`\`bash
NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test business-portal-ui --runInBand --outputStyle=static
NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test business-site --runInBand --outputStyle=static
NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test configurable-client --runInBand --outputStyle=static
\`\`\`

Expected: all three suites pass and existing business owner entry points remain routable.

### Task 7: Add isolation and stateful browser proof with screenshots

**Files:**

- Modify: \`apps/configurable-client-e2e/src/example.spec.ts\`
- Modify: \`apps/configurable-client-e2e/playwright.config.ts\` only if screenshot/output configuration is missing
- Create/update evidence under: \`docs/reports/configurable-client-parity/evidence/p7/\`

Add browser coverage for signed-out redirect, owner dashboard identity, owner actions/status, publish confirmation/progress/success/error, member gating, foreign-workspace denial, and explicit empty/suspended/loading/API-error states.

Run against the live stack only after confirming expected app ports are available. Use the checked-in Nx e2e target and system Chrome channel. Every browser navigation and meaningful state assertion must capture a screenshot; record URLs, assertions, and fixture identities in the P7 evidence summary.

\`\`\`bash
NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx run configurable-client-e2e:e2e --configuration=ci
\`\`\`

Expected: the owner path reaches the dashboard, isolation never exposes foreign data, and screenshots exist for each required state. For an already-running Docker stack, use live-stack skip flags and do not tear down shared services.

### Task 8: Verify affected builds, update the tracker, and close P7.1

**Files:**

- Update only after implementation evidence exists: \`docs/reports/configurable-client-parity/index.html\`
- Add/update: \`docs/reports/configurable-client-parity/evidence/p7/progress.md\`
- Add/update: \`docs/reports/configurable-client-parity/evidence/p7/results.md\`

Run smallest affected checks first, then combined verification:

\`\`\`bash
NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test app-config-data-access --runInBand --outputStyle=static
NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test configurable-client --runInBand --outputStyle=static
NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test business-portal-ui --runInBand --outputStyle=static
NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test business-site --runInBand --outputStyle=static
NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx build configurable-client --configuration=production
NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx build app-configurator --configuration=production
NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx run configurable-client-e2e:e2e --configuration=ci
\`\`\`

Update the tracker with completed/blocked states, exact test/build/e2e evidence, screenshot paths, the accepted P5 contrast waiver, and any deferred limitation. Mark P7.1 complete only when owner publishing and cross-workspace denial are both proven; otherwise leave the precise failing acceptance item visible. Do not claim success from a build alone.

### Task 9: Final verification and handoff

Run:

\`\`\`bash
git diff --check
\`\`\`

Expected: no whitespace errors. Report touched apps/libs, verification results, evidence directory, and next slice. This plan-writing task changes only this plan file; it does not modify production code or the tracker.

# Configurable Platform Recovery Slices Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Re-establish a reproducible baseline, complete self-service governance, and prove Blogging as the first non-Business configurable runtime before building the central Configurator Workspace.

**Architecture:** Keep the Workspace service authoritative for identity, product services authoritative for their records, and the Gateway authoritative for browser-facing authorization. Each slice changes one contract or one owning product surface and closes with its smallest relevant Nx target. The Configurator Workspace remains downstream of governance and runtime proof; it composes and deep-links rather than owning product data.

**Tech Stack:** Nx, Angular, NestJS microservices, TypeORM, Jest, Playwright, Docker Compose.

---

## Operating rules

- A slice is one turn: target 30–60 minutes, one coherent code/test boundary, one reviewable outcome.
- Write a failing test before production code; run its narrowest Nx target before widening verification.
- Create schema migrations only through the owning service's `typeorm:migration:generate` target, after prior migrations are applied.
- Use `NX_DAEMON=false NX_ISOLATE_PLUGINS=false` for Nx verification.
- Luna is eligible only for independent work with disjoint files. Use it for reconnaissance, test inventory, an isolated contract test, or a separate app surface—not concurrent edits to shared models, Gateway context, or Compose files.
- Update the baseline audit and the original tracker after every closed slice; completion requires an evidence link and command outcome.

## Dependency map

```text
R0 baseline proof ─┬─ G17.1 lifecycle contract ─ G17.2 Social ─┐
                   └─ G17.3 Business client state ──────────────┤
                                                                  ├─ G18.1 moderation reference
                                                                  ├─ G18.2 Social moderation adapter
                                                                  └─ G18.3 Business approval adapter
                                                                            │
                                                                    G19.1 composed matrix → G19.2 adversarial journeys
                                                                            │
                                            P8.1 Blog feature shell → P8.2 public runtime → P8.3 parity E2E
                                                                            │
                                            C11.1 workspace discovery → C11.2 browser shell → C11.2.5 authoring shells → C11.3 deep links
                                                                            │
                                            C12.1 published policy fixture → C12.2 entry parity → P13 pilots
```

## Original change-set alignment

The recovery labels are execution ordering, not replacement scope. Every original tracker slice remains represented below. **Confidence** is the current baseline-audit classification; **next bounded increment** is the only work that may advance its state. A tracker “complete” badge is retained as historical implementation context, not promoted to verified evidence.

| Original slice | Original intent                         | Confidence | Recovery successor / next bounded increment                                                                          |
| -------------- | --------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------- |
| 0              | Platform contracts                      | Partial    | R0.1 prove the contract boundary and unknown-plugin behavior; repair only the first failing boundary.                |
| 1              | Plugin feature-shell standard           | Partial    | R0.1 inventory consumers, then P8.1 proves the standard with Blogging.                                               |
| 2              | Shared configurator data access         | Partial    | R0.1 reproduce trusted-context, stale-draft, and recovery tests.                                                     |
| 3              | Shared configurator editor              | Partial    | R0.1 reproduce shared-shell and dirty-draft evidence; defer hardening until a failure is recorded.                   |
| 4              | Business-site reference plugin          | Verified   | Preserve as reference; P8.1 must consume the same boundary without Business imports.                                 |
| 5              | Runtime parity                          | Partial    | R0.1 prove Business preview/public parity; P8.3 supplies the cross-plugin proof.                                     |
| 6              | Publish, preview, audit trust           | Partial    | R0.1 reproduce revision/recovery evidence; R0.3/24 proves the operational seed path.                                 |
| 7              | Media capability                        | Partial    | S7.1 inventory a portable media reference and its accessibility fields after R0.                                     |
| 8              | Second configurable plugin proof        | Unverified | P8.1 → P8.3, Blogging only.                                                                                          |
| 9              | Capability catalog and placement        | Verified   | Preserve catalog contract; C12.1 exercises it through a published-policy fixture.                                    |
| 10             | Product data-access adapters            | Verified   | Preserve Store/Blog adapters; P8 and C12 consume them without duplicating records.                                   |
| 11             | Configurator Workspace                  | Verified   | C11.1–C11.3 complete: owner-scoped discovery, browser shell, reusable authoring shells, and canonical product links. |
| 12             | Runtime composition and entry parity    | Verified   | C12.1–C12.2 complete: shared published-policy adapters and preserved direct-entry contracts.                         |
| 13             | Product capability pilots               | Unverified | P13.1 Blogging, then Forum, Store, and Social sequentially.                                                          |
| 14             | Workspace identity and tenant contract  | Verified   | Preserve as prerequisite; G19 actively attacks its isolation boundary.                                               |
| 15             | Registration, claim, owner bootstrap    | Verified   | Preserve as prerequisite; G19 verifies hostile/repair journeys.                                                      |
| 16             | Authorization and isolation enforcement | Verified   | Preserve as prerequisite; G17–G19 extend proof across lifecycle and browser paths.                                   |
| 17             | Membership, client, moderator lifecycle | Partial    | G17.1 → G17.4.                                                                                                       |
| 18             | Moderation control plane                | Partial    | G18.1 → G18.3.                                                                                                       |
| 19             | Self-service adversarial E2E            | Partial    | G19.1 → G19.2.                                                                                                       |
| 20             | Positioning and content model           | Unverified | M20.1 claims inventory, after G19 evidence exists.                                                                   |
| 21             | Business-site discovery landing         | Unverified | M21.1 public-directory policy and landing acceptance checks, after M20.1.                                            |
| 22             | Configurator Workspace public landing   | Unverified | M22.1 public landing only after C11 proves the browser host and entitlement model.                                   |
| 23             | Consentful funnel measurement           | Unverified | M23.1 allowlisted event taxonomy and indexing policy, after M21.1/M22.1.                                             |
| 24             | Compliant configurator seeding          | Partial    | R0.3 clean-database seed/release smoke using the standard runner.                                                    |

### R0.3: Clean deployment and seed smoke (original Slice 24)

**Outcome:** A clean database proves the standard operator-invoked seed runner, readiness behavior, and release flow; historical “complete” seeding status becomes verified only with this evidence.

**Likely files:**

- Modify only if the smoke exposes a defect: `scripts/run-seed.sh`, `scripts/validate-docker-bootstrap.mjs`, the owning Compose definition, and focused tests.

**Verification:** fresh database bootstrap; an explicit `APP_CONFIG_SEED_OWNER_USER_ID` / `APP_CONFIG_SEED_OWNER_PROFILE_ID` seed invocation; readiness and release-flow smoke; `pnpm run validate:typeorm-migrations`.

**Luna:** Yes for read-only Compose/seed inventory; no for the live bootstrap or a shared Compose repair.

## R0 — baseline proof batch

### R0.1: Reproducible evidence ledger

**Outcome:** A dated machine-readable ledger records command, project, source anchor, outcome, and scope for claims in slices 0–6, 14–16, and 24.

**Files:**

- Create: `docs/audits/2026-08-23-configurable-platform-baseline-evidence.md`
- Modify: `docs/audits/2026-08-23-configurable-platform-baseline.html`

**Verification:** Re-run the already-defined narrow tests for `configurable-plugin-contracts`, `app-config-models`, `business-presence-feature`, `app-config-data-access`, `app-configurator`, `workspace`, `gateway`, and migration validation. Record failure as a downgrade, not a repair-in-place.

**Luna:** Yes — split independent evidence inventory by Foundation, Workspace/Security, and Seeding. No implementation edits by parallel workers.

### R0.2: Completion-state reconciliation

**Outcome:** The original tracker and baseline audit agree on verified/partial/unverified state and link every “verified” claim to the ledger.

**Files:**

- Modify: `docs/reports/configurable-platform-program/index.html`
- Modify: `docs/audits/2026-08-23-configurable-platform-baseline.html`

**Verification:** `git diff --check`; served-artifact root and MagicDNS HTTP checks return 200/no-store.

**Luna:** No — both artifacts encode the same decision state.

## G17 — membership, client, and moderator lifecycle

### G17.1: Shared lifecycle vocabulary and transition tests

**Outcome:** One typed state vocabulary defines `pending`, `active`, `suspended`, and `revoked`, allowed transitions, actor requirements, idempotence, and audit event shape without moving domain records into Workspace.

**Likely files:**

- Create: `libs/models/src/lib/libs/workspaces/membership-lifecycle.ts`
- Create: `libs/models/src/lib/libs/workspaces/membership-lifecycle.spec.ts`
- Modify: `libs/models/src/lib/libs/workspaces/index.ts`

**Verification:** failing transition tests → `pnpm exec nx test models --runInBand` (or the resolved owning library target).

**Luna:** Yes — an isolated test/contract task after the exact model export location is confirmed.

### G17.2: Social membership enforcement

**Outcome:** Community join/approve/remove flows map to the shared states; suspension/revocation blocks scoped actions and emits an owner-visible audit event.

**Likely files:**

- Modify: `apps/social/src/entities/community-member.entity.ts`
- Modify: `apps/social/src/app/services/community.service.ts`
- Modify: `apps/social/src/app/services/community.service.spec.ts`
- Modify: `apps/gateway/src/controllers/social/community/community.controller.ts`
- Modify: `apps/gateway/src/controllers/social/community/community.controller.spec.ts`

**Verification:** Social service and Gateway controller tests; generate/apply a Social migration only if entity metadata changes.

**Status (2026-08-23):** Complete. Social maps membership status to the shared contract, enforces suspension/revocation, emits audit events, and exposes scoped Gateway forwarding. Fresh Social and Gateway tests passed.

**Luna:** Completed as an isolated adapter worker after G17.1; review and combined verification passed.

### G17.3: Business client lifecycle alignment

**Outcome:** Business client approval uses the same vocabulary, rejects cross-workspace transitions, and forces permission/session refresh semantics after a state change.

**Likely files:**

- Modify: `libs/business-data-access/src/lib/business-api.service.ts`
- Modify: `apps/business-site/src/app/client-auth.guard.ts`
- Modify: `apps/gateway/src/controllers/trainer/trainer.controller.ts`
- Modify: corresponding `*.spec.ts`

**Verification:** business-data-access + business-site targeted tests, then Gateway controller tests.

**Status (2026-08-23):** Complete. Business approval validates the owner profile before mutation and returns lifecycle/session-refresh metadata; fresh Business and Gateway trainer tests passed.

**Luna:** Completed in parallel with G17.2 after G17.1; review and combined verification passed.

### G17.4: Owner Console lifecycle affordance

**Outcome:** The existing community/client owner surface exposes a clear state, permitted next action, failure state, and audit reference; no new parallel management UI.

**Likely files:**

- Modify: `apps/owner-console/src/app/components/community-members.component.ts`
- Modify: `apps/owner-console/src/app/components/community-members.component.spec.ts`
- Modify: `apps/owner-console/src/app/components/operations-workspace.component.ts`

**Verification:** targeted Owner Console component tests and narrow browser flow.

**Luna:** No — should consume the final Gateway contract.

**Status (2026-08-23):** Complete. The Owner Console uses the scoped Gateway contract for lifecycle state/actions, failure feedback, and member audit history. Social persists audit history in the generated `1787511616787-add-community-membership-audit.ts` migration and enforces terminal revoked state plus appointed-manager protection server-side. Fresh Social tests and TypeORM migration validation passed.

**Current next action (2026-08-24):** G17–G19, P8, C11.1–C11.3, and C12.1–C12.2 are complete. Next is P13.1: run the Blogging product pilot through placement, direct-entry parity, denial, and E2E proof.

## G18 — moderation control plane

### G18.1: Shared moderation reference and decision contract

**Outcome:** Define a portable moderation case/reference, reason, decision, evidence pointer, actor, timestamp, appeal state, and retention policy—not a shared content table.

**Likely files:**

- Create: `libs/models/src/lib/libs/workspaces/moderation-case.ts`
- Create: `libs/models/src/lib/libs/workspaces/moderation-case.spec.ts`
- Modify: `libs/models/src/lib/libs/workspaces/index.ts`

**Verification:** model unit tests reject illegal decisions and foreign target references.

**Luna:** Yes — independent of G17.4 UI work after G17 contract state is stable.

**Status (2026-08-23):** Complete. Shared Models now defines a workspace-scoped moderation case/reference, reason, evidence pointer, decision, appeal, and retention vocabulary. Focused lifecycle tests reject foreign workspace references, duplicate decisions, and duplicate appeals. No product record, service persistence, or Gateway route was introduced.

### G18.2: Social report adapter

**Outcome:** Existing content reports map to the shared moderation decision vocabulary while Social retains post/comment enforcement.

**Likely files:**

- Modify: `apps/social/src/entities/content-report.entity.ts`
- Modify: `apps/social/src/app/services/privacy.service.ts`
- Modify: `apps/social/src/app/services/privacy.service.spec.ts`
- Modify: `apps/gateway/src/controllers/social/privacy/privacy.controller.ts`

**Verification:** Social unit tests and Gateway controller tests; generate Social migration only if metadata changes.

**Luna:** No — entity/schema work requires serialized migration ownership.

**Status (2026-08-23):** Complete. Social `ContentReport` now persists `appScope` and nullable `workspaceId`, mapping legacy reports to the explicit app-scoped Social lane and allowing workspace-enabled features to supply a tenant scope. The `1787514759914-add-content-report-scope.ts` migration was generated via the Social Nx target, reviewed, and applied locally. Social and Models suites plus migration validation passed.

### G18.3: Business approval adapter

**Outcome:** Business client approval/rejection produces the same decision/audit vocabulary while retaining business-owned client data and permissions.

**Likely files:**

- Modify: `apps/gateway/src/controllers/trainer/trainer.controller.ts`
- Modify: `libs/business-data-access/src/lib/business-api.service.ts`
- Modify: matching specs

**Verification:** business-data-access and Gateway targeted tests.

**Luna:** Yes, after G18.1 and in parallel with the non-schema portions of G18.2.

**Status (2026-08-23):** Complete. The Gateway now owner-scopes both approval and rejection before mutating the Business lead record, and returns the shared `approve`/`reject` moderation-decision vocabulary with lifecycle and session-refresh metadata. `business-data-access` exposes the typed rejection operation. Focused and full Gateway, business-data-access, and Models Nx suites passed.

### G18.4: Reconcile delegated manager authority

**Outcome:** A Gateway manager appointment changes the authoritative Social community-manager state as well as the platform permission grant, so moderation authority cannot be present in one enforcement plane and absent in the other.

**Boundary:** Gateway community controller, Social manager command/handler, and a focused contract test. No G19 fixture work begins in this slice.

**Verification:** Gateway controller and Social service tests prove appointment, scoped denial, and persisted-manager alignment.

**Status (2026-08-23):** Complete. Gateway now resolves an approved member to its immutable user/profile pair, grants the scoped role, then forwards `APPOINT_MANAGER` to Social. Revocation clears both planes. If a Social mutation fails, Gateway compensates the preceding role mutation; focused and full Gateway/Social Nx suites passed. Social-service coverage proves the authoritative `managerId` and `managerProfileId` persistence.

### G18.5: Unify Owner Console manager authority

**Outcome:** The active Owner Console `/api/communities/:id/manager` routes perform the same role and Social manager mutation as the Social route, without trusting a submitted user ID.

**Boundary:** Gateway `CommunitiesController` only; retain the Owner Console HTTP contract.

**Verification:** Gateway controller contract tests for appointment and revocation, the full Gateway suite, and the Owner Console community-members component test.

**Status (2026-08-23):** Complete. Appointment resolves the submitted profile against Social’s approved community members, then assigns `community_manager` and persists the Social manager pair. Revocation derives the current manager from Social before removing the scoped role and manager record, restoring the role if Social revocation fails. The full Gateway suite and focused Owner Console component suite passed.

### G18.6: Server-derived Social report scope

**Outcome:** A Social report for workspace-enabled content persists the canonical workspace scope derived from its target resource, while app-scoped Social features remain explicitly unscoped.

**Boundary:** Social report command/target resolver and Gateway privacy report route. Do not accept a browser-supplied workspace ID as authority.

**Verification:** Gateway and Social tests prove a workspace report receives the resolved workspace ID, app-scoped report remains null, and a forged or unknown target cannot select another workspace.

**Status (2026-08-23):** Complete. Gateway resolves community, post, and comment targets through Social, then resolves an active workspace by the community’s immutable Social source before forwarding the report. Profile/message reports remain explicitly app-scoped. Social’s message handler now preserves `appScope` and `workspaceId` at the privacy-service persistence boundary. Focused and full Gateway/Social Nx suites passed.

## G19 — adversarial self-service proof

### G19.1: Minimal composed E2E matrix fixture

**Outcome:** A documented Compose/E2E fixture provides owner, active member/client, moderator, anonymous visitor, and a second tenant without borrowing production seed identity.

**Likely files:**

- Modify: `e2e/docker-compose.e2e-stack.yaml`
- Modify: `scripts/e2e-environment-manifest.mjs`
- Create: `apps/gateway-e2e/src/gateway/workspace-governance.spec.ts`

**Verification:** manifest validation and the smallest Gateway E2E target against the fixture.

**Luna:** No — shared Compose and seed state must remain serialized.

**Status (2026-08-24):** Complete. The shared E2E Compose stack and Gateway manifest include the Workspace microservice (TCP 3024), required by community workspace registration, strict context resolution, and server-derived report scope. `workspace-governance.spec.ts` provisions timestamped two-owner/two-community identities, an active member, delegated moderator, and anonymous client without borrowing seed identity. The focused Gateway unit regression and the live-stack `gateway-e2e` fixture pass: both communities are created, their child workspaces are provisioned, members join, and the delegated manager is appointed. Community owner and manager roles resolve from the canonical `community` product scope and are assigned into the generated child scope.

**Operational follow-up (not a G19.1 failure):** the lead-tracker ledger drift is repaired: all 21 migrations now match their CLI-generated identities, the existing local database has no pending migrations, and the full chain passed against a temporary empty database. Fresh dev-runtime image builds remain blocked by host Docker DNS (`registry.npmjs.org` resolves as `EAI_AGAIN` on the default build network); this needs a host-level Docker daemon DNS repair before rebuilding the full stack.

### G19.2: Cross-workspace denial journeys

**Outcome:** Browser/API scenarios prove denied claim, unauthorized client/member action, suspended access, moderator decision boundary, anonymous public behavior, and cross-tenant record denial.

**Likely files:**

- Modify: `apps/client-interface-e2e/src/community-permissions.spec.ts`
- Modify: `apps/business-site-e2e/src/business-site/business-site.spec.ts`
- Modify: `apps/gateway-e2e/src/gateway/workspace-governance.spec.ts`

**Verification:** smallest failing scenario first; then affected app E2E with `SKIP_SETUP=true` against the intentional composed stack.

**Luna:** Yes — separate browser suites can be authored in parallel after G19.1 fixture is fixed.

**Status (2026-08-24):** Complete. The live Gateway governance fixture proves cross-tenant manager appointment is denied; delegated managers receive the canonical `community_manager` role only in their Community child-workspace scope; report listing is scoped to that workspace; in-workspace report decisions succeed; and a report outside the workspace is not exposed for decision (404). The focused Gateway privacy contract and the live `gateway-e2e` fixture pass. Anonymous public entry is also proven in a direct browser smoke and the focused Client Interface forum E2E (9/9 across desktop, mobile, and tablet) using system Chrome headlessly against the live stack.

## P8 — second plugin proof: Blogging

### P8.1: Blogging configurable feature shell

**Outcome:** Blogging exposes a feature-shell declaration and feature-owned data-access boundary that consumes the existing `blogging.posts` capability and `blog-catalog` resource reference without Business imports.

**Likely files:**

- Create: `libs/blogging-feature/src/lib/blogging-feature.ts`
- Create: `libs/blogging-feature/src/lib/blogging-feature.spec.ts`
- Create: `libs/blogging-data-access/src/lib/blogging-data-access.ts`
- Modify: `libs/configurable-plugin-contracts/src/lib/configurable-plugin-contracts.spec.ts`

**Verification:** focused library tests prove resource validation and no Business dependency.

**Luna:** Yes — contract-test reconnaissance is independent; implementation must wait for a confirmed Nx library generation plan.

**Status (2026-08-24):** Complete. Nx-generated `blogging-feature` and `blogging-data-access` libraries establish the Blog-owned shell and catalog-reference boundary. Focused tests prove the public/owner `blogging.posts` routes and reject non-`blog-catalog` references; the shared configurable-plugin contract suite remains green. P8.2 is next.

### P8.2: Business-site Blog runtime adapter

**Outcome:** A published Business Site configuration with `blogging.posts` renders only the referenced catalog in a feature-owned public section/route; unsupported/empty states are deliberate.

**Likely files:**

- Modify: `libs/business-public-ui/src/lib/business-landing-page.component.ts`
- Create: `libs/blogging-feature/src/lib/business-site-blog-runtime.component.ts`
- Modify: `libs/business-public-ui/src/lib/business-landing-page.component.spec.ts`
- Modify: `apps/gateway/src/controllers/blogging/blog.controller.ts`

**Verification:** public renderer spec, Blog query spec, and one published-config browser journey.

**Luna:** No — runtime contract and public rendering must remain coherent.

**Status (2026-08-24):** Complete. The published Business Site model persists the shared `plugins` manifest through Store’s CLI-generated `1787590268589-add-trainer-site-plugins` migration; Store create, update, and every public/owner config response carry that field. `blogging.posts` requires an enabled `public-content` placement and a `blog-catalog` reference before its `blog` section becomes visible. `blogging-feature` owns the public runtime and deliberate empty state; Business data access calls the catalog-only Gateway route. Focused Store, Business data-access, Blog feature, Business public UI, and Business Presence tests are green, as is the focused Gateway controller spec. The live Chromium journey saves a published catalog reference, renders only its catalog response at `/sites/north-star-advisory`, and restores the owner config. `pnpm run validate:typeorm-migrations` passes.

### P8.3: Direct-entry/preview parity

**Outcome:** Preview, published Blog placement, and direct Blog route resolve the same catalog/visibility policy; configuration never broadens a direct product route.

**Likely files:**

- Modify: `libs/business-public-ui/src/lib/business-landing-page.component.spec.ts`
- Modify: `apps/blogging-e2e/src/blogging/blogging.spec.ts`
- Create: focused Business Site Playwright scenario

**Verification:** targeted unit tests, Blogging E2E, Business Site E2E.

**Luna:** Yes — independent unit and browser assertions can be prepared in parallel after P8.2 implementation is frozen.

**Status (2026-08-24):** Complete. `blogging-data-access` now resolves an enabled `public-content` `blog-catalog` through one shared policy helper. Business Site consumes it for landing placement and the new SSR tenant route `/sites/:siteSlug/blog`, which returns an explicit unavailable state rather than querying a broader catalog. The focused Chromium journey proves the same catalog post in the published landing, direct route, and Studio preview, then restores the shared owner configuration. The cookie-session-aware owner E2E fixture now uses `business-site:session-kind` for browser authentication and acquires a separate short-lived token only where legacy request helpers need bearer authorization. Fresh Nx tests passed for Blogging data access (2), Business public UI (43), and Business Site (57), alongside the focused live E2E.

## C11 — Configurator Workspace

### C11.1: Entitled workspace discovery API

**Outcome:** Gateway returns only canonical workspaces the authenticated owner may configure; no TCP endpoint or user-supplied owner/profile identity reaches the browser.

**Likely files:**

- Modify: `apps/gateway/src/controllers/workspace/*`
- Modify: `apps/workspace/src/app/services/workspace.service.ts`
- Modify: matching tests

**Verification:** Gateway test proves owner filtering and denied foreign workspace lookup.

**Luna:** No — authorization authority.

**Status (2026-08-24):** Complete. `GET /api/workspaces` and `GET /api/workspaces/:workspaceId` are Gateway-owned and authenticated. Gateway obtains the owner user/profile pair only from `AuthGuard`’s validated request principal, asks Workspace to list or resolve records matching both identifiers, and projects an owner-free browser DTO (`workspaceId`, kind, slug, display name, app scope, status). Workspace returns `NotFound` for a foreign ID under the authenticated owner pair. Focused Gateway and Workspace contract tests passed, as did production builds for both apps. The broad Workspace suite passed (10 tests). The broad Gateway suite remains blocked by pre-existing `community.controller.spec.ts` fixtures using a non-UUID `workspaceId` with the existing UUID-only `workspaceScopeName` guard; this C11.1 change did not alter that guard.

### C11.2: Browser Workspace shell

**Outcome:** `business-configurator` (or the selected dedicated browser host) lists entitled workspaces, chooses a surface, loads the existing app-config editor through Gateway data access, and preserves workspace context in the URL.

**Likely files:**

- Modify: `apps/business-configurator/src/app/*`
- Modify: `libs/app-config-data-access/src/lib/app-config.store.ts`
- Create: corresponding component specs

**Verification:** Angular component tests plus one authenticated browser journey.

**Luna:** Yes — isolated visual component tests after C11.1 route contract lands.

**Status (2026-08-24):** Complete. The Configurator root is an owner-scoped Workspace browser backed by Gateway discovery data, with canonical Business Site editor URLs. Its data-access state and route/picker contracts passed (17 focused tests across the host and shared library). The production build boundary is now sound: Business Site configuration types live in the buildable `@optimistic-tanuki/configurable-plugin-contracts` library, while legacy Business data access re-exports them; Business Presence consumes the shared contract rather than data-access source. Focused adapter tests and the Configurator production build passed.

### C11.2.5: Reusable feature authoring shells

**Outcome:** Store catalog, Blog post, Forum discussion, and Social/community authoring are product-owned, reusable library surfaces. Hosts inject canonical workspace context only; the shells never accept caller-provided owner, profile, permission, or tenant authority.

**Scope:**

- Define a shared authoring-entry contract in `libs/configurable-plugin-contracts` (product, capability, canonical workspace ID, and return intent).
- Add injectable shells in the owning product libraries: `store-ui`, `blogging-ui`, `forum-ui`, and `social-ui`. Each shell exposes explicit loading, denied, empty, and ready states plus host-projected actions; product data access and persistence remain behind the product boundary.
- Add a common workspace-context adapter in configurable client UI only if all four shells need the same presentation primitive. Do not create an Owner Console detour or a second generic editor.
- Keep the first implementation turn-sized: contract plus one representative Store and Blog shell. Forum and Social shells follow as parallel C11.2.5a/C11.2.5b work once the shared contract is green.

**Verification:** Contract tests prove a shell cannot construct identity/permission authority from URL context. Component tests cover canonical context, loading, denied, empty, and ready rendering. Product route tests prove an app injects the shell without passing owner identity.

**Luna:** Yes — Store/Blog and Forum/Social library shells are independent after the shared contract lands.

**Status (2026-08-24):** Complete. `ProductAuthoringEntry` is exported from the buildable configurable-plugin-contracts library and admits only product, capability, canonical workspace ID, and internal return intent. Store, Blogging, Forum, and Social UI each export standalone authoring shells with loading, denied, empty, and ready states; none accepts identity or authorization inputs. Full affected suites passed: configurable-plugin-contracts (2 suites), Store UI (6), Blogging UI (20), Forum UI (5), and Social UI (9). Host injection and server-side authorization re-resolution remain C11.3 work.

### C11.3: Product-authoring deep links

**Outcome:** Capability cards deep-link to Store, Blog, Forum, or Social authoring with only canonical workspace context; target product re-resolves authorization server-side.

**Likely files:**

- Modify: `libs/configurable-plugin-contracts/src/lib/configurable-plugin-contracts.ts`
- Modify: owner/product route tests in the target applications

**Verification:** deep-link contract tests plus one denied forged-context test.

**Luna:** Yes — target-app route reconnaissance can run in parallel; integration is serialized.

**Status (2026-08-24):** Complete. The Configurator's canonical `workspaces/:workspaceId/authoring/:product` route resolves the workspace through the owner-scoped Gateway contract before checking product eligibility and mounting the Store, Blogging, Forum, or Social authoring shell. The route accepts only workspace and product context; it carries no owner, profile, or permission value. A foreign or failed workspace lookup renders a denied state and mounts no shell. The workspace browser now exposes only kind-appropriate authoring links. Focused deep-link, denied-context, route, and browser tests passed; the full Configurator suite passed (6 suites / 11 tests), as did its production build.

## C12 and P13 — runtime parity and progressive pilots

### C12.1: Published-policy fixture

**Outcome:** One versioned published configuration fixture resolves capability enablement, placement, permission metadata, resource reference, and fallback behavior.

**Likely files:**

- Create: `libs/configurable-plugin-contracts/src/lib/published-policy.fixture.ts`
- Create: `libs/configurable-plugin-contracts/src/lib/published-policy.fixture.spec.ts`

**Verification:** contract tests cover every registered capability and unsupported placement.

**Luna:** Yes — isolated fixture/spec work.

**Status (2026-08-24):** Complete. `PUBLISHED_POLICY_FIXTURE` is a versioned generic-surface fixture that exercises every catalog capability with enabled placement, catalog-derived permission metadata, and a typed product resource reference. `resolvePublishedCapabilityPolicy` returns the enabled policy only for its declared supported placement and otherwise returns the fixture's deterministic hidden `unsupported-placement` fallback. The focused catalog, authoring-entry, and published-policy specs passed independently, as did the configurable-plugin-contracts production build.

### C12.2: Direct-entry parity assertions

**Outcome:** Store, Blog, Forum, and Social use the published-policy fixture at composition points while direct routes keep the same visibility/guard behavior.

**Verification:** one focused adapter test per product; no product pilot is marked complete without a public/direct parity assertion.

**Luna:** Yes — one worker per product only after C12.1 is stable.

**Status (2026-08-24):** Complete. Blogging Feature, Forum UI, Store UI, and Social UI each expose a product-owned published-composition adapter that delegates its capability placement to `resolvePublishedCapabilityPolicy`; the adapters do not inject sample fixture resources into live tenant routes. Focused adapters resolve Blog, Forum, Store, and both Social entry points against the shared fixture. Direct-entry characterization confirms hosted Blog and Store catalog remain public, Client Interface Forum remains host-public, and Social feed retains its existing `AuthGuard` and `ProfileGuard`. Full Blogging Feature, Forum UI, Store UI, and Social UI suites passed, as did focused host route tests.

### P13.1–P13.4: Product pilots

**Outcome:** Ship Blogging, Forum, Store, then Social as separate vertical pilots. Each pilot is its own single-turn slice: one enabled placement, one resource selector where required, one direct-entry parity test, one cross-workspace denial test, and one E2E journey.

**Verification:** each pilot runs its product target plus the shared parity fixture suite before the next begins.

**Luna:** Limited — test reconnaissance and isolated product specs may run concurrently; runtime composition and migrations remain serialized.

## Deferred parallel lane

- **Slice 7 media:** inventory and portable media-reference contract can proceed after R0, but do not block governance.
- **M21.2 Business Site landing unslop:** after M20.1 confirms the claim inventory and M21.1 fixes public-directory policy, rewrite the existing owner-first landing in a specific, human voice. Remove inflated capability claims, generic “platform” language, fake certainty, and repetitive CTA copy. Preserve verified onboarding routes and add acceptance checks for claim-to-capability mapping, mobile/a11y/SSR, and no private workspace disclosure.
- **M22.1 Configurator landing:** after C11 proves the browser host and entitlement model, build a public Configurator Workspace landing that uses the same plain-language editorial bar. It introduces the workspace-type chooser, capability map, verified create/claim/sign-in routes, and governance boundary without exposing TCP contracts, credentials, private workspaces, or unbuilt capabilities.
- **M23.1 consentful funnel measurement:** follows the two landings; use only allowlisted, aggregated events and keep owner/client/moderator routes out of indexing.
- **Slice 24 clean deployment smoke:** execute after R0; it may run independently of G17 implementation once an empty deployment database is available.

## First execution batch

1. R0.1 baseline evidence ledger.
2. R0.2 tracker reconciliation.
3. G17.1 lifecycle contract.
4. After G17.1, run G17.2 and G17.3 as the first parallel Luna pair.

Do not start G18, G19, P8, or C11 until the immediately preceding gate is green and documented.

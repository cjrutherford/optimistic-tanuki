# Configurable Platform Handoff

Date: 2026-09-03
Branch: `business-overhaul`
Observed HEAD: `aca41e54`
Primary tracker: [`docs/reports/configurable-client-parity/index.html`](reports/configurable-client-parity/index.html)

## Overall goal

Deliver a unified, self-service configurable platform in which an end user can register, authenticate, create and own an isolated app, business site, or community, configure its layout and enabled features, author its content, publish a durable release, and serve a client-facing experience without leaking data or permissions across workspaces.

The platform should share contracts, feature shells, data-access libraries, authentication behavior, workspace/app scoping, publishing semantics, and reusable UI primitives. It must still preserve the distinct entry points and product identities of Configurable Client/App Configurator and Business Site/Business Configurator. Social, store/catalog, forum, blogging/catalog, moderation, and other enabled features must remain app-scoped and membership-aware.

The effort is complete only when both owner and client journeys work against the live stack, published state—not drafts—drives public rendering, workspace isolation is enforced at every boundary, and retained evidence supports each completion claim.

## Current baseline

The tracker marks P0 through P8 complete. That means the current implementation baseline includes:

- A reconciled evidence baseline and workspace/app contract.
- App Configurator persistence with workspace and owner context.
- Gateway workspace enforcement and cross-workspace denial coverage.
- Shared session, authentication, anonymous boundaries, and safe return intent.
- Shared landing/discovery primitives, with the Business Site directory-eyebrow contrast issue explicitly accepted as a waiver.
- Configurable Client landing, authentication entry, and product discovery.
- Owner workspace selection, dashboard, scoped authoring entry, publish control, and foreign-workspace denial.
- Generic app configuration authoring, draft persistence, validation, conflict/failure recovery, and unsaved-navigation protection.

P8.4 is closed with an explicit browser-proof waiver. The focused navigation suite passes 7/7, the full `configurable-client` Nx test target passes, and the production build passes. The final authenticated browser run reached login, workspace selection, dashboard, editor, and dirty editing, but timed out waiting for the unsaved-change modal. That timeout is retained as failed evidence and must not be described as a passing browser proof.

At handoff, the accepted Configurable Client image was `sha256:e1853a5d…`, bound to port 8090, and `/owner` returned HTTP 200. Runtime state is ephemeral and must be rechecked after any reboot.

## Remaining delivery slices

### P9 — Publishing releases and public resolution

Required outcome: valid drafts publish atomically into immutable releases, and public resolution reads only a committed active release.

Completion evidence must cover immutable release identifiers, version history, active and previous release resolution, invalid-draft rejection, absent releases, failed publication, and rollback or previous-release behavior. The central risk is exposing a draft or a mixed/non-atomic release.

### P10 — Feature shell integration

Required outcome: a published app renders inside a resilient shared shell with app identity, accessible navigation, membership-aware actions, and isolated feature loading.

Completion evidence must cover shell startup, landmarks and skip navigation, responsive behavior, one representative feature integrated end to end, lazy feature success/failure, error isolation, and permission-aware action visibility. A feature failure must not blank the whole client or bypass membership rules.

### P11 — Client discovery and membership

Required outcome: clients can discover only apps visible to them, understand access requirements, join or request app-scoped membership, and reopen apps they can access.

Completion evidence must cover anonymous discovery, search/filtering, public access, joinable and request-only states, duplicate membership, denial, empty results, immediate membership reflection, and private-app non-disclosure. Platform identity must remain distinct from app membership.

### P12 — Business Site landing redesign

Required outcome: Business Site receives a distinct, high-contrast, responsive landing experience that uses shared primitives where useful without erasing its product identity or changing established routes.

Completion evidence must include desktop and mobile browser captures on port 8094, WCAG AA contrast, labeled controls, keyboard navigation, zoom behavior, preserved tenant/public routes, and functioning primary conversion actions. This slice owns the still-relevant North Star contact/select findings and Business Site landing contrast work.

### P13 — Integrated browser and E2E proof

Required outcome: prove the complete owner and client journeys against the live stack for Configurable Client and Business Site.

Retained evidence must cover owner configure/save/publish, client discover/auth/join/open, workspace isolation and denial, public-versus-draft behavior, error recovery, responsive viewports, accessibility output, console/network diagnostics, screenshots, and focused then app-level E2E results. Follow the repository E2E policy: verify live ports first, use checked-in Nx targets, avoid tearing down a shared stack during `SKIP_SETUP=true` runs, and use system Chrome when managed Playwright browsers are unavailable.

### P14 — Closeout and artifact publication

Required outcome: reconcile the tracker and finish with a defensible evidence index, scorecard, change summary, and risk register.

Every completion claim must link to retained evidence or identify an explicit accepted gap. Re-score every weighted dimension; the current 60/100 score predates P8 closure and is not a final score. Remove or relabel stale next-action copy, verify tracker navigation, assign ownership to unresolved follow-ups, and publish a durable artifact without concealing waivers.

## Deferred and accepted items

These are not part of P9–P14 unless a remaining slice directly depends on them:

- AppResolver route reuse and in-flight request cancellation.
- AuthSession logout/restore race hardening.
- Business Configurator and public Business Site tenant route-reuse isolation.
- OAuth popup concurrency/race handling.
- Publish-modal pending-close desynchronization, unless P9 proves it is already resolved.
- Business Site directory-eyebrow contrast at 2.6484:1: accepted waiver from P5. P12 may supersede it with a redesign, but prior evidence must remain visible.
- P8.4 authenticated modal proof: accepted waiver with failed evidence retained at `artifacts/agent-browser/configurable-client-slice-8-4-20260903-final/`.

The tracker also contains a “Deferred visual recovery” section. Its Configurable Client 401 and P4/P6/P7 owner-entry findings point to slices now marked complete and should be treated as historical until freshly reproduced. The Business Site P12 findings remain actionable.

## Known tooling and workspace conditions

- The checkout is heavily dirty and contains many modified and untracked files spanning the program. Preserve all existing changes; do not reset, clean, or recreate work in a worktree.
- Several new files central to Configurable Client are currently untracked. A fresh session must inspect status before editing and must not assume untracked means disposable.
- App Configurator and `business-portal-ui` Nx test/lint targets previously exited without useful diagnostics. They are unresolved tooling checks, not evidence that those features pass or fail.
- Default Nx verification uses `NX_DAEMON=false` and `NX_ISOLATE_PLUGINS=false` and runs through `pnpm nx`.
- TypeORM schema changes must use the owning service's Nx migration-generation target. Existing generated migrations may be edited; new migration files and timestamps must not be hand-created.
- Docker bind mounts must preserve the local user's ownership. Do not introduce compose behavior that changes host file ownership.
- Primary live UX ports are Configurable Client 8090 and Business Site 8094. Repository-wide E2E policy also treats Client Interface 8080 and Forge of Will 8081 as primary validation targets unless scope is narrowed.

## Important artifacts and reusable guidance

- Main parity tracker: [`docs/reports/configurable-client-parity/index.html`](reports/configurable-client-parity/index.html)
- Broader program tracker: [`docs/reports/configurable-platform-program/index.html`](reports/configurable-platform-program/index.html)
- P8.4 browser script: [`scripts/configurable-client-slice-8-4-browser.sh`](../scripts/configurable-client-slice-8-4-browser.sh)
- P8.4 failed live evidence: `artifacts/agent-browser/configurable-client-slice-8-4-20260903-final/`
- Personal Codex skill for this navigation failure mode: `~/.codex/skills/angular-unsaved-navigation-modal/SKILL.md`

## Fresh-session starting point

Resume at P9. Before changing implementation, reconcile P9's release requirements with the existing App Configurator entities, migrations, Gateway routes, owner publish control, and public resolver so already-delivered behavior is reused rather than duplicated. Do not reopen P0–P8 unless current source or fresh evidence contradicts the tracker. P13 remains the integrated proof gate, and P14 is the actual end of the program.

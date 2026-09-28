# Civic Core and HAI Contact Completion Plan

> Implementation record: see [the Slice 07–08 closeout](../audits/2026-09-27-slices-07-08-closeout.md). This plan records the original execution intent; the final notification outbox lives in Lead Tracker, while Gateway resolves eligible owners.

> **For Codex:** Use `superpowers:executing-plans` to implement this plan task by task.

**Goal:** Close the remaining Slice 07 Civic Core and Slice 08 HAI ROI/contact gaps with working service deployment, accessible public flows, and an enforceable owner acknowledgment SLA.

**Architecture:** Retain Civic Core as the dedicated `apps/civic` NestJS service; complete its runtime wiring and public data ingestion rather than moving municipal persistence into Towne Square. Keep HAI SLA deadlines, business-time calculations, response timestamps, and retry-safe breach work server-owned in Lead Tracker; Gateway resolves and notifies all eligible platform owners, while Owner Console provides the shared HAI lead queue and personal acknowledgment action.

**Tech Stack:** Nx, NestJS TCP, TypeORM/PostgreSQL, Angular SSR, MapLibre GL, existing email and identity services.

---

## Operating constraints

- Work in the current checkout. Repository `AGENTS.md` prohibits Git worktrees.
- The checkout is already dirty. Preserve existing edits and inspect `git diff` before touching any listed file.
- SLA: the clock starts when a HAI lead is created; count Monday–Friday, 9:00am–5:00pm America/New_York. Pause outside those hours, including holidays only if the existing platform calendar can represent them; otherwise document weekdays as the initial calendar. An SLA is met only when an eligible owner sends a personal acknowledgment through the Owner Console lead workflow. Intake receipts and automated mail do not count.
- Public copy may promise a one-business-hour acknowledgment. It must not promise same-day onsite arrival; substantive service timelines are task-dependent.

## Task 1: Stabilize and verify the current ROI work

**Own:** `apps/hai/src/app/components/landing/roi-calculator-section.component.ts`, its spec, `apps/hai/src/app/services/roi-calculator.service.ts` and its spec, `apps/hai/src/app/components/landing/landing.component.{ts,html}`.

1. Rename either the `emailComparison` output or method to remove the duplicate identifier; update the template and spec to use the output correctly.
2. Verify five-year costs and savings against hand-calculated fixtures, including zero/invalid inputs and comparison updates.
3. Run `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test hai` and `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx build hai`.

**Accept when:** the HAI targets pass; calculator values recalculate from user input and show the five-year comparison; no TypeScript duplicate identifier remains.

## Task 2: Make Civic Core operational

**Own:** `apps/civic/**`; `apps/gateway/src/controllers/civic/**`; Gateway Civic registration in `apps/gateway/src/app/app.module.ts`, `gateway-service-providers.ts`, `controllers/index.ts`, and `assets/config.yaml`; `libs/constants/src/lib/libs/civic.ts` and exports; `libs/models/src/lib/libs/civic/**` and exports. Do not edit unrelated gateway routes.

1. Retain the dedicated Civic service. Add it to the supported local/production compose and database bootstrap path, and run its generated migration during bootstrap. Confirm tenant ID propagation from Gateway through TCP to tenant RLS.
2. Keep manual PDF ingestion as the initial trusted source path unless usable public source URLs are available. Add a repeatable source ingestion/import path for council and planning commission PDFs, with duplicate protection; do not describe manual upload as a scraper.
3. Review the initial migration’s CLI provenance and generated SQL. Generate any schema changes through `civic:typeorm:migration:generate`; never hand-create or rename timestamped migration files.
4. Add integration coverage for deployed-service registration, PDF ingestion/search, TIP GeoJSON queries, permission-gated writes, and tenant isolation.

**Accept when:** a clean compose bootstrap starts Civic and Gateway, applies migrations, serves a real persisted agenda and TIP project through `/api/v1/civic`, and rejects cross-tenant reads/writes. A Civic container must be present in the stack configuration.

## Task 3: Complete Civic public UI acceptance

**Own:** `apps/whitebox-civic-core/src/app/**`, `apps/whitebox-civic-core/src/styles.css`, `apps/whitebox-civic-core-e2e/**`, and Civic theme files under `libs/theme-models/**` only if required.

1. Replace the blank MapLibre background with a configured usable basemap and the API’s GeoJSON project layer; selecting a marker and project must reveal funding/milestone detail accessibly.
2. Verify `/agendas`, `/projects`, and the top-level emergency banner with keyboard-only interaction, visible focus, accessible names, and live announcements. Fix focus handling and responsive behavior found in that audit.
3. Exercise SSE through the real Gateway/Civic stack; document its polling interval and verify newly published and expired advisories update without a page reload.

**Accept when:** the app shows real API data; map locations align with GeoJSON; details work without a pointer; an advisory appears and expires in the UI; WCAG 2.1 AA/Section 508 review has no unresolved critical keyboard or announcement issue.

## Task 4: Enforce the HAI one-business-hour SLA and notify every owner

**Lead Tracker ownership:** `apps/lead-tracker/src/app/leads.service.ts`, `leads.service.spec.ts`, `app.module.ts`, and the owning Lead entity in `libs/models/src/lib/leads-entities/**` with its exports. Add an SLA deadline/state and durable retry-safe escalation/outbox only if needed to represent pending/sent state.

**Gateway/identity/email ownership:** `apps/gateway/src/controllers/blogging/contact.controller.ts` and its spec; Gateway contact config/types; a focused owner-recipient resolver/mailer under `apps/gateway/src/controllers/blogging/`; module registration. Reuse existing email and scoped role-resolution services. Include all profiles with Owner Console-scoped `owner_console_owner`, `owner`, `global_admin`, or `system_admin`; exclude ordinary profiles and invalid/missing email addresses.

**Owner Console ownership:** `apps/owner-console/src/app/components/contact-leads-management.component.ts` and spec, `apps/owner-console/src/app/services/contact-leads.service.ts`, and only required authorization/query helpers. Make all eligible owners see the shared HAI queue while preserving owner-only access. Personal response action must update the server response timestamp; automatic receipts must never update it.

1. Add failing tests for business-hour boundaries, weekend rollover, personal-vs-automatic acknowledgment, recipients included/excluded, shared visibility, retry/idempotency, and breach suppression after an on-time response.
2. Implement server-owned business-time calculation from lead creation and server-recorded personal response. Persist deadline and notification state so restarts/retries cannot lose or duplicate a breach notification.
3. After successful HAI lead creation, send intake email to every eligible owner. At deadline, suppress escalation if an owner has acknowledged; otherwise deliver retry-safe overdue notice to eligible owners.
4. Replace Owner Console’s two-day heuristic and frozen clock with API-provided SLA state. Correct HAI copy in `apps/hai/src/app/components/landing/contact-section.component.html` and `landing.component.ts`.
5. If entity metadata changes, generate the Lead Tracker migration with its Nx `typeorm:migration:generate` target. Review SQL; run the target against a fresh database; run `pnpm run validate:typeorm-migrations`.

**Accept when:** a new HAI lead is visible to all eligible owners and triggers email to each; a receipt leaves the SLA pending; an owner’s personal response within the counted hour marks it met and suppresses breach mail; an unanswered lead rolls to overdue exactly after one counted business hour, including creation before close/weekend; repeated jobs do not duplicate notices; unrelated users neither receive notification nor gain queue access.

## Task 5: Final verification and handoff

1. Run each changed unit-test target, then build/lint the changed applications:

   ```bash
   NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test civic
   NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test gateway
   NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test lead-tracker
   NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test owner-console
   NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test hai
   NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test whitebox-civic-core
   ```

2. With compose services already running, verify expected ports before E2E. Exercise Civic agenda import/search, map, advisory publish/expiry, and HAI form → all-owner email → owner personal acknowledgment → SLA status. Do not tear down shared services in a live-stack run.
3. Report migration/validator, tests, runtime evidence, accessibility findings, and any source-feed/holiday-calendar limitation. Leave Slices 09–11 for a separate plan after 07–08 acceptance.

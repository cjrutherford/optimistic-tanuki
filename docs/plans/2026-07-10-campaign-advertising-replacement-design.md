# Campaign Advertising Replacement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace legacy community sponsorship inventory with owner-managed,
multi-target advertising campaigns that support channel/community targeting and
pre-roll, mid-roll, post-roll, and on-page placements.

**Architecture:** A campaign owns its lifecycle, budget/date metadata, and one
creative per placement type. Target-placement line items independently connect a
campaign to a channel or community and declare the allowed placement type. The
new eligibility read model serves on-page inventory immediately; roll-placement
records remain queryable until the broadcast scheduler implements delivery.

**Tech Stack:** Nx monorepo, NestJS, TypeORM/PostgreSQL, Angular, shared TypeScript
DTOs, Playwright.

---

## Product Rules

- A business owns a campaign with `draft`, `active`, `paused`, or `archived`
  lifecycle state, optional total budget, and a start/end window.
- A campaign may have multiple channel and community targets.
- Each target independently selects placement types.
- Channel targets may select `pre-roll`, `mid-roll`, `post-roll`, or `on-page`.
- Community targets may select `on-page` only.
- A campaign has one creative per selected placement type. Per-target creative
  overrides are explicitly out of scope.
- Activation requires a valid date range, at least one target-placement line,
  and creative for every selected placement type.
- Owners manage activation manually. Checkout, pacing, impressions, and billing
  are deferred.
- This is a clean replacement: delete legacy advertising records and remove the
  `community_sponsorships` model, APIs, Studio UI, seeds, and compatibility reads.

## Task 1: Define campaign contracts

**Files:**

- Create: `libs/models/src/lib/libs/advertising-campaign.dto.ts`
- Modify: `libs/models/src/index.ts`
- Test: `libs/models/src/lib/libs/advertising-campaign.dto.spec.ts`

1. Write DTO tests for legal target/placement combinations and activation input.
2. Add `AdvertisingCampaign`, `CampaignCreative`, and
   `CampaignTargetPlacement` DTOs plus placement, target-kind, and lifecycle
   unions.
3. Export the contracts from `libs/models`.
4. Run the focused models test through Nx.

## Task 2: Replace the persistence model

**Files:**

- Create: `apps/payments/src/entities/advertising-campaign.entity.ts`
- Create: `apps/payments/src/entities/advertising-campaign-creative.entity.ts`
- Create: `apps/payments/src/entities/advertising-campaign-target-placement.entity.ts`
- Create: `apps/payments/migrations/<timestamp>-replace-legacy-sponsorships-with-campaigns.ts`
- Modify: `apps/payments/src/app/staticDatabase.ts`
- Modify: `apps/payments/src/app/app.module.ts`
- Test: `apps/payments/src/app/staticDatabase.spec.ts`

1. Write a migration registration test that expects the replacement migration
   and no legacy sponsorship entity.
2. Create tables, foreign keys, indexes, and placement constraints.
3. In the migration, delete all rows from `community_sponsorships`, then drop
   its indexes and table. Do not migrate legacy records.
4. Remove the legacy entity from TypeORM registration.
5. Run the focused payments database test and the migration-backed dev setup.

## Task 3: Implement owner campaign commands

**Files:**

- Modify: `apps/payments/src/app/services/payment.service.ts`
- Modify: `apps/payments/src/app/services/payment.service.spec.ts`
- Modify: `apps/payments/src/app/app.controller.ts`
- Modify: `libs/constants/src/lib/libs/store.ts`

1. Write failing service tests for create, update, activate, pause, archive, and
   invalid community roll placement rejection.
2. Implement transactional campaign save/update behavior, validating ownership
   of the business page and target-placement combinations.
3. Add commands for owner campaign CRUD and lifecycle transitions.
4. Remove sponsor inventory command handlers and tests.
5. Run `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test payments --runInBand`.

## Task 4: Expose gateway APIs and shared Studio data access

**Files:**

- Modify: `apps/gateway/src/controllers/payments/payments.controller.ts`
- Modify: `apps/gateway/src/controllers/payments/payments.controller.spec.ts`
- Modify: `libs/business-data-access/src/lib/business-api.service.ts`
- Modify: `libs/business-data-access/src/lib/business-api.service.spec.ts`
- Modify: `libs/business-data-access/src/index.ts`

1. Write gateway/controller tests for authenticated owner campaign CRUD and
   lifecycle transitions.
2. Replace sponsor inventory DTOs and methods with campaign equivalents.
3. Keep channel ownership association only if it remains useful for business
   ownership; it is not a campaign-target substitute.
4. Run focused gateway and business-data-access tests.

## Task 5: Build the Studio campaign editor

**Files:**

- Create: `libs/business-portal-ui/src/lib/business-owner-ad-campaign-page.component.ts`
- Create: `libs/business-portal-ui/src/lib/business-owner-ad-campaign-page.component.spec.ts`
- Modify: `libs/business-portal-ui/src/lib/business-portal-shell.component.ts`
- Modify: `libs/business-portal-ui/src/lib/business-portal-shell.component.spec.ts`
- Modify: `libs/business-portal-ui/src/index.ts`
- Modify: `apps/business-site/src/app/app.routes.ts`

1. Write failing component tests for a target-placement matrix with multiple
   channels/communities and independent placement choices.
2. Render campaign details, selected targets, per-target placement controls,
   creative-per-placement editing, and lifecycle actions.
3. Disable and explain illegal community roll placements.
4. Remove the sponsor inventory route/page and its navigation entry.
5. Run the focused business portal UI tests and build `business-site`.

## Task 6: Add unified campaign eligibility for on-page surfaces

**Files:**

- Modify: `apps/payments/src/app/services/payment.service.ts`
- Modify: `apps/payments/src/app/services/payment.service.spec.ts`
- Modify: `apps/payments/src/app/app.controller.ts`
- Modify: `apps/gateway/src/controllers/payments/payments.controller.ts`
- Modify: `apps/gateway/src/controllers/payments/payments.controller.spec.ts`
- Create: `libs/models/src/lib/libs/advertising-eligibility.dto.ts`

1. Write failing tests for active-date filtering, locality/radius matching,
   target matching, and placement-specific creative requirements.
2. Implement a public eligibility query accepting locality coordinates plus an
   optional `channelId` or `communityId` and requested placement type.
3. Restrict immediate UI consumption to `on-page`; return roll candidates for
   future scheduler use without implying delivery.
4. Run payments and gateway tests.

## Task 7: Move MetroCast and Towne Square to campaign reads

**Files:**

- Modify: `apps/video-client/src/app/services/sponsor-discovery.service.ts`
- Modify: `apps/video-client/src/app/services/sponsor-discovery.service.spec.ts`
- Modify: `apps/video-client/src/app/pages/home/home.component.ts`
- Modify: `apps/video-client/src/app/pages/home/home.component.spec.ts`
- Modify: `apps/local-hub/src/app/pages/city/city.component.ts`
- Modify: `apps/local-hub/src/app/pages/city/city.component.spec.ts`

1. Write failing callers for the on-page campaign eligibility endpoint.
2. Replace legacy sponsor inventory types and queries.
3. Keep existing sponsor rail UX, but label it as a campaign placement only
   when a valid campaign creative is returned.
4. Run focused video-client and local-hub tests, then their development builds.

## Task 8: Replace seeds and remove legacy advertising code

**Files:**

- Modify: `apps/business-site/src/seed-trainer.mjs`
- Modify: `apps/payments/src/app/loadDatabase.ts`
- Modify: `scripts/dev-seed.sh`
- Delete: legacy sponsorship-specific seed/helper files if present
- Test: relevant seed tests under `apps/payments` and `apps/business-site`

1. Seed active on-page campaigns for anchored businesses against a seeded
   channel and community.
2. Seed optional roll creatives/line items only as non-delivered future data.
3. Delete all legacy advertising seed paths and `community_sponsorships`
   references.
4. Run `pnpm run docker:dev:seed` and verify the campaign tables are populated.

## Task 9: Add evaluator documentation and cross-app Playwright coverage

**Files:**

- Create: `docs/guides/metrocast-locality-evaluator-guide.md`
- Modify: `apps/full-stack-e2e/src/cross-app-user-journey.spec.ts`
- Modify: `apps/local-hub-e2e/src/public-pages.spec.ts`
- Modify: `apps/video-client-e2e/src/<campaign-on-page-spec>.ts`
- Modify: `apps/business-site-e2e/src/<campaign-management-spec>.ts`

1. Document preflight, seed credentials, direct application URLs, expected
   results, and explicit deferred roll-delivery behavior.
2. Write one owner journey: create/activate a campaign with multiple targets
   and independently selected placements.
3. Write one viewer journey: verify the active on-page campaign appears in the
   appropriate Local Hub and MetroCast surfaces and links to its Studio site.
4. Keep roll assertions limited to data visibility until scheduling exists.
5. Run smallest new specs first, then the affected app suites, then
   `full-stack-e2e` cross-app user journey with the live Docker stack.

## Task 10: Validate the slice gate and update the rollout tracker

**Files:**

- Modify: `docs/plans/2026-06-29-metrocast-slice-tracker.md`

1. Run `pnpm run slice:checkpoint:dev`.
2. Confirm both `pnpm run docker:dev` and `pnpm run docker:dev:bootstrap`
   exit successfully.
3. Mark Slice 16 complete, record this campaign replacement as Slice 16.1, and
   update Slice 19 to consume campaign eligibility rather than legacy sponsor
   inventory.
4. Record exact test commands and E2E coverage in the tracker.

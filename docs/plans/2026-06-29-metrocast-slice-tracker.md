# MetroCast Slice Tracker

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Keep one running source of truth for the MetroCast, Towne Square, and Studio locality-driven rollout, including what landed, what is in progress, and what remains.

**Architecture:** The rollout is being executed as thin vertical slices across `local-hub` (Towne Square), `video-client`/`videos` (MetroCast/Tuner), `business-site` (Studio/public business presence), `gateway`, and shared model/data-access libraries. The core architectural move is away from a rigid city database and toward locality anchors plus gateway-driven discovery, with communities, businesses, and channels acting as the primary geospatial entities.

**Tech Stack:** Nx monorepo, Angular, NestJS, PostgreSQL/TypeORM, Docker Compose, shared TS DTO/model libraries.

## Slice Gate

Every slice boundary now carries a required local stack checkpoint:

- run `pnpm run slice:checkpoint:dev`
- treat the slice as incomplete if either `pnpm run docker:dev` or
  `pnpm run docker:dev:bootstrap` exits non-zero

This gate exists to catch stack drift, seeding regressions, and Compose startup
breakage before the next vertical slice begins.

---

## Summary

The platform has been moved materially toward an anchor-first locality model.
Instead of treating cities as a canonical seeded table that every app reads from,
the system now centers on:

1. Community locality metadata
2. Business page anchors
3. Channel anchors
4. Gateway locality discovery APIs
5. External locality information for city presentation where needed

The intent across all remaining work is unchanged:

- Towne Square is the social/local feed tent pole.
- MetroCast/Tuner is the passive and live local video tent pole.
- Studio/business-site is the business and creator operations tent pole.
- All three should reinforce each other through shared locality context rather
  than duplicating disconnected “city” models.

---

## Completed Slices

### Slice 1: Locality model pivot

**Status:** Done

Changed the plan and codebase direction from “supported cities database” to
“anchor-based locality.”

Delivered:

- Gateway locality discovery controller and shared DTOs
- Shared locality UI/model helpers
- Removal path for obsolete city-table assumptions
- Continued use of seeded communities while de-emphasizing seeded cities as the
  primary source of locality truth

Key files touched:

- `apps/gateway/src/controllers/locality/`
- `libs/models/src/lib/libs/locality-discovery.dto.ts`
- `libs/ui-models/src/lib/ui-models/locality.ts`

### Slice 2: Towne Square / Local Hub locality consumption

**Status:** Done

Updated `local-hub` to consume the new locality model and gateway discovery
layer instead of relying on static city-only assumptions.

Delivered:

- New locality services in `local-hub`
- Landing/community/city views updated around locality summaries and nearby
  entities
- Community derivation improved from existing locality communities and related
  business data
- External locality info API support added for display enrichment

Key files touched:

- `apps/local-hub/src/app/services/locality-discovery.service.ts`
- `apps/local-hub/src/app/services/locality-info.service.ts`
- `apps/local-hub/src/app/services/locality-resolution.service.ts`
- `apps/local-hub/src/app/pages/landing/*`
- `apps/local-hub/src/app/pages/city/*`
- `apps/local-hub/src/app/pages/community/*`

### Slice 3: Business-site / Studio anchor support

**Status:** Done

Added locality anchor handling to business pages so Studio-owned business
presence can participate in shared discovery.

Delivered:

- `anchorLat` / `anchorLng` support on business pages
- Owner editor UI for saving locality anchors
- Gateway/payments API support for anchor persistence and reads
- Development business seeds updated with anchored businesses and hosted sites

Key files touched:

- `apps/payments/src/entities/business-page.entity.ts`
- `apps/payments/migrations/1782648600000-business-page-anchor-columns.ts`
- `apps/gateway/src/controllers/payments/payments.controller.ts`
- `libs/business-data-access/src/lib/business-api.service.ts`
- `libs/business-portal-ui/src/lib/business-site-editor-page.component.ts`
- `apps/business-site/src/seed-trainer.mjs`

### Slice 4: Channel anchor support for MetroCast backend

**Status:** Done

Added anchor support to `videos` channels so channels participate in the same
locality system as communities and businesses.

Delivered:

- `anchorLat` / `anchorLng` support for channels and related DTOs
- Video seed updates to create anchored channels
- Static database and service test updates

Key files touched:

- `apps/videos/src/entities/channel.entity.ts`
- `apps/videos/migrations/1782648000000-channel-anchor-columns.ts`
- `libs/models/src/lib/libs/videos/channel.dto.ts`
- `apps/videos/src/seed-videos.ts`

### Slice 5: Dev seed stabilization and owner seed

**Status:** Done

Hardened the seed/bootstrap workflow so the stack can be reseeded reliably in
dev while using current code.

Delivered:

- Added development owner seed:
  - `test-owner@owner-console.local`
  - password `Password123!`
- Fixed service refresh behavior for workspace-mounted apps before seeding
- Fixed `docker-build-batched.sh` shell compatibility issue
- Fixed stale `videos` seed execution by forcing a fresh `videos` build before
  running `docker:dev:seed`
- Confirmed `pnpm run docker:dev:seed` completes successfully end-to-end

Key files touched:

- `apps/owner-console/src/seed-owner.mjs`
- `scripts/dev-seed.sh`
- `scripts/docker-build-batched.sh`
- `scripts/tests/docker-service-planner.test.mjs`

### Slice 6: Video client locality-aware viewer homepage

**Status:** Done

Started the viewer-facing MetroCast/Tuner follow-through by wiring the
`video-client` home page into locality discovery.

Delivered:

- `video-client` locality discovery service
- API base token wiring
- Home page “Local Scene” summary
- Nearby channels rail driven by `/api/locality/discovery`
- Geolocation with safe fallback anchor

Key files touched:

- `apps/video-client/src/app/services/locality-discovery.service.ts`
- `apps/video-client/src/app/pages/home/home.component.ts`
- `apps/video-client/src/app/app.config.ts`

---

## Current Workspace State

There is active uncommitted work in the tree covering:

- `local-hub`
- `business-site`
- `payments`
- `gateway`
- `videos`
- `video-client`
- shared model/data-access libs
- seed/bootstrap scripts

This tracker reflects the intended state of that in-flight work, not just what
has already been committed.

---

## Remaining Slices

The remaining slices are ordered to keep each one vertically useful and
single-turn achievable.

### Slice 7: Creator locality controls in MetroCast

**Status:** Done

Made channel locality explicit in creator-facing MetroCast flows so channel
anchors are not hidden backend-only metadata.

Delivered:

- `video-client` DTOs updated to carry `anchorLat` / `anchorLng`
- Channel update API wired into `video-client`
- Creator locality tab in `My Channel` for viewing and editing anchor
  coordinates
- Nearby locality discovery preview on the creator side using
  `/api/locality/discovery`
- Public channel About view updated to expose anchor and timezone context
- Verified with:
  - `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test video-client`
  - `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx build video-client --configuration=development`

Key files touched:

- `apps/video-client/src/app/components/my-channel.component.ts`
- `apps/video-client/src/app/components/my-channel.component.spec.ts`
- `apps/video-client/src/app/pages/channel/channel.component.ts`
- `apps/video-client/src/app/pages/channel/channel.component.spec.ts`
- `apps/video-client/src/app/services/video.service.ts`
- `apps/video-client/src/app/services/video.service.spec.ts`
- `libs/ui-models/src/lib/ui-models/video/video.dto.ts`

### Slice 8: Towne Square cross-posting hooks into MetroCast

**Status:** Done

**Goal:** Let local social activity reinforce local video discovery.

Delivered:

- Define lightweight shared references between community posts and channels
- Support “shared from Towne Square” or “watch on MetroCast” affordances
- Add minimal data contract for community-linked channel promotion
- Seed a MetroCast promo post into Towne Square community content
- Resolve MetroCast app links from the registry so Towne Square cards point to
  the active video-client base URL
- Decouple video seed channel identity from locality community ids so channel
  anchors remain locality-based without breaking `docker:dev:seed`

Verified with:

- `pnpm exec jest apps/videos/src/seed-videos.http.spec.ts --runInBand`
- `pnpm exec jest apps/videos/src/seed-videos.spec.ts --runInBand`
- `pnpm run slice:checkpoint:dev`

Target outcome:

- A locality can have a recognizable video presence inside Towne Square without
  duplicating full video playback logic there.

### Slice 9: Business presence cross-links into Towne Square and MetroCast

**Status:** Done

**Goal:** Make business pages discoverable as first-class local entities across
apps.

Delivered:

- Business references in locality discovery surfaces where appropriate
- Shared affordances:
  - watch sponsor/local business content from MetroCast
  - jump from Towne Square locality page to hosted business presence
- Clear “local sponsor / local business” treatment in public UIs
- Gateway locality discovery now enriches nearby businesses with hosted
  business-site ownership and path metadata
- `video-client` home page now renders a nearby businesses rail that links to
  hosted business-site tenants through the app registry
- `local-hub` city business cards now prefer hosted business-site destinations
  over raw website links when a published site exists

Verified with:

- `pnpm exec jest apps/gateway/src/controllers/locality/locality-discovery.controller.spec.ts --runInBand`
- `pnpm exec jest apps/video-client/src/app/pages/home/home.component.spec.ts --runInBand`
- `pnpm exec jest apps/local-hub/src/app/pages/city/city.component.spec.ts --runInBand`
- `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test gateway`
- `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test video-client`
- `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test local-hub`
- `pnpm run slice:checkpoint:dev`

Key files touched:

- `apps/gateway/src/controllers/locality/locality-discovery.controller.ts`
- `apps/gateway/src/controllers/locality/locality-discovery.controller.spec.ts`
- `apps/video-client/src/app/pages/home/home.component.ts`
- `apps/video-client/src/app/pages/home/home.component.spec.ts`
- `apps/local-hub/src/app/pages/city/city.component.ts`
- `apps/local-hub/src/app/pages/city/city.component.html`
- `apps/local-hub/src/app/pages/city/city.component.spec.ts`
- `apps/store/src/trainer-config/trainer-config.service.ts`
- `libs/business-data-access/src/lib/business-api.service.ts`
- `libs/models/src/lib/libs/locality-discovery.dto.ts`

### Slice 10: Tuner-side “local now” browsing experience

**Status:** Done

**Goal:** Turn locality-aware discovery into an OTA-style browsing flow.

Delivered:

- Local channel rail beyond homepage
- “On now / upcoming” sections using channel feed + schedule
- Better routing from discovery cards into live or scheduled viewing
- Shared locality scope helpers for MetroCast discovery surfaces
- Home page CTA into the local tuner browse flow
- Channel page query-param handling for schedule/live landing context
- Dev video seed now backfills missing channel anchors for pre-existing channels
  so locality discovery remains populated after repeated reseeds

Verified with:

- `pnpm exec jest apps/video-client/src/app/pages/home/home.component.spec.ts apps/video-client/src/app/pages/channel/channel.component.spec.ts apps/video-client/src/app/pages/local-browse/local-browse.component.spec.ts --runInBand`
- `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test video-client --runInBand`
- `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx build video-client --configuration=development`
- `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test videos --runInBand --testPathPattern=seed-videos.http.spec.ts`
- `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx build videos --configuration=development`
- `pnpm run docker:dev:seed`
- `curl -s "http://127.0.0.1:8093/api/locality/discovery?lat=32.0809&lng=-81.0912&radiusMeters=40234&scope=local-hub&limit=12"`
- `curl -s http://127.0.0.1:8093/browse/local`

Key files touched:

- `apps/videos/src/seed-videos.ts`
- `apps/videos/src/seed-videos.http.ts`
- `apps/videos/src/seed-videos.http.spec.ts`
- `apps/video-client/src/app/locality/video-locality.utils.ts`
- `apps/video-client/src/app/pages/local-browse/local-browse.component.ts`
- `apps/video-client/src/app/pages/local-browse/local-browse.component.spec.ts`
- `apps/video-client/src/app/pages/home/home.component.ts`
- `apps/video-client/src/app/pages/home/home.component.spec.ts`
- `apps/video-client/src/app/pages/channel/channel.component.ts`
- `apps/video-client/src/app/pages/channel/channel.component.spec.ts`
- `apps/video-client/src/app/app.routes.ts`

This is the first slice that should make MetroCast feel like a real local tuner
instead of a generic video app with locality tags.

### Slice 11: Linear broadcast engine basics

**Status:** Done

**Goal:** Deliver the first practical slice of the PRD’s cold-start solution.

Deliverables:

- Channel schedule confidence in the UI and API
- Feed selection logic that clearly distinguishes:
  - live
  - scheduled playback
  - replay / filler behavior
- Minimum viable automated broadcast continuity behavior

This slice should stop short of overbuilding a full scheduler worker if the
current channel feed logic can be extended incrementally.

Verified with:

- `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test videos --runInBand --testPathPattern=broadcast.service.spec.ts`
- `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test video-client --runInBand --testPathPattern='channel.component.spec.ts|local-browse.component.spec.ts'`
- `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx build videos --configuration=development`
- `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx build video-client --configuration=development`
- `pnpm run slice:checkpoint:dev`

### Slice 12: Live handoff foundations

**Status:** Done

**Goal:** Prepare the path from passive/local playback to live interaction.

Deliverables:

- Explicit live session state in viewer and creator flows
- Route/component contracts for handoff-ready playback
- Authentication and token contract groundwork for location-bound live access

This is the backend/frontend contract slice before a full WebRTC/live media UX.

Verified with:

- `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test videos --runInBand --testPathPattern=broadcast.service.spec.ts`
- `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test gateway --runInBand --testPathPattern=videos.controller.spec.ts`
- `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test video-client --runInBand --testPathPattern='app.routes.spec.ts|video.service.spec.ts|channel.component.spec.ts|my-channel.component.spec.ts'`
- `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx build videos --configuration=development`
- `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx build gateway --configuration=development`
- `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx build video-client --configuration=development`
- `pnpm run slice:checkpoint:dev`

### Slice 13: Business ad and sponsor inventory foundation

**Status:** Done

**Goal:** Extend Studio from page management into local commercial presence.

Delivered:

- Backward-compatible sponsor inventory extension on
  `community_sponsorships` with:
  - sponsor naming/tagline fields
  - CTA/image metadata
  - cross-app surface targeting
  - owner inventory lifecycle state
- New payments/gateway owner sponsor inventory CRUD surface while preserving
  legacy sponsorship checkout and active sponsorship reads
- Studio owner route and workspace page for managing sponsor inventory
- Development sponsor seed content for seeded business anchors
- Docker startup hardening so `db-setup` is force-recreated and reruns
  migrations before seeding when startup scripts run again

This should remain domain/model focused, not a full ad-injection engine yet.

Verified with:

- `pnpm exec jest -c apps/payments/jest.config.ts --runInBand apps/payments/src/app/staticDatabase.spec.ts apps/payments/src/app/services/payment.service.spec.ts`
- `pnpm exec jest -c libs/business-portal-ui/jest.config.ts --runInBand libs/business-portal-ui/src/lib/business-owner-sponsor-inventory-page.component.spec.ts libs/business-portal-ui/src/lib/business-portal-shell.component.spec.ts`
- `pnpm exec jest -c libs/business-data-access/jest.config.ts --runInBand libs/business-data-access/src/lib/business-api.service.spec.ts`
- `node --test scripts/tests/docker-service-planner.test.mjs`
- `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx build payments --configuration=development`
- `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx build gateway --configuration=development`
- `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx build business-site --configuration=development`
- `pnpm run docker:dev:up`
- `docker compose -f docker-compose.yaml -f docker-compose.dev.yaml exec -T business-site sh -lc 'cd /app/apps/business-site && GATEWAY_URL=http://gateway:3000/api node ./src/seed-business.mjs'`

### Slice 14: Local ad placement in MetroCast surfaces

**Status:** Done

**Goal:** Surface local business promotion inside MetroCast in a way that
matches the anchor/radius model.

Deliverables:

- Nearby sponsor placement in the MetroCast viewer home page
- Public, locality-aware active sponsor discovery with anchor/radius matching
- One sponsor card per business page, preferring MetroCast inventory over the
  cross-app fallback
- Hosted Studio business-site destinations where the sponsor business is in the
  local discovery result; the inventory CTA is used as a fallback
- Dev sponsor reseeding clears stale records when the one-business-per-community
  seed model repurposes a business page

Delivered:

- `GET /payments/sponsor-inventory/nearby` public gateway endpoint
- Payments sponsor selection limited to active `metro-cast` and `cross-app`
  inventory with anchored business pages inside the requested radius
- MetroCast `Local Sponsors` rail and a typed sponsor discovery client
- Shared `NearbySponsorDiscoveryDto` contract

Verified with:

- `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test payments --runInBand --testPathPattern=payment.service.spec.ts`
- `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test video-client --runInBand --testPathPattern='home.component.spec.ts|sponsor-discovery.service.spec.ts'`
- `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx run-many --target=build --projects=payments,gateway,video-client --configuration=development --parallel=3`
- `pnpm run docker:dev:seed` business-site seed stage
- Live local gateway request to `/api/payments/sponsor-inventory/nearby`
- `pnpm run slice:checkpoint:dev`

### Slice 15: Public locality hub convergence

**Status:** Done

**Goal:** Make locality pages in Towne Square feel like the umbrella hub for
all three tent poles.

Deliverables:

- City/locality page `Local Network` hub after the locality overview
- Towne Square conversation card that anchors to recent local discussions
- Nearby MetroCast channel cards resolved through the app registry
- Nearby Studio business cards using hosted business-site destinations
- Locality-anchor discovery from the city scope, without new city tables or
  duplicate cross-app data sources
- Local-hub Playwright configuration now uses the system Chrome channel

Verified with:

- `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test local-hub --runInBand`
- `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx build local-hub --configuration=development`
- Live-stack `local-hub-e2e` assertion for the public Local Network hub at a
  seeded city route
- `pnpm run slice:checkpoint:dev`

### Slice 16: Creator/business operational Studio convergence

**Status:** Done

**Goal:** Reduce the conceptual gap between creator operations and business
operations.

Deliverables:

- shared locality/discovery mental model in Studio flows
- business/creator crossovers where appropriate:
  - sponsored channel relationships
  - business-owned channels
  - creator-hosted local promotions

Current scope: Studio sponsor inventory can persist an optional MetroCast
channel relationship. This provides the targeting primitive while keeping
legacy, locality-only sponsorship inventory backward compatible.

### Slice 16.1: Campaign advertising replacement

**Status:** Done

**Goal:** Replace legacy sponsorship inventory with owner-managed advertising
campaigns that can independently purchase placements against multiple channels
and communities.

Deliverables:

- Campaign lifecycle, budget/date metadata, and one creative per placement type
- Target-placement line items allowing multiple channel/community targets
- Channel placements: pre-roll, mid-roll, post-roll, and on-page
- Community placements: on-page only
- Studio campaign editor with a target-placement matrix
- Unified campaign eligibility query for Local Hub and MetroCast on-page ads
- Removal of `community_sponsorships`, legacy sponsor APIs/UI/seeds, and all
  legacy advertising records without migration
- Evaluator guide and owner-to-viewer cross-app Playwright journey

Roll-placement records are persisted but not delivered until the broadcast
scheduler exists. Campaign activation is owner-managed; checkout, pacing,
impressions, and billing are deferred.

Validation completed July 11, 2026:

- Fresh development builds passed for `payments`, `gateway`, `local-hub`,
  `video-client`, and `business-site`.
- Focused payments, business data-access, Studio campaign, Local Hub, and
  MetroCast tests passed after stale sponsorship fixtures were removed.
- `pnpm run docker:dev:bootstrap` completed after making `db-setup` an
  unconditional startup prerequisite; campaign migration and seeds succeeded.
- Studio Playwright journey passed for multi-target creation, per-placement
  creative, edit, activate, pause, and archive.
- Towne Square Playwright journey passed for seeded city campaign delivery.
- Evaluator workflow is documented in
  `docs/guides/metrocast-locality-evaluator-guide.md`.

### Slice 17: Live media handoff implementation

**Status:** Done

**Goal:** Implement the PRD’s passive-to-live transition in a thin, testable
slice.

Deliverables:

- player state transitions
- live token issuance path
- viewer handoff experience from scheduled/local feed to live session

Implemented July 12, 2026:

- `POST /api/videos/channels/:slugOrId/live/token` issues a five-minute,
  session-bound opaque handoff token only while the channel feed is live.
- Scheduled, replay, offline, and ended feeds return an explicit unavailable
  handoff without credentials.
- MetroCast now uses a dedicated `/watch/live/:slugOrId` player route with
  loading, standby, connecting, live, ended, offline, and error states.
- A live source URL is rendered when supplied by the broadcaster; the player
  otherwise exposes the connected session state without pretending that a
  media transport exists.
- Focused videos, Gateway, and video-client tests passed, and production builds
  passed for all three affected projects.

Actual HLS/WebRTC ingestion, token verification at a media provider, and
automated playlist transitions remain intentionally deferred to Slices 18 and
the production media integration that follows them.

Validation reassessment, July 12, 2026:

- The viewer route, feed state transitions, and unavailable-state contract are
  implemented and smoke-tested.
- The original token was an unpersisted random UUID returned from a public
  endpoint, so it was neither verifiable nor enforceably bound to the active
  session.
- Remediation 17.1 completed: the token is now a signed HMAC capability with
  audience, community, active-session, issue-time, expiry, and nonce claims.
  `POST /api/videos/channels/:slugOrId/live/token/validate` verifies the
  signature, expiry, community, and current live session for a future media
  gateway. Production requires `LIVE_PLAYBACK_TOKEN_SECRET`; development may
  fall back to `JWT_SECRET` or a development-only secret.
- Remaining after 17.1: location policy enforcement and a real HLS/WebRTC
  transport adapter.
- Remediation 17.2 completed: MetroCast validates the signed capability before
  it enters the live playback state. Component coverage now exercises standby,
  successful live handoff, unavailable issuance, and stopped-session
  validation rejection. A focused Chromium Playwright journey uses deterministic
  API interception to verify the rendered live and ended states without
  mutating seed data.
- The direct Playwright command passes against the running stack:
  `SKIP_SETUP=true pnpm exec playwright test -c apps/video-client-e2e/playwright.config.ts --project=chromium --grep 'Live playback handoff'`.
  The checked-in Nx E2E wrapper currently fails while discovering unrelated
  Jest-style workspace tests; that runner configuration defect is outside this
  slice and must be corrected before Nx-native E2E status can be trusted.
- Remediation 17.3 completed: the videos service now produces a short-lived,
  subscriber-only LiveKit room credential after signed handoff validation when
  `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` are configured.
  The MetroCast player attaches validated LiveKit video tracks over its HLS
  fallback, then disconnects the room on route change or component teardown.
  Without a LiveKit configuration, the existing HLS source remains the only
  advertised playback path.
- Remediation 17.4 completed July 16, 2026: issuance and validation now require
  the same browser-provided coordinates, bind that pair into the signed token,
  and enforce a channel-anchor radius of 50 km by default
  (`LIVE_PLAYBACK_MAX_DISTANCE_KM` is configurable). Missing, invalid,
  unanchored, and out-of-radius requests receive explicit denial reasons.
  The live player requests browser geolocation only for this handoff and never
  uses the discovery fallback. This policy is explicitly
  `unverified-anchor-radius`; anti-spoofing remains Slice 20 work.

### Slice 18: Automated broadcast scheduling worker

**Status:** Done

**Goal:** Move from schedule-aware feeds to actual automated playlist
management.

Deliverables:

- scheduler worker
- playlist continuity logic
- rerun/filler/ad insertion priority rules

This is the main backend-heavy slice of the MetroCast PRD.

Implemented July 12, 2026:

- Added a Nest `BroadcastSchedulerService` worker that refreshes every
  channel feed on a configurable interval (15 seconds by default).
- Added `BroadcastService.refreshAllFeeds()` so scheduled blocks, replay
  continuity, ended live sessions, and feed transition timestamps are updated
  without requiring a viewer request.
- Added a pure `PlaylistGenerator` with deterministic precedence:
  live session, eligible ad break, scheduled program, rerun, configured filler,
  then offline.
- Added `BROADCAST_SCHEDULER_ENABLED`,
  `BROADCAST_SCHEDULER_INTERVAL_MS`, and `BROADCAST_FILLER_VIDEO_ID` runtime
  controls.
- The scheduler is explicitly safe to disable during maintenance and never
  overrides an active live session.
- Full videos tests and the development videos build passed. The running
  `ot_videos` container was rebuilt/restarted and remained healthy; Gateway
  feed smoke validation returned `200`.

The scheduler accepts an ad-break candidate but does not yet perform locality
target selection or campaign delivery. Slice 19 owns that targeting bridge;
the scheduler's precedence policy is the stable integration boundary.

Remediation 18.1 completed July 12, 2026:

- Each scheduler decision is now persisted on its `channel_feed` as the active
  playlist item, including kind, selection reason, optional ad placement/media,
  and decision time.
- Feed reads expose that projection through `activePlaylistItem`, giving the
  player and future delivery workers a durable current-state contract.
- Migration `1783600000000-persist-broadcast-playlist-decisions` creates the
  required columns through `db-setup`; no seed-time schema repair is used.
- Remaining Slice 18 remediation: prevent redundant decision writes, add a
  durable history/idempotency model, and consume the persisted item in playback.

Remediation 18.2 completed July 13, 2026:

- Scheduler decisions now compare their complete source selection before a
  write, so an unchanged tick does not rewrite the feed or move its decision
  timestamp.
- Changed selections append an immutable `playlist_decision_history` record
  with source session/block/video identifiers, placement, media, and decision
  time; the active feed projection carries the same source identifiers.
- Both playlist migrations are registered with the videos static datasource so
  `db-setup` applies them on a fresh or existing development database.
- MetroCast channel feeds render the persisted playlist kind and route a
  persisted program video to the existing watch player.

### Slice 19: Local ad targeting engine

**Status:** Done

**Goal:** Apply locality matching and delivery rules between campaign target
placements and creator/channel reach.

Deliverables:

- campaign ad selection rules using anchors/radius first
- optional polygon/geofence follow-up only if needed
- bridge from Studio-managed campaign inventory into MetroCast playback decisions

Implemented July 12, 2026:

- Added the payments playback eligibility contract for `pre-roll`, `mid-roll`,
  and `post-roll` placements.
- Eligibility requires an active campaign, an in-window campaign date, a
  direct channel/community target match, and a matching creative media URL.
- Returned candidates identify whether the locality match came from a channel
  anchor or community anchor; no city table or duplicated locality inventory
  was introduced.
- Connected the MetroCast scheduler to payments over the existing TCP service
  boundary. Scheduled feeds request pre-roll candidates; replay feeds request
  post-roll candidates.
- Live and offline feeds bypass ad selection. Payments failures degrade to the
  normal program/replay/filler path so ad infrastructure cannot create dead air.
- Playlist precedence remains live session, eligible ad, scheduled program,
  rerun, filler, then offline.

Remediation 19.1 completed July 16, 2026:

- Creatives now expose a placement-specific `mediaUrl`, validated as an
  absolute HTTPS URL. Migration `1785000000000-advertising-campaign-media-url`
  is registered with the payments datasource and applies through `db-setup`.
- Existing `imageUrl` records remain readable and normalize to `mediaUrl` for
  owner, on-page, and playback eligibility responses.
- Studio can edit and validate media per placement; Local Hub renders the
  normalized creative with an accessible sponsored CTA.
- The scheduler explicitly requests pre-roll for initial scheduled playback,
  stable mid-roll for an interrupted scheduled program, and post-roll for
  replay. Live sessions continue to bypass all campaign selection.

Upload/transcoding of ad media, impression pacing, billing, viewer-radius ad
selection, polygons/geofences, and locality anti-spoofing remain deferred to
the media delivery and locality trust work that follows.

### Slice 20: Proof-of-locality and anti-spoofing foundations

**Status:** Planned

**Goal:** Start the locality trust model without overcommitting to the full QR
system immediately.

Deliverables:

- telemetry validation primitives
- reputation/locality confidence model shape
- policy hooks for suspicious location changes

### Slice 21: QR and local engagement mechanics

**Status:** Planned

**Goal:** Add business-facing proof-of-locality interactions.

Deliverables:

- signed QR primitives
- check-in validation path
- business-side engagement hooks

### Slice 22: Final convergence and polish

**Status:** Planned

**Goal:** Make the three-app story coherent end-to-end.

Deliverables:

- cross-app navigation consistency
- terminology cleanup:
  - Towne Square
  - MetroCast / Tuner naming decision
  - Studio naming consistency
- seed/demo completeness across all three apps
- documentation refresh

---

## Decision Log

### Confirmed decisions

- We are not treating cities as the canonical database-backed locality source.
- We do still want seeded communities in development.
- City/locality display data can be enriched through an external API rather than
  fully owned internally.
- Businesses and channels should act as anchored locality entities, not just
  communities.
- Slices should remain small enough to complete in a single turn.

### Naming notes

- “MetroCast” is still provisional.
- “Towne Square” remains the social/local-hub expression.
- “Studio” / `business-site` currently covers the business side, but remaining
  creator-side convergence work may influence final naming.

---

## Update Rules

When a slice is started or completed, update this file before or alongside the
implementation.

Expected maintenance:

- mark the slice status
- add delivered files or notable endpoints
- record blockers or scope changes
- keep the “Next” slice accurate

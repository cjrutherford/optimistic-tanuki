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

**Status:** Next

**Goal:** Turn locality-aware discovery into an OTA-style browsing flow.

Deliverables:

- Local channel rail beyond homepage
- “On now / upcoming” sections using channel feed + schedule
- Better routing from discovery cards into live or scheduled viewing

This is the first slice that should make MetroCast feel like a real local tuner
instead of a generic video app with locality tags.

### Slice 11: Linear broadcast engine basics

**Status:** Planned

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

### Slice 12: Live handoff foundations

**Status:** Planned

**Goal:** Prepare the path from passive/local playback to live interaction.

Deliverables:

- Explicit live session state in viewer and creator flows
- Route/component contracts for handoff-ready playback
- Authentication and token contract groundwork for location-bound live access

This is the backend/frontend contract slice before a full WebRTC/live media UX.

### Slice 13: Business ad and sponsor inventory foundation

**Status:** Planned

**Goal:** Extend Studio from page management into local commercial presence.

Deliverables:

- Ad asset/business promotion domain shape
- Studio-side management primitives for local ad inventory
- Seed/demo content for fictitious sponsors or advertisers

This should remain domain/model focused, not a full ad-injection engine yet.

### Slice 14: Local ad placement in MetroCast surfaces

**Status:** Planned

**Goal:** Surface local business promotion inside MetroCast in a way that
matches the anchor/radius model.

Deliverables:

- Nearby sponsor or promoted-business placement in viewer UI
- Locality-aware sponsor selection
- Reuse business-site hosted presence as landing destination where possible

### Slice 15: Public locality hub convergence

**Status:** Planned

**Goal:** Make locality pages in Towne Square feel like the umbrella hub for
all three tent poles.

Deliverables:

- locality page sections for:
  - nearby conversations
  - nearby channels
  - nearby businesses
- cleaner cross-navigation between local-hub, MetroCast, and business-site

### Slice 16: Creator/business operational Studio convergence

**Status:** Planned

**Goal:** Reduce the conceptual gap between creator operations and business
operations.

Deliverables:

- shared locality/discovery mental model in Studio flows
- business/creator crossovers where appropriate:
  - sponsored channel relationships
  - business-owned channels
  - creator-hosted local promotions

### Slice 17: Live media handoff implementation

**Status:** Planned

**Goal:** Implement the PRD’s passive-to-live transition in a thin, testable
slice.

Deliverables:

- player state transitions
- live token issuance path
- viewer handoff experience from scheduled/local feed to live session

### Slice 18: Automated broadcast scheduling worker

**Status:** Planned

**Goal:** Move from schedule-aware feeds to actual automated playlist
management.

Deliverables:

- scheduler worker
- playlist continuity logic
- rerun/filler/ad insertion priority rules

This is the main backend-heavy slice of the MetroCast PRD.

### Slice 19: Local ad targeting engine

**Status:** Planned

**Goal:** Apply locality matching between business inventory and creator/channel
reach.

Deliverables:

- ad selection rules using anchors/radius first
- optional polygon/geofence follow-up only if needed
- bridge from Studio-managed ad inventory into MetroCast playback decisions

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

# Local Hub — Product Plan

## Overview

**Local Hub** is a new Angular SSR frontend application within the `optimistic-tanuki` Nx monorepo. It provides a _local-centric communities_ interface — a place for real people to connect within their geographic area (city, town, neighborhood) — with classifieds, moderation, buyer/seller messaging, and payment processing.

It is a sibling to `apps/client-interface` and reuses existing UI libs (`auth-ui`, `navigation-ui`, `theme-lib`, etc.) and backend services (gateway, authentication, social, chat, etc.).

---

## Product Requirements

### Core Rules

| Rule                                              | Detail                                                                                     |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Public landing page at `/`                        | Explains the platform; entry points to browse communities                                  |
| All communities publicly visible                  | Any visitor (anonymous) can browse communities, posts, and classifieds (read-only)         |
| Interactions locked to logged-in users            | Posting, commenting, messaging, creating classifieds, reacting require login               |
| Interactions additionally locked behind joining   | A logged-in user must **join** a community before they can interact                        |
| Communities are pre-seeded                        | Communities are curated by admins via seed scripts; users cannot create communities in MVP |
| Each local community includes classifieds         | A first-class classifieds module per community                                             |
| Buyer/seller communications                       | In-app messaging between buyers and sellers on classified listings                         |
| First-class moderation + reputation-based banning | Full reputation scoring, automated restrictions, mod queue, audit log                      |
| Payment processing                                | Featured listing fees; MVP: paid "feature this listing" via Stripe                         |

### Locality Model

Communities are tied to physical places:

- `localityType`: `city` | `town` | `neighborhood` | `county` | `region`
- `countryCode`, `adminArea` (state/province), `postalCodes[]` (optional)
- `geo`: `{ lat, lng }` (optional; enables distance filtering later)
- `slug`: URL-safe identifier (e.g., `portland-or`)

### Public vs. Gated UI Behavior

| Action                   | Anonymous           | Logged-in, not joined | Logged-in, joined |
| ------------------------ | ------------------- | --------------------- | ----------------- |
| Browse community list    | ✅                  | ✅                    | ✅                |
| View community page      | ✅                  | ✅                    | ✅                |
| View posts / classifieds | ✅                  | ✅                    | ✅                |
| Create post / comment    | ❌ → prompt sign-in | ❌ → prompt join      | ✅                |
| Create classified        | ❌ → prompt sign-in | ❌ → prompt join      | ✅                |
| Message a seller         | ❌ → prompt sign-in | ❌ → prompt join      | ✅                |
| Vote / react             | ❌ → prompt sign-in | ❌ → prompt join      | ✅                |
| Moderate                 | ❌                  | ❌                    | ✅ (if mod role)  |

Placeholder buttons are visible but display a prompt modal/tooltip; deep-linking to write routes redirects to login.

---

## Information Architecture & Routes

```
/                        Landing page (public)
/communities             Community directory (public)
/c/:slug                 Community home page (public)
/c/:slug/classifieds     Classifieds list for community (public)
/login                   Login (reuse auth-ui)
/register                Register (reuse auth-ui)
/c/:slug/join            Join community (requires login)
/c/:slug/classifieds/new New classified (requires login + membership)
/account                 Account settings (requires login)
/mod/:slug               Mod queue for community (requires mod role)
```

---

## Domain Models

### Community (extended)

```typescript
interface LocalCommunity {
  id: string;
  name: string;
  slug: string;
  description: string;
  localityType: 'city' | 'town' | 'neighborhood' | 'county' | 'region';
  countryCode: string;
  adminArea: string; // state / province
  city: string;
  postalCodes?: string[];
  geo?: { lat: number; lng: number };
  rules: string[];
  about: string;
  memberCount: number;
  createdAt: Date;
}
```

### Membership

```typescript
interface CommunityMembership {
  communityId: string;
  profileId: string;
  role: 'member' | 'moderator' | 'admin';
  status: 'active' | 'banned' | 'pending';
  joinedAt: Date;
}
```

### Classified Ad

```typescript
interface ClassifiedAd {
  id: string;
  communityId: string;
  profileId: string;
  title: string;
  description: string;
  price: number;
  currency: string; // 'USD'
  category: string;
  condition: 'new' | 'like_new' | 'good' | 'fair' | 'poor';
  images: string[]; // asset URLs
  status: 'active' | 'sold' | 'expired' | 'removed';
  featured: boolean;
  featuredUntil?: Date;
  location?: string; // more specific than community
  createdAt: Date;
  updatedAt: Date;
}
```

### Moderation

```typescript
interface Report {
  id: string;
  targetType: 'post' | 'comment' | 'classified' | 'profile';
  targetId: string;
  communityId: string;
  reporterProfileId: string;
  reason: string;
  details?: string;
  status: 'open' | 'triaged' | 'resolved' | 'dismissed';
  createdAt: Date;
}

interface ModerationAction {
  id: string;
  actionType: 'remove' | 'lock' | 'sticky' | 'ban' | 'unban' | 'warn' | 'approve';
  actorProfileId: string;
  targetProfileId?: string;
  targetContentId?: string;
  communityId: string;
  reason: string;
  notes?: string;
  timestamp: Date;
}
```

### Reputation Score

```typescript
interface ReputationScore {
  profileId: string;
  communityId?: string; // null = global score
  score: number; // baseline 0; positive/negative weighted events
  lastCalculated: Date;
  signals: ReputationSignal[];
}

interface ReputationSignal {
  type: ReputationSignalType;
  weight: number; // positive or negative
  occurredAt: Date;
  decaysAt?: Date; // time-based decay
}

type ReputationSignalType = 'content_removed' | 'report_received' | 'report_validated' | 'spam_detected' | 'new_account' | 'verified_email' | 'positive_rating' | 'successful_transaction' | 'payment_chargeback';
```

---

## Reputation-Based Banning Algorithm

### Scoring

- **Global trust score** (platform-level) and **community trust score** (per community).
- Start at baseline `0`.
- Events add/subtract weighted values. Weights decay over time (half-life configurable per event type).
- Example weights:

| Signal                                   | Weight |
| ---------------------------------------- | ------ |
| Verified email                           | +10    |
| Account age > 30 days                    | +5     |
| Content removed by mod                   | -15    |
| Validated report received                | -10    |
| Successful transaction / positive rating | +8     |
| Payment chargeback                       | -25    |
| Spam burst detected                      | -20    |

### Thresholds & Actions (progressive)

| Score range | Restriction                                                       |
| ----------- | ----------------------------------------------------------------- |
| > -10       | None                                                              |
| -10 to -25  | Slow mode (rate-limited posting)                                  |
| -25 to -40  | Require mod approval for posts/listings                           |
| -40 to -60  | Shadow-limit classifieds visibility                               |
| -60 to -80  | Temporary ban (community-level; duration scales with score)       |
| < -80       | Permanent ban (community-level; global ban requires human review) |

### Moderator Override

Moderators can:

- Manually adjust score with a reason (audited).
- Override ban to pardon or extend duration.
- View the full signal history for a user.

All moderation actions write to an immutable audit log.

---

## Payments

### Provider

**Stripe** (US-first MVP). Multi-country expansion possible via Stripe's international support.

### MVP Payment Features

1. **"Feature this listing"** — pay to promote a classified ad for 3/7/14 days.
2. Prices are community-configurable (default: $1.99/3 days, $3.99/7 days, $6.99/14 days).

### Architecture

- New `payments` NestJS microservice OR a `payments` module added to an existing service.
- Gateway routes `/api/payments/*`.
- Stores: customer ID per profile, payment intents, purchases, webhook events.
- Webhooks are mandatory (reconciliation even if client disconnects).
- Abuse control: block featured purchase if user is under active moderation restriction.
- Payment chargebacks generate a negative reputation signal.

### Classified Listings

- Free listings are allowed (no per-listing fee in MVP).
- Featured listings require payment.
- Open question: add per-listing fee in future to reduce spam.

---

## Phased Implementation Plan

### Phase 0 — Architecture & Scaffolding (Current)

**Goal:** New app exists, compiles, and serves.

**Deliverables:**

- `apps/local-hub` Angular SSR app with Express proxy.
- Minimal routes: `/`, `/communities`, `/c/:slug`, `/c/:slug/classifieds`.
- Placeholder page components (no real data).
- Placeholder gated-interaction buttons (prompt sign-in/join but no logic).
- `docs/plans/local-hub/README.md` (this document).

**Acceptance Criteria:**

- `npx nx build local-hub` succeeds.
- `npx nx serve local-hub` serves the app on `localhost:4201`.
- Anonymous users can see all placeholder pages.
- Gated buttons are visible and show a placeholder prompt.

---

### Phase 1 — Public Browsing (Read-Only Data)

**Goal:** Real data from the API; anonymous users see live communities/classifieds.

**Deliverables:**

- Community service (HTTP client wrapper) in local-hub.
- Community directory page fetches `/api/communities` list.
- Community page fetches `/api/communities/:slug`.
- Classifieds page fetches `/api/communities/:slug/classifieds`.
- Public read endpoints confirmed to work without auth token.

**Acceptance Criteria:**

- An anonymous visitor can browse all seeded communities and classifieds.
- No auth-guarded API calls on read paths.

---

### Phase 2 — Auth & Join-to-Interact

**Goal:** Login/register works; joining is enforced before interactions.

**Deliverables:**

- Login/register pages (reuse `auth-ui`).
- Auth interceptor (reuse from client-interface pattern).
- Join/unjoin community flow.
- Route guards redirect unauthenticated users to login.
- Gated buttons check join status; show join-prompt modal if not joined.

**Acceptance Criteria:**

- Logged-in user who has not joined a community cannot create posts/classifieds.
- Joining a community unlocks interaction UI.

---

### Phase 3 — Classifieds & Buyer/Seller Messaging

**Goal:** Full classifieds lifecycle with in-app messaging.

**Deliverables:**

- Create/edit/delete classified ad (auth + joined).
- Image upload via assets service.
- Listing status management (active/sold/expired/removed).
- "Contact Seller" button initiates a 1:1 conversation (reuse chat service).
- Messaging UI for classified conversations.

**Acceptance Criteria:**

- Joined user can create a classified with images.
- Another joined user can send a message to the seller from the listing.
- Seller receives and can reply to inquiries.

---

### Phase 4 — Moderation & Reputation

**Goal:** Full-featured, reputation-driven moderation.

**Deliverables:**

- Report flow for posts, comments, classifieds, users.
- Reputation scoring service (event-driven, with decay).
- Automated restrictions based on score thresholds.
- Mod queue UI (reports, auto-flagged content).
- Moderator actions (remove, lock, warn, ban with duration).
- Audit log (immutable; viewable by mods and admins).
- User-visible trust level (optional: show "trusted member" badge).

**Acceptance Criteria:**

- A user whose score drops below threshold is automatically restricted.
- Mod can override restrictions and see the full signal history.
- Every moderation action appears in the audit log.

---

### Phase 5 — Payments (Featured Classifieds)

**Goal:** Users can pay to feature a classified listing.

**Deliverables:**

- Stripe integration (backend payments service).
- "Feature this listing" UI on the classified detail page.
- Duration selection (3/7/14 days) + price display.
- Stripe Checkout or Elements flow.
- Webhook reconciliation (mark listing as featured on payment success).
- Block featured purchase if user is under active restriction.
- Chargeback → negative reputation signal.

**Acceptance Criteria:**

- User completes payment; listing is marked featured.
- System correctly processes webhook events even if browser is closed.
- Chargebacks are logged and impact reputation score.

---

## Implementation Status

### Phase Summary

| Phase                                          | Status         | Notes                                                                             |
| ---------------------------------------------- | -------------- | --------------------------------------------------------------------------------- |
| Phase 0 — Architecture & Scaffolding           | ✅ Complete    | App scaffolded, all routes implemented, placeholder pages built                   |
| Phase 1 — Public Browsing (Read-Only Data)     | ✅ Complete    | Community service uses real API calls (`/api/communities`), pages fetch live data |
| Phase 2 — Auth & Join-to-Interact              | ✅ Complete    | Login/register, auth interceptor, join/unjoin flow, MemberGuard, account page with memberships |
| Phase 3 — Classifieds & Buyer/Seller Messaging | ❌ Not Started | Create/edit/delete classifieds, messaging UI not implemented                      |
| Phase 4 — Moderation & Reputation              | ❌ Not Started | Report flow, reputation scoring, mod queue not implemented                        |
| Phase 5 — Payments (Featured Classifieds)      | ❌ Not Started | Stripe integration not implemented                                                |

### Completed Deliverables

**Phase 0:**

- `apps/local-hub` Angular SSR app with Express proxy (`server.ts`)
- Routes: `/`, `/cities`, `/city/:slug`, `/communities`, `/c/:slug`, `/c/:slug/classifieds`, `/login`, `/register`, `/account`
- Page components: Landing, Cities, City, Communities, Community, Classifieds, Login, Register, Account
- Auth guard (`guards/auth.guard.ts`) - protects `/account` route
- Auth services: `auth-state.service.ts`, `authentication.service.ts`, `auth.interceptor.ts`
- Community service (`services/community.service.ts`) with API integration
- Theme toggle and map components

**Phase 1:**

- `CommunityService` fetches from `/api/communities`
- Real data displayed on communities directory and community pages
- Cities page with city data
- Public read endpoints work without auth

### Remaining Work

- Join/unjoin community flow
- Route guards for join-status checking on gated interactions
- Classified CRUD operations (create/edit/delete)
- Image upload integration
- "Contact Seller" messaging flow
- Report flow
- Reputation scoring service
- Mod queue UI
- Stripe payments integration

---

## Open Questions

| #   | Question                       | Notes                                                          |
| --- | ------------------------------ | -------------------------------------------------------------- |
| 1   | Payments geography             | US-first (Stripe); international expansion later               |
| 2   | Free vs. paid listings         | MVP: free listings; featured paid. Per-listing fee TBD         |
| 3   | Messaging attachments          | MVP: text-only. Images in Phase 3+                             |
| 4   | Reputation transparency        | Users see their own trust level; detailed signals are mod-only |
| 5   | Appeals workflow               | Post-MVP                                                       |
| 6   | Community category taxonomy    | To be defined before Phase 1 seed script                       |
| 7   | Locality hierarchy             | City-level for MVP; neighborhood sub-communities later         |
| 8   | Seeded community dataset       | US cities first; need curated list                             |
| 9   | Cross-community "near me" feed | Phase 2+ feature                                               |
| 10  | Automod / keyword filters      | Phase 4+ feature                                               |

---

## Technical Notes

### App Structure

```
apps/local-hub/
  src/
    server.ts              # Express SSR + proxy
    main.ts                # Browser bootstrap
    main.server.ts         # Server bootstrap
    index.html
    styles.scss
    test-setup.ts
    app/
      app.component.ts     # App shell
      app.config.ts        # Browser providers
      app.config.server.ts # Server providers
      app.routes.ts        # Route definitions
      app.routes.server.ts # Server render modes
      pages/
        landing/           # / route
        communities/       # /communities route
        community/         # /c/:slug route
        classifieds/       # /c/:slug/classifieds route
      guards/
        auth.guard.ts      # Redirect to /login if not authenticated
      services/
        community.service.ts
        classified.service.ts
        auth-state.service.ts
```

### Reused Libraries

| Library                              | Usage                            |
| ------------------------------------ | -------------------------------- |
| `@optimistic-tanuki/auth-ui`         | Login/register blocks            |
| `@optimistic-tanuki/navigation-ui`   | App bar, nav sidebar             |
| `@optimistic-tanuki/theme-lib`       | Theme service + CSS variables    |
| `@optimistic-tanuki/common-ui`       | Card, Button, DevInfo            |
| `@optimistic-tanuki/chat-ui`         | Buyer/seller messaging (Phase 3) |
| `@optimistic-tanuki/notification-ui` | Notification bell (Phase 2+)     |
| `@optimistic-tanuki/community-ui`    | Community card components        |
| `@optimistic-tanuki/message-ui`      | Toast/snack messages             |
| `@optimistic-tanuki/ui-models`       | Shared DTOs                      |

### Proxy Configuration (server.ts)

```typescript
// /socket.io → gateway WS
// /chat      → gateway WS
// /api       → gateway HTTP
```

Matches the `client-interface` server.ts pattern exactly.

# Local Hub (Towne Square) — Complete Guide

This guide covers the full **Local Hub** application: its pages, services, data seeding process,
business-page features, sponsorships, community-manager elections, image-data pipeline, and
deployment notes.

The Local Hub front-end is an Angular SSR application named **Towne Square** and lives at
`apps/local-hub/`. It is backed by the shared microservice stack (gateway, social, payments,
classifieds, assets, authentication, profile, chat-collector).

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Application Pages & Routes](#2-application-pages--routes)
3. [Services](#3-services)
4. [Data Seeding](#4-data-seeding)
5. [Business Pages](#5-business-pages)
6. [Community Sponsorships](#6-community-sponsorships)
7. [Community Manager Elections](#7-community-manager-elections)
8. [Image Data Pipeline](#8-image-data-pipeline)
9. [API Gateway Endpoints](#9-api-gateway-endpoints)
10. [Shared UI Library (`community-ui`)](#10-shared-ui-library-community-ui)
11. [Docker & Deployment](#11-docker--deployment)
12. [Environment Variables](#12-environment-variables)

---

## 1. Architecture Overview

```
User Browser
     │
     ▼
[local-hub-client-interface]   :8087  (Angular SSR / Node.js)
     │ HTTP + WebSocket
     ▼
[gateway]                      :3000 REST  /  :3300 WebSocket
     │ TCP microservice messages
     ├─▶ authentication         :3001
     ├─▶ profile                :3002
     ├─▶ social                 :3003   (communities, posts, elections)
     ├─▶ assets                 :3005
     ├─▶ classifieds            :3017
     └─▶ payments               :3018   (donations, business pages, sponsorships)
              │
              ▼
        [PostgreSQL]           shared database  ot_local_hub
```

**Key design decisions:**

- The Angular app talks only to the gateway — never directly to microservices.
- Every HTTP call is prefixed `/api` which the gateway strips before routing.
- WebSocket connections for real-time chat use `socket.io` on `/chat`.
- Locality communities (cities, neighborhoods) are system-managed; interest communities
  are user-created and must have a `parentId` pointing to a locality.

---

## 2. Application Pages & Routes

All routes are lazily loaded. File: `apps/local-hub/src/app/app.routes.ts`.

| Route | Component | Guard | Description |
|-------|-----------|-------|-------------|
| `/` | `LandingComponent` | — | Homepage: hero cities grid, stats, feature highlights |
| `/cities` | `CitiesComponent` | — | Interactive map + card grid of all supported cities |
| `/city/:slug` | `CityComponent` | — | City detail: hero image, highlights, posts, businesses, sub-communities, map |
| `/city/:slug/classifieds` | `ClassifiedsComponent` | — | Browse classifieds scoped to a city |
| `/city/:slug/classifieds/new` | `ClassifiedsComponent` | `MemberGuard` | Post a new classified (requires membership) |
| `/city/:slug/classifieds/:id` | `ClassifiedDetailComponent` | — | View classified item, make/manage offers |
| `/communities` | `CommunitiesComponent` | — | Browse non-city communities (interest groups) |
| `/c/:communitySlug` | `CommunityComponent` | — | Community detail: join, posts, chat, members, business, election |
| `/c/:communitySlug/classifieds` | `ClassifiedsComponent` | — | Browse classifieds within a community |
| `/c/:communitySlug/classifieds/new` | `ClassifiedsComponent` | `MemberGuard` | Post classified within community |
| `/c/:communitySlug/classifieds/:id` | `ClassifiedDetailComponent` | — | View classified in community context |
| `/login` | `LoginComponent` | — | User login |
| `/register` | `RegisterComponent` | — | New user registration |
| `/account` | `AccountComponent` | `AuthGuard` | Manage profile, memberships, theme |
| `/seller-dashboard` | `SellerDashboardComponent` | `AuthGuard` | Seller earnings, wallet, payout settings |
| `/messages` | `MessagesComponent` | `AuthGuard` | Direct-message inbox |
| `/messages/new` | `NewMessageComponent` | `AuthGuard` | Start a new DM conversation |
| `**` | redirect to `/` | — | 404 catch-all |

### Guards

| Guard | File | Purpose |
|-------|------|---------|
| `AuthGuard` | `guards/auth.guard.ts` | Redirects unauthenticated users to `/login` |
| `MemberGuard` | `guards/member.guard.ts` | Ensures user is a member of the target community before allowing classified posting |

---

## 3. Services

All services live in `apps/local-hub/src/app/services/`.

### 3.1 `CommunityService`

The core data-access layer for localities, sub-communities, posts, cities, and elections.

**Locality / Community Methods**

| Method | HTTP | Endpoint | Description |
|--------|------|----------|-------------|
| `getCommunities()` | GET | `/communities` | All locality communities |
| `getCommunityBySlug(slug)` | GET | `/communities/:slug` | Single community by slug |
| `getSubCommunities(parentId)` | GET | `/communities/:id/sub-communities` | Child communities |
| `joinCommunity(id)` | POST | `/communities/:id/join` | Join a community |
| `leaveCommunity(id)` | DELETE | `/communities/:id/membership` | Leave a community |
| `isMember(id)` | GET | `/communities/:id/membership` | Membership check |
| `createCommunity(data)` | POST | `/communities` | Create interest community (requires `parentId`) |
| `getMyMemberships()` | GET | `/social/community/user/communities` | Authenticated user's communities |

**City Helper Methods** (pure, no extra HTTP round-trip)

| Method | Description |
|--------|-------------|
| `getCitiesFromCommunities(list)` | Derives `City[]` from an existing community list |
| `getCities()` | Fetches communities then derives cities |
| `getCityBySlug(slug)` | Gets a single `City` by slug |
| `getCommunitiesForCity(citySlug)` | All communities belonging to a city (city + sub-communities + legacy data) |

**Post Methods**

| Method | HTTP | Endpoint | Description |
|--------|------|----------|-------------|
| `getPostsForCity(citySlug)` | POST | `/social/post/find` | Posts for all communities in a city |
| `getPostsForCommunity(slug)` | POST | `/social/post/find` | Posts for a single community |
| `createPost(data)` | POST | `/social/post` | Create a new post |

**Election Methods**

| Method | HTTP | Endpoint | Description |
|--------|------|----------|-------------|
| `getCommunityManager(id)` | GET | `/communities/:id/manager` | Currently elected manager |
| `getActiveElection(id)` | GET | `/communities/:id/election` | Active election or `null` |
| `nominateForManager(id, nomineeId?)` | POST | `/communities/:id/election/nominate` | Self-nominate or nominate another |
| `voteForManager(id, candidateUserId)` | POST | `/communities/:id/election/vote` | Cast a vote |

### 3.2 `PaymentService`

Handles all monetary operations. See also [Section 5 (Business Pages)](#5-business-pages) and
[Section 6 (Sponsorships)](#6-community-sponsorships).

**Donation Methods**

| Method | HTTP | Endpoint | Description |
|--------|------|----------|-------------|
| `getDonationGoal(month?, year?)` | GET | `/donations/goal` | Current donation goal |
| `getMonthlyDonations(month?, year?)` | GET | `/donations` | Donations for a month |
| `createDonationCheckout(amount, recurring)` | POST | `/payments/donations/checkout` | Initiate donation checkout |
| `getUserDonations()` | GET | `/payments/donations/user` | User's donation history |
| `cancelRecurringDonation(subscriptionId)` | DELETE | `/payments/donations/subscription/:id` | Cancel recurring donation |

**Classified Payment Methods**

| Method | HTTP | Endpoint | Description |
|--------|------|----------|-------------|
| `createClassifiedPayment(classifiedId, method)` | POST | `/payments/classifieds/payment` | Initiate classified transaction |
| `confirmOutOfPlatformPayment(paymentId, proofUrl?)` | POST | `/payments/classifieds/payment/:id/confirm` | Mark as paid (cash/external) |
| `confirmPaymentReceived(paymentId)` | POST | `/payments/classifieds/payment/:id/release` | Seller confirms receipt |
| `disputePayment(paymentId, reason)` | POST | `/payments/classifieds/payment/:id/dispute` | Dispute a transaction |
| `getPayment(id)` | GET | `/payments/classifieds/payment/:id` | Fetch transaction |
| `getUserPayments()` | GET | `/payments/classifieds/payments/user` | All user transactions |

**Offer Methods**

| Method | HTTP | Endpoint | Description |
|--------|------|----------|-------------|
| `createOffer(classifiedId, sellerId, amount, msg?)` | POST | `/payments/offers` | Make an offer |
| `acceptOffer(offerId)` | PATCH | `/payments/offers/:id/accept` | Accept offer |
| `rejectOffer(offerId)` | PATCH | `/payments/offers/:id/reject` | Reject offer |
| `counterOffer(offerId, amount, msg?)` | PATCH | `/payments/offers/:id/counter` | Counter-offer |
| `withdrawOffer(offerId)` | PATCH | `/payments/offers/:id/withdraw` | Withdraw offer |
| `getOffersForClassified(id)` | GET | `/payments/offers/classified/:id` | All offers on a listing |
| `getUserOffers()` | GET | `/payments/offers/user` | User's sent/received offers |

**Seller Wallet Methods**

| Method | HTTP | Endpoint | Description |
|--------|------|----------|-------------|
| `getSellerWallet()` | GET | `/payments/seller/wallet` | Wallet balance and info |
| `updateSellerPayoutInfo(method, ...)` | PATCH | `/payments/seller/wallet/payout-info` | Set payout method |
| `createPayoutRequest(amount, method, ...)` | POST | `/payments/seller/payout` | Request a payout |
| `getSellerPayoutRequests()` | GET | `/payments/seller/payouts` | Payout request history |
| `cancelPayoutRequest(id)` | DELETE | `/payments/seller/payout/:id` | Cancel payout request |
| `getSellerEarningsSummary()` | GET | `/payments/seller/earnings` | Earnings totals |

### 3.3 `ChatService`

WebSocket-based real-time messaging using `socket.io`.

- **Connection URL**: `/chat` with path `/socket.io` and `websocket` transport
- Uses `GATEWAY_WS_URL` environment variable

| Method | Socket Event | Description |
|--------|-------------|-------------|
| `getOrCreateDirectChat(participantIds)` | `get_or_create_direct_chat` | Open / fetch a DM conversation |
| `getCommunityChat(communityId)` | `get_or_create_community_chat` | Community group chat |
| `sendMessage(convId, content, recipients)` | `send_message` | Send a message |
| `getMessages(convId, limit?, offset?)` | `get_messages` | Fetch message history |
| `getConversations()` | `get_conversations` | List all conversations |
| `subscribeToMessages(convId)` | `new_message` | Observable of incoming messages |
| `deleteConversation(convId)` | `delete_conversation` | Remove a conversation |

### 3.4 `AssetService`

Handles file uploads for community images, classifieds, business logos, etc.

| Method | HTTP | Endpoint | Description |
|--------|------|----------|-------------|
| `createAsset(dto)` | POST | `/asset` | Upload a file (base64 encoded) |
| `getAssetUrl(id)` | GET | `/asset/:id` | Get the served URL of an asset |

Supported types: `png`, `jpg`, `jpeg`, `gif`, `webp`.

Assets uploaded this way are stored by the **assets microservice** and returned as
`/api/asset/:id` URLs.

### 3.5 `AuthStateService`

Persists authentication state in `localStorage` under the key `ot-local-hub-authToken`.

Key members:

| Method / Property | Description |
|-------------------|-------------|
| `login(email, password)` | Authenticates and stores the JWT |
| `logout()` | Clears token and auth state |
| `setToken(token)` | Decodes and stores a JWT |
| `getToken()` | Retrieves the stored JWT |
| `getUserData()` | Returns `{userId, profileId, name, email}` from the decoded token |
| `isAuthenticated$` | Observable boolean — subscribe for real-time auth state changes |
| `getActingProfileId()` | Returns `profileId` (or `userId` as fallback) |

### 3.6 `AuthenticationService`

Thin wrapper around the authentication microservice for register/login flows.

| Method | HTTP | Endpoint |
|--------|------|----------|
| `register(data)` | POST | `/authentication/register` |
| `login(data)` | POST | `/authentication/login` |

---

## 4. Data Seeding

The seed script at `apps/local-hub/src/seed-http.ts` populates a fresh database with demo
data for all local-hub features. It reads geographic data from
`apps/local-hub/src/data/seed-cities.json`.

### 4.1 Running the Seed Script

**Locally (TypeScript):**
```bash
GATEWAY_URL=http://localhost:3000/api pnpm exec ts-node apps/local-hub/src/seed-http.ts
```

**In Docker (after building):**
```bash
docker compose exec local-hub-client-interface node /usr/src/app/seed-http.js
```

**Environment variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `GATEWAY_URL` | `http://localhost:3000/api` | Base URL for all API calls |
| `API_URL` | (fallback) | Alternative API base URL |
| `APP_SCOPE` | `local-hub` | App scope sent on every post/community request |

### 4.2 Seed Data File (`seed-cities.json`)

Structure:
```json
{
  "cities": [
    {
      "name": "Savannah, GA",
      "slug": "savannah-ga",
      "localityType": "city",
      "city": "Savannah",
      "state": "GA",
      "lat": 32.0809,
      "lng": -81.0912,
      "population": 147088,
      "imageUrl": "https://images.unsplash.com/...",
      "description": "Georgia's first city...",
      "timezone": "America/New_York",
      "highlights": [
        {
          "headline": "Forsyth Park",
          "link": "https://visitsavannah.com/forsyth-park",
          "imageUrl": "https://images.unsplash.com/..."
        }
      ]
    }
  ],
  "communities": {
    "savannah-ga": [
      {
        "name": "Historic District",
        "slug": "savannah-historic-district",
        "description": "The heart of Savannah...",
        "imageUrl": "https://images.unsplash.com/..."
      }
    ]
  }
}
```

**Included cities:**

| City | State | Population | Timezone |
|------|-------|-----------|---------|
| Savannah | GA | 147,088 | America/New_York |
| Charleston | SC | 155,369 | America/New_York |
| Jacksonville | FL | 911,507 | America/New_York |
| Columbia | SC | — | America/New_York |
| Hinesville | GA | — | America/New_York |

Each city has 4–6 neighborhood entries in the `communities` object.

### 4.3 Seeding Process — Step by Step

#### Step 1 — Register & Authenticate 5 Demo Users

The script creates 5 users in sequence:

| Index | Name | Email | Community |
|-------|------|-------|-----------|
| 0 | Alex Rivera | alex.rivera@example.com | Savannah Foodie Network |
| 1 | Jordan Chen | jordan.chen@example.com | Savannah Tech Hub |
| 2 | Maya Williams | maya.williams@example.com | Charleston Beach Lovers |
| 3 | Carlos Martinez | carlos.martinez@example.com | Hinesville Military Veterans |
| 4 | Emma Johnson | emma.johnson@example.com | Savannah Book Club |

For each user:
1. `POST /authentication/register` — create account with name, email, password, bio
2. `POST /authentication/login` — obtain JWT token
3. `GET /authentication/me` — retrieve `userId`
4. `GET /profile/me` — retrieve `profileId`

All subsequent requests for that user use the JWT in the `Authorization: Bearer …` header.

#### Step 2a — Create City Communities

For each city in `seed-cities.json`:

1. Attempt `GET /communities/:slug` — skip creation if already exists.
2. Otherwise `POST /social/community` with:
   - `localityType: 'city'`
   - `slug`, `name`, `description`
   - `lat`, `lng`, `population`
   - `countryCode: 'US'`, `adminArea` (state abbreviation)
   - `imageUrl` — Unsplash cover image URL
   - `timezone` — IANA identifier (e.g., `America/New_York`)
   - `highlights` — array of `{headline, link, imageUrl}` objects
   - `tags: ['Community', 'Local', 'Events']`
   - `isPrivate: false`, `joinPolicy: 'public'`
   - `appScope: 'local-hub'`
3. Saved to an in-memory `Map<slug, Community>` for later use as `parentId`.

#### Step 2b — Create Neighborhood Communities

For each city's neighborhood list:

1. Attempt `GET /communities/:slug` — skip if exists.
2. `POST /social/community` with:
   - `localityType: 'neighborhood'`
   - `parentId: <parent city community id>`
   - `lat`, `lng` — city coordinates ± small random offset
   - `population` — random 5,000–35,000
   - `imageUrl` — Unsplash neighborhood image URL
   - All other fields same as city (tags, isPrivate, joinPolicy, appScope)

#### Step 3 — Create User Communities, Posts & Classifieds

For each of the 5 demo users:

**3a. Create user-owned interest community**
- `POST /social/community` with the user's JWT
- `localityType: 'neighborhood'` (user communities use this type)
- `parentId` pointing to the appropriate city community
- No `imageUrl` — user communities rely on `bannerAssetId`/`logoAssetId` for images

**3b. Join the community**
- `POST /social/community/:id/join`

**3c. Create 3 posts in the community**
- `POST /social/post` with `title`, `content` (HTML allowed), `communityId`, `profileId`, `appScope`

**3d. Create 2–3 classifieds**
- `POST /classifieds` with `title`, `description`, `price`, `currency`, `category`,
  `condition`, `communityId`, `profileId`, `imageUrls` (Unsplash URLs), `appScope`

**3e. Join the parent city community**
- `POST /social/community/:id/join`

#### Final Output

After a successful seed run the console prints all 5 users' credentials:

```
=== Seed Complete! ===

Test user credentials:
  alex.rivera@example.com / SeedPass123!  (profileId: xxx, userId: yyy)
  ...
```

---

## 5. Business Pages

Business pages allow local businesses to create a discoverable presence within their community.

### 5.1 Tiers

| Tier | Price | Features |
|------|-------|---------|
| **basic** | Free | Standard listing with name, description, contact info |
| **pro** | $29/mo | Featured placement, promoted posts, analytics dashboard |
| **enterprise** | $99/mo | Custom branding, multi-location support, API access, priority support |

### 5.2 Creating a Business Page

1. Navigate to a **City** or **Community** page.
2. Click **"List Your Business"** (visible to authenticated users).
3. Select a subscription tier and click **Checkout**.
4. Frontend calls `PaymentService.createBusinessPage(localityId, tier)`.
   - `POST /payments/business/checkout` → returns `{ checkoutUrl: string }`
5. User is redirected to the Lemon Squeezy checkout page.
6. On successful payment the backend creates the `BusinessPage` record and associates it
   with the locality.

### 5.3 Editing a Business Page

After creation, the owner edits the business profile from the **Community** page:

1. Click **"Edit Business Profile"** (visible only to the page owner).
2. A modal opens with fields: **Name**, **Description**, **Website**, **Phone**, **Email**, **Address**.
3. On save: `PaymentService.updateBusinessPage(communityId, data)`.
   - `PATCH /payments/business/:id`

### 5.4 Cancelling a Subscription

- `PaymentService.cancelBusinessSubscription(communityId)`.
- `DELETE /payments/business/:id/subscription`
- Cancels the Lemon Squeezy subscription; the `BusinessPage` record remains but its
  `subscriptionStatus` changes to `cancelled`.

### 5.5 `BusinessPage` Data Shape

```typescript
interface BusinessPage {
  id: string;
  userId: string;                                         // Owner
  localityId?: string;                                    // Associated locality
  communityId: string;                                    // Legacy compat field
  name: string;
  description?: string;
  logoUrl?: string;                                       // Hosted logo image
  website?: string;
  phone?: string;
  email?: string;
  address?: string;
  tier: 'basic' | 'pro' | 'enterprise';
  status: 'active' | 'past-due' | 'canceled' | 'trial';
  subscriptionStatus?: 'active' | 'inactive' | 'cancelled' | 'past-due';
  pinnedPostId?: string;                                  // Featured post
  badge?: string;                                         // Verification badge
  locations: string[];                                    // Multiple locations
  createdAt: string;
  updatedAt: string;
}
```

### 5.6 Checking Business Ownership

The `CommunityComponent` uses this helper to show/hide the business management UI:

```typescript
isBusinessOwner(): boolean {
  const page = this.businessPage();
  if (!page) return false;
  const userData = this.authState.getUserData();
  const actingProfileId = this.authState.getActingProfileId();
  return (
    page.userId === userData?.userId ||
    page.ownerId === userData?.userId ||
    page.userId === actingProfileId
  );
}
```

### 5.7 City Business Directory

The **City** page fetches all business pages for a city via:
```typescript
PaymentService.getCityBusinesses(cityId, communityIds?)
// GET /payments/business/city/:id
```
and renders them in a grid with logo, name, description, tier badge, and website link.

---

## 6. Community Sponsorships

Sponsorships allow businesses or individuals to promote content within a specific community
for a time-limited period.

### 6.1 Sponsorship Types

| Type | Display | Description |
|------|---------|-------------|
| `banner` | Full-width banner at top of community feed | Large visual placement |
| `sticky-ad` | Persistent top-of-feed sticky post | Fixed position as user scrolls |
| `featured` | "⭐ Featured Partner" badge in community header | Highlighted partnership mention |

### 6.2 Creating a Sponsorship

1. From the **Community** page, click **"Sponsor This Community"**.
2. Select type and optionally enter ad content.
3. Frontend calls `PaymentService.createSponsorship(communityId, type, adContent?)`.
   - `POST /payments/sponsorship/checkout` → returns `{ checkoutUrl: string }`
4. User completes payment in Lemon Squeezy.
5. Backend creates `CommunitySponsorship` with `paidAt` and `expiresAt` timestamps.

### 6.3 `CommunitySponsorship` Data Shape

```typescript
interface CommunitySponsorship {
  id: string;
  communityId: string;
  userId: string;
  type: 'sticky-ad' | 'banner' | 'featured';
  currency: string;
  status: 'active' | 'expired' | 'cancelled';
  adContent?: string;
  adImageUrl?: string;
  paidAt: string;
  expiresAt: string;
}
```

### 6.4 Displaying Sponsorships

The `SponsorshipBannerComponent` (shared component in `apps/local-hub/`) renders active
sponsorships by querying:
```typescript
PaymentService.getActiveSponsorships(communityId)
// GET /payments/sponsorship/:id/active
```
Only sponsorships with `status === 'active'` and `expiresAt > now` are displayed.

---

## 7. Community Manager Elections

Localities (cities, neighborhoods) support a democratic election system for choosing a
community manager.

### 7.1 Roles and Interfaces

**Currently Elected Manager:**
```typescript
interface CommunityManager {
  userId: string;
  profileId: string;
  name: string;
  electedAt: string;    // ISO timestamp
  termEndsAt: string;   // When the term expires
}
```

**Election:**
```typescript
interface CommunityElection {
  id: string;
  communityId: string;
  status: 'open' | 'closed' | 'pending';
  candidates: ElectionCandidate[];
  startedAt: string;
  endsAt: string;
  myVote?: string | null;   // candidateUserId the current user voted for
}
```

**Candidate:**
```typescript
interface ElectionCandidate {
  userId: string;
  profileId: string;
  name: string;
  nominatedAt: string;
  votes: number;
}
```

### 7.2 Election Lifecycle

```
[Manager Initiates]
    POST /communities/:id/election  { endsAt?: Date }
         │
         ▼
    status: 'open'
         │
[Community Members Nominate]
    POST /communities/:id/election/nominate  { nomineeId? }
    (omit nomineeId for self-nomination)
         │
         ▼
    Candidates list grows
         │
[Community Members Vote]
    POST /communities/:id/election/vote  { candidateUserId }
    (each member can vote once; tracked via myVote)
         │
         ▼
    Vote counts accumulate on each candidate
         │
[Manager Closes Election after endsAt]
    POST /communities/:id/election/close  { electionId }
         │
         ▼
    status: 'closed'
    Highest-vote-count candidate becomes CommunityManager
```

### 7.3 Checking Current Manager

On the **City** and **Community** pages the manager badge is displayed if set:
```typescript
CommunityService.getCommunityManager(communityId)
// GET /communities/:id/manager
// Returns CommunityManager | null
```

### 7.4 Direct Appointment (Admin Bypass)

Admins with the `community.manage` permission can appoint a manager directly without an
election:
```
POST /communities/:id/manager  { userId, profileId }
```

To revoke:
```
DELETE /communities/:id/manager
```

### 7.5 Required Permissions

| Action | Permission |
|--------|-----------|
| Start election | `community.manage` |
| Close election | `community.manage` |
| Appoint manager directly | `community.manage` |
| Revoke manager | `community.manage` |
| Nominate / Vote | Authenticated member |

---

## 8. Image Data Pipeline

Images flow through the system in two distinct modes:

### 8.1 Seeded Locality Images (Direct URLs)

City and neighborhood communities created by the seed script store **external Unsplash
URLs** directly in the `imageUrl` column of the `Community` entity.

```
seed-cities.json
  └── imageUrl (Unsplash URL)
        │
  POST /social/community  { imageUrl }
        │
  Community entity  { imageUrl: varchar, nullable }
        │
  GET /communities/:slug  → LocalCommunity { imageUrl }
        │
  Angular template  @if (imageUrl) { <img [src]="imageUrl"> }
```

**Key checkpoints:**

1. `seed-cities.json` — every city and neighborhood entry must have a non-empty `imageUrl`.
2. `Community` entity (`apps/social/src/entities/community.entity.ts`) — `imageUrl` column
   is `varchar, nullable`. Added in migration `1774000000000-community-image-timezone.ts`.
3. Social service `CommunityService.create()` — passes `dto.imageUrl ?? null` to the entity.
4. Gateway community controller — `imageUrl` is included in the `LocalCommunity` DTO
   response.
5. Angular `LocalCommunity` interface (`apps/local-hub/src/app/services/community.service.ts`)
   — declares `imageUrl?: string`.
6. Angular `CommunityDto` interface (`libs/ui-models/src/lib/ui-models/community.ts`) —
   declares `imageUrl?: string` (added to fix the break between the API response and
   community-ui components).

### 8.2 User-Uploaded Community Images (Asset Service)

Interest communities created by regular users use asset IDs rather than direct URLs.

```
User uploads file via UI
      │
  AssetService.createAsset(base64) → POST /asset
      │
  Returns assetId
      │
  Stored as bannerAssetId / logoAssetId on Community entity
      │
  Resolved to URL at display time: /api/asset/:id
```

### 8.3 Fallback Resolution Order

When displaying a community image in the `community-posts` component, the resolution
priority is:

1. `bannerAssetId` → `/api/asset/:id` (uploaded banner)
2. `bannerUrl` (direct URL stored on record)
3. `imageUrl` (locality cover image from seed data)

Logo resolution follows the same pattern using `logoAssetId` / `logoUrl` / `imageUrl`.

### 8.4 Template Guards

All `<img>` elements that bind to potentially-null image fields are wrapped in an `@if`
guard plus an `(error)` handler to prevent broken-image requests:

```html
@if (community()!.imageUrl) {
  <img
    [src]="community()!.imageUrl"
    [alt]="community()!.name"
    class="hero-image"
    (error)="$event.target.style.display='none'"
  />
}
```

This pattern is applied in:
- `apps/local-hub/src/app/pages/community/community.component.html`
- `apps/local-hub/src/app/pages/city/city.component.html`
- `apps/local-hub/src/app/pages/cities/cities.component.html`
- `apps/local-hub/src/app/pages/communities/communities.component.html`
- `apps/local-hub/src/app/pages/landing/landing.component.html`

### 8.5 `CityHighlight` Images

Each locality stores a `highlights` array (JSONB column). Each highlight has its own
`imageUrl`:

```typescript
interface CityHighlight {
  headline: string;
  link: string;
  imageUrl: string;
}
```

These are seeded from `seed-cities.json` and displayed as cards on the **City** page and
**Community** detail page. They are guarded in templates with `@if (highlight.imageUrl)`.

---

## 9. API Gateway Endpoints

### 9.1 Community Endpoints (`/communities`)

File: `apps/gateway/src/controllers/communities/communities.controller.ts`

| Method | Path | Auth | Permission | Description |
|--------|------|------|-----------|-------------|
| GET | `/communities` | Public | — | List all locality communities |
| GET | `/communities/:slug` | Public | — | Community by slug |
| GET | `/communities/:id/sub-communities` | Public | — | Child communities |
| GET | `/communities/:id/manager` | Public | — | Current elected manager |
| GET | `/communities/:id/election` | Public | — | Active election |
| GET | `/communities/:id/membership` | AuthGuard | — | Membership check |
| POST | `/communities/:id/join` | AuthGuard | — | Join community |
| DELETE | `/communities/:id/membership` | AuthGuard | — | Leave community |
| POST | `/communities/:id/election` | AuthGuard | `community.manage` | Start election |
| POST | `/communities/:id/election/nominate` | AuthGuard | — | Nominate candidate |
| POST | `/communities/:id/election/vote` | AuthGuard | — | Vote in election |
| POST | `/communities/:id/election/close` | AuthGuard | `community.manage` | Close election |
| POST | `/communities/:id/manager` | AuthGuard | `community.manage` | Appoint manager |
| DELETE | `/communities/:id/manager` | AuthGuard | `community.manage` | Revoke manager |

### 9.2 Social Community Endpoints (`/social/community`)

File: `apps/gateway/src/controllers/social/community/community.controller.ts`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/social/community` | AuthGuard | Create community |
| GET | `/social/community/:id` | Public | Get community by ID |
| GET | `/social/community/slug/:slug` | Public | Get community by slug |
| POST | `/social/community/search` | Public | Search communities |
| PUT | `/social/community/:id` | AuthGuard | Update community |
| DELETE | `/social/community/:id` | AuthGuard | Delete community |
| POST | `/social/community/:id/join` | AuthGuard | Join community |
| DELETE | `/social/community/:id/membership` | AuthGuard | Leave community |
| GET | `/social/community/user/communities` | AuthGuard | My communities |

### 9.3 Post Endpoints (`/social/post`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/social/post` | AuthGuard | Create post |
| POST | `/social/post/find` | Public | Find posts with criteria |
| GET | `/social/post/:id` | Public | Get post by ID |
| DELETE | `/social/post/:id` | AuthGuard | Delete post |

### 9.4 Payment Endpoints (`/payments`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/payments/donations/checkout` | AuthGuard | Initiate donation |
| GET | `/payments/donations/user` | AuthGuard | User donations |
| DELETE | `/payments/donations/subscription/:id` | AuthGuard | Cancel recurring |
| GET | `/donations/goal` | Public | Current donation goal |
| GET | `/donations` | Public | Monthly donations |
| POST | `/payments/business/checkout` | AuthGuard | Create business page |
| GET | `/payments/business/:id` | AuthGuard | Get business page |
| PATCH | `/payments/business/:id` | AuthGuard | Update business page |
| DELETE | `/payments/business/:id/subscription` | AuthGuard | Cancel business subscription |
| GET | `/payments/business/city/:id` | Public | City business directory |
| POST | `/payments/sponsorship/checkout` | AuthGuard | Create sponsorship |
| GET | `/payments/sponsorship/:id/active` | Public | Active sponsorships for community |
| GET | `/payments/sponsorship/user` | AuthGuard | User's sponsorships |
| POST | `/payments/offers` | AuthGuard | Make classified offer |
| PATCH | `/payments/offers/:id/accept` | AuthGuard | Accept offer |
| PATCH | `/payments/offers/:id/reject` | AuthGuard | Reject offer |
| PATCH | `/payments/offers/:id/counter` | AuthGuard | Counter offer |
| PATCH | `/payments/offers/:id/withdraw` | AuthGuard | Withdraw offer |
| GET | `/payments/offers/classified/:id` | Public | Offers for a classified |
| GET | `/payments/offers/user` | AuthGuard | User's offers |
| GET | `/payments/seller/wallet` | AuthGuard | Seller wallet |
| PATCH | `/payments/seller/wallet/payout-info` | AuthGuard | Update payout info |
| POST | `/payments/seller/payout` | AuthGuard | Request payout |
| GET | `/payments/seller/payouts` | AuthGuard | Payout history |
| DELETE | `/payments/seller/payout/:id` | AuthGuard | Cancel payout |
| GET | `/payments/seller/earnings` | AuthGuard | Earnings summary |
| GET | `/payments/portal` | AuthGuard | Lemon Squeezy customer portal URL |

---

## 10. Shared UI Library (`community-ui`)

The `libs/community-ui/` library provides reusable Angular components consumed by the
local-hub app and potentially other frontends.

### 10.1 Exported Components

| Component | Selector | Description |
|-----------|----------|-------------|
| `CommunityShellComponent` | `lib-community-shell` | Main layout wrapper with sidebar navigation for community views |
| `CreateCommunityComponent` | `lib-create-community` | Form for creating new interest communities with logo/banner upload |
| `FindCommunitiesComponent` | `lib-find-communities` | Search/discover communities with filters |
| `ManageGroupsComponent` | `lib-manage-groups` | Manage community groups and sub-communities |
| `ManageMembersComponent` | `lib-manage-members` | View, approve, and remove community members |
| `CommunityPostsComponent` | `lib-community-posts` | Post feed with compose, vote, and reaction support |
| `CommunityChatComponent` | `lib-community-chat` | Real-time community group chat via WebSocket |

### 10.2 Internal Services

- `CommunityService` (`libs/community-ui/src/lib/community-ui/services/community.service.ts`)
  — Calls `/api/social/community/*` endpoints and exposes CRUD methods for the above components.

### 10.3 Community Posts Display

`CommunityPostsComponent` resolves the community banner and logo with the following
fallback chain (see Section 8.3):

```typescript
const bannerUrl = community.bannerAssetId
  ? `/api/asset/${community.bannerAssetId}`
  : community.bannerUrl || community.imageUrl || undefined;

const logoUrl = community.logoAssetId
  ? `/api/asset/${community.logoAssetId}`
  : community.logoUrl || community.imageUrl || undefined;
```

### 10.4 Community Shell Sidebar Logo

`CommunityShellComponent` shows a community thumbnail in the sidebar using:

```html
@if (community.logoUrl || community.logoAssetId || community.imageUrl) {
  <img
    [src]="community.logoUrl || (community.logoAssetId
      ? '/api/asset/' + community.logoAssetId
      : community.imageUrl)"
    alt=""
    class="community-logo"
  />
}
```

---

## 11. Docker & Deployment

### 11.1 Local Hub in `docker-compose.yaml`

```yaml
local-hub-client-interface:
  container_name: ot_local_hub
  build:
    context: .
    dockerfile: ./apps/local-hub/Dockerfile
  ports:
    - '8087:4000'         # Access at http://localhost:8087
  environment:
    - GATEWAY_URL=http://gateway:3000
    - GATEWAY_WS_URL=http://gateway:3300
  depends_on:
    - gateway
```

### 11.2 Full E2E Stack (`docker-compose.local-hub-e2e.yaml`)

Runs the complete isolated stack for E2E testing:

| Service | Port | Role |
|---------|------|------|
| postgres | 5433 | Shared database |
| redis | 6380 | Cache / session store |
| db-setup | — | Schema init (one-shot) |
| authentication | 3001 | Auth microservice |
| profile | 3002 | Profile microservice |
| social | 3003 | Social microservice |
| assets | 3005 | Asset storage |
| classifieds | 3017 | Classifieds microservice |
| payments | 3018 | Payments microservice |
| gateway | 3000/3300/3301 | REST / WebSocket / health |
| local-hub-frontend | 8087 | Angular frontend |
| e2e-test-runner | — | Playwright test runner |

### 11.3 Starting the Stack

**Development (main stack):**
```bash
docker-compose up -d
```

**Development with hot reload:**
```bash
docker-compose -f docker-compose.yaml -f docker-compose.dev.yaml up -d
```

**E2E tests only:**
```bash
docker-compose -f docker-compose.local-hub-e2e.yaml up --abort-on-container-exit
```

### 11.4 Seeding After Stack Start

```bash
# Wait for services to be healthy, then run:
docker compose exec local-hub-client-interface \
  sh -c 'GATEWAY_URL=http://gateway:3000/api node /usr/src/app/seed-http.js'
```

---

## 12. Environment Variables

| Variable | Service | Default | Description |
|----------|---------|---------|-------------|
| `GATEWAY_URL` | local-hub frontend | `http://localhost:3000/api` | REST API base URL |
| `GATEWAY_WS_URL` | local-hub frontend | `http://localhost:3300` | WebSocket base URL |
| `APP_SCOPE` | seed script | `local-hub` | App scope tag sent with posts and communities |
| `DATABASE_URL` | all microservices | see docker-compose | PostgreSQL connection string |
| `REDIS_URL` | gateway, social | see docker-compose | Redis connection string |
| `LEMON_SQUEEZY_API_KEY` | payments | — | Payment processor API key |
| `LEMON_SQUEEZY_STORE_ID` | payments | — | Store identifier |
| `LEMON_SQUEEZY_WEBHOOK_SECRET` | payments | — | Webhook verification secret |

---

## See Also

- [`docs/LOCAL_HUB_COMMERCE.md`](../LOCAL_HUB_COMMERCE.md) — Commerce overview (donations, tiers, sponsorships summary)
- [`docs/devops/docker-compose.md`](../devops/docker-compose.md) — Docker Compose reference
- [`docs/architecture/permissions.md`](../architecture/permissions.md) — RBAC and permissions
- [`apps/local-hub/README.md`](../../apps/local-hub/README.md) — App-level README
- [`libs/community-ui/README.md`](../../libs/community-ui/README.md) — Community UI library README

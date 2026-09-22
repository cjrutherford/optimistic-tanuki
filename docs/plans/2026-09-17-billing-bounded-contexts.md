# Bounded-Context & Contract Clarity Plan (draft — planning only, no code changed)

Date: 2026-09-17
Branch: `chore/layer-clarify-db-per-service` (synced to `origin/main` @ `7e1d8740`)
Status: proposal. Nothing implemented. Migrations must use each owning service's Nx
`typeorm:migration:generate` target per repo rules; no hand-created migration files.
Scope started as billing (§1–§8) and was expanded to all domains (§9) plus the AI
orchestrator (§11). Filename keeps the original date slug so existing references don't break.

## 1. Verified statements

1. **Gateway is config-modular, monolith-looking from outside — TRUE.**
   - `apps/gateway/src/app/gateway-composition.ts`: `enabledServices[]`, `filterEnabledEntries()`,
     `loadGatewayCompositionFromFile(GATEWAY_COMPOSITION_PATH yaml)`.
   - `apps/gateway/src/app/app.module.ts:139-143`: composition loaded from
     `process.env.GATEWAY_COMPOSITION_PATH`, defaults to all 22 `gatewayServices`;
     controllers/providers are `ValueComposableEntry { id, requiredServices, value }`.
   - `apps/gateway/src/app/gateway-service-providers.ts:193-225`: disabled service yields
     `DisabledClientProxy` (fail-fast `Gateway service "x" is disabled`), enabled yields TCP `ClientProxy`.
   - Gap found while verifying: `gatewayServices` + provider definitions cover `store` and
     `finance`, but **neither `payments` nor `billing` has a provider entry**. The payments
     controller (`payments.controller.ts:105-128`) and donations controller
     (`donations.controller.ts:21-43`) construct TCP clients ad hoc via
     `ClientProxyFactory.create` instead of injected `ServiceTokens` providers, so they also
     bypass composition gating. `apps/billing` exists with a `BillingCommands` TCP handler
     (`apps/billing/src/app/app.controller.ts:19`) but has no gateway controller, no
     `gatewayServices` id, and no token — billing is unreachable through the gateway today.
2. **UI data-access should be generated from gateway OpenAPI — correct direction, NOT current state.**
   - Gateway emits Swagger (`apps/gateway/src/main.ts:49-65`, `/api-docs`) but there is no JSON
     export, no `orval`/`hey-api`/`openapi-generator` in `package.json`/`tools`/`scripts`, no codegen target.
   - UI libs hand-write `HttpClient` calls (`libs/business-data-access/.../business-api.service.ts:49`
     `/api/business`, `libs/app-config-data-access/.../app-discovery-api.service.ts:31`
     `/api/app-config`); `libs/billing-sdk/src/lib/billing-sdk.ts` is hand-written payload builders
     over `billing-contracts` types.
   - Only ~5 of 8 `data-access` projects are true UI clients; `billing/data-access`
     (`platform:server`) is backend entities; `fin-commander-data-access` is mistagged `type:ui`.
3. **Gateway↔microservice today is stringly-typed TCP.**
   - Gateway sends `ClientProxy.send({cmd}, payload)` with commands from `libs/constants`
     (`libs/constants/src/lib/libs/{store,billing}.ts`); backends handle
     `@MessagePattern({cmd})` (`apps/store/.../*.controller.ts`,
     `apps/payments/src/app/app.controller.ts:58`, `apps/finance/src/app/app.controller.ts:186`).
   - Shapes are validated twice or not at all (gateway `ValidationPipe`, microservice ad hoc).
   - Exemplar: `billing-contracts` + `billing-domain` (`assertBillingScope`) and `leads-contracts`
     with parity spec (`apps/lead-tracker/src/app/leads-contract-parity.spec.ts`) — imported by both sides.

## 2. Target bounded contexts

| Context                               | Owns                                                                                                                                                 | Does NOT own                                                 |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `payments` (money-in)                 | Provider webhooks (Lemon Squeezy), checkout sessions, payouts, `Donation`, classified payments, sponsorships                                         | Ledger accounting, metering/entitlement, catalog             |
| `billing` (metering/entitlement)      | Plans/prices, `BillingAccount`, `BillingSubscription`, `UsageEvent`/`UsageBlock`, `Invoice` preview (quote)                                          | Provider charge capture, ledger `Transaction`, store `Order` |
| `store` (catalog/orders/appointments) | Catalog, products, orders/order-items, appointments/availabilities/resources, trainer config, subscriptions **as product entitlements by reference** | `Donation` rows, `Invoice` ledger, `Transaction` ledger      |
| `finance` (ledger/planning)           | `Account`, `Transaction` (sole writer), budgets, recurring items, `FinancialInvoice` (receivable), tenants, fin-commander plans/scenarios            | Provider webhook verification, usage metering                |

Rule: one writer per table. Others reference by id or consume events.

Conventions used throughout this plan (same meaning in every section):

- **canonical** = the single owner of a concept; all other copies are removed or reduced to id references.
- **shim** = the old route stays for exactly one release as a `307` redirect (or in-place delegate)
  with a `Deprecation` header, then is removed in the cutover release (O14).
- **dual-write** = during the shim release the gateway handler writes the canonical store first,
  then the legacy reference; backfill migrates historical rows with idempotency keys preserved.
- **backfill** = a data migration with reversible `up`/`down`; schema changes via
  `typeorm:migration:generate`, data moves via `migration:create` only (repo rules).
- **parity spec** = a test asserting gateway DTO ↔ microservice payload equivalence in both
  directions plus `ValidationPipe` whitelist rejection, modeled on
  `apps/lead-tracker/src/app/leads-contract-parity.spec.ts`.

Non-goals: no transport change (TCP stays); no merges of `admin-api` into gateway (C4 is
docs-only); videos, classifieds, permissions, workspace, and system-configurator tables are
untouched except where named as saga participants.

## 3. Entity-by-entity move table

| #   | Entity (current path)                                                                                                                                                                                          | Current owner / table                                | Target owner                                                              | Action                                                                                                                                                                                                                                                                                                                                    | Migration / backfill (owning-service target)                                                                                                                                                                                           |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1  | `Donation` — `apps/payments/src/entities/donation.entity.ts` (`donations`: decimal amount, `lemonSqueezyOrderId/SubscriptionId`, status pending/completed/failed/cancelled)                                    | payments                                             | **payments (keep, canonical)**                                            | Canonical `Donation`. Add `message`, `anonymous` columns (port from store variant) + `storeReferenceId` nullable for store-originated gifts. Gateway `POST /api/store/donations` becomes a shim delegating to payments (per conventions above).                                                                                           | `payments` migration: add columns, no data move. Contract: `payments-contracts DonationDto` (new lib, §5).                                                                                                                             |
| E2  | `DonationEntity` — `apps/store/src/donations/entities/donation.entity.ts` (`donations`: `amountCents`, message, anonymous)                                                                                     | store (duplicate)                                    | **payments**                                                              | Deprecate store table. During the shim release the gateway store-donations handler writes `payments.donations` first, then the store reference row; backfill older `store.donations` into `payments.donations` (amountCents→decimal, `storeDonationId` preserved), then drop store table; store keeps `paymentDonationId` reference only. | `store` migration: add `paymentDonationId`; backfill job (reversible `up`/`down`); follow-up migration drops `store.donations`. `typeorm:migration:generate` on store + payments separately.                                           |
| E3  | `Transaction` — `apps/payments/src/entities/transaction.entity.ts` (`transactions`: type donation/classified_payment/business_subscription/sponsorship/refund/payout, direction, amount/platformFee/netAmount) | payments (operational log)                           | **finance (ledger canonical); payments keeps provider-event log renamed** | Rename payments table to `payment_events` (same columns + `financeTransactionId`); finance `Transaction` is the sole accounting record. Payments emits `payment.settled` event → finance writes ledger row.                                                                                                                               | `payments` rename migration + add FK-ish `financeTransactionId`; `finance` migration: add `source`, `sourceId`, `providerMeta` columns to accept postings. Document exception if event backfill needs `migration:create` (reversible). |
| E4  | `Transaction` — `apps/finance/src/entities/transaction.entity.ts` (credit/debit, accountId, tenantId, category)                                                                                                | finance                                              | **finance (keep, canonical ledger)**                                      | Sole writer. Ingest postings from payments (E3), store receipts (E5), and billing quotes (E5/E6) via TCP event or explicit `POST /api/finance/transaction` from gateway handlers (never direct DB cross-write).                                                                                                                           | `finance` migration for E3 columns only; no data move.                                                                                                                                                                                 |
| E5  | `InvoiceEntity` — `apps/store/src/appointments/entities/invoice.entity.ts` (`invoices`: appointmentId, invoiceNumber, amount, unpaid/paid/cancelled)                                                           | store (appointment receipt)                          | **billing (quote/invoice canonical); store keeps receipt reference**      | Store `invoices` table is renamed to `appointment_receipts` (appointmentId, billingInvoiceId, amount snapshot). Billing persists quotes in a **new** billing `invoices` table (billing has no invoice table today — only the `InvoicePreviewService`); store references `billingInvoiceId`.                                               | `store` rename + add `billingInvoiceId` + backfill from existing rows; `apps/billing` migration: new invoice entity/table plus `appointmentId`/`orderId` optional refs in `billing-contracts` Invoice.                                 |
| E6  | `FinancialInvoice` — `apps/finance/src/entities/financial-invoice.entity.ts` (invoiceNumber unique, tenantId, customerName, workspace)                                                                         | finance (receivable)                                 | **finance (keep); billing invoice is the upstream quote**                 | `FinancialInvoice` = receivable posted from a billing `Invoice` (quote→receivable link `billingInvoiceId`). `POST /api/finance/invoices` stays; add `POST /api/billing/invoices/preview` (new) for quotes. No table merge.                                                                                                                | `finance` migration: add `billingInvoiceId` nullable + unique partial index.                                                                                                                                                           |
| E7  | `SubscriptionEntity` — `apps/store/src/subscriptions/entities/subscription.entity.ts` (productId, interval monthly/yearly, nextBillingDate)                                                                    | store                                                | **billing owns subscription lifecycle; store owns product catalog**       | `store.subscriptions` → `store.product_entitlements` (userId, productId, billingSubscriptionId, status mirror). Billing `BillingSubscription` (trialing/active/past_due/canceled) is canonical; store mirrors read-only via event/TCP read.                                                                                               | `store` rename + add `billingSubscriptionId` + backfill join on userId/productId; `billing` migration: ensure plan/price FKs cover store products (seed mapping table, not a data move).                                               |
| E8  | Billing entities — `libs/billing/data-access/src/lib/{billing-account,usage-event,usage-block-grant}.entity.ts`                                                                                                | billing (via `apps/billing/src/app/loadDatabase.ts`) | **billing (keep)**                                                        | No move and no path rename (a rename would churn imports for zero runtime gain). Instead the lib README states it is backend persistence (`platform:server`), not a UI client; O4's tag review confirms no UI app imports it.                                                                                                             | No migration. README fix only.                                                                                                                                                                                                         |
| E9  | `PayoutRequest`, `SellerWallet`, `Offer`, `ClassifiedPayment`, `LemonSqueezyProduct`, `BusinessPage`, `CommunitySponsorship` — `apps/payments/src/entities/`                                                   | payments                                             | **payments (keep)**                                                       | No move. Confirms payments keeps marketplace/provider surface.                                                                                                                                                                                                                                                                            | None.                                                                                                                                                                                                                                  |
| E10 | `Order`/`OrderItem`, `Product`, `Catalog`, `Appointment`/`Availability`/`Resource`, `TrainerSiteConfig` — `apps/store/src/**`                                                                                  | store                                                | **store (keep)**                                                          | No move. Appointments reference their `appointment_receipts` row (E5) via `billingInvoiceId` instead of an embedded invoice.                                                                                                                                                                                                              | `store` migration only for E5/E7 reference columns.                                                                                                                                                                                    |
| E11 | `Account`, `Budget`, `RecurringItem`, `InventoryItem`, `BankConnection`, `FinanceTenant*`, fin-commander plan/scenario/goal — `apps/finance/src/entities/`                                                     | finance                                              | **finance (keep)**                                                        | No move.                                                                                                                                                                                                                                                                                                                                  | None.                                                                                                                                                                                                                                  |

Out of scope (noted, not moved): `Order` vs `FinancialCheckoutSession` — keep both (store checkout intent vs finance receivable session), link by `orderId`.

## 4. Gateway route map (current → target)

| Current route                                                                                                                          | Handler today                                        | Target                                                                                                                                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/store/donations`, `GET /api/store/donations` (`store.controller.ts:262-272`)                                                | store TCP `DonationCommands`                         | Delegate to payments (`payments` TCP `GET_DONATION_GOAL`/create) or 307 to `/api/payments/donations/*`; keep shim one release with `Deprecation` header.                                                                               |
| `GET /api/donations/goal`, `GET /api/donations` (`donations.controller.ts:56,81`)                                                      | payments-adjacent                                    | Keep; make canonical read path (payments).                                                                                                                                                                                             |
| `GET/POST /api/payments/donations/*`, `classifieds/payment/*`, `business/checkout`, `sponsorship/*` (`payments.controller.ts:189-552`) | payments                                             | Keep in payments.                                                                                                                                                                                                                      |
| `POST /api/store/appointments/:id/invoice` (`store.controller.ts:473`)                                                                 | store `InvoiceEntity`                                | Rewire to `billing` preview (`POST /api/billing/invoices/preview`) then finance post; store persists receipt ref (E5). New `controllers/billing/billing.controller.ts` required.                                                       |
| `POST/GET /api/finance/invoices*`, `invoice/:id/{send,void,pay}` (`finance.controller.ts:1097-1235`)                                   | finance `FinancialInvoice`                           | Keep; add `billingInvoiceId` passthrough.                                                                                                                                                                                              |
| `POST/GET /api/finance/transaction*` (`finance.controller.ts:319-452`)                                                                 | finance ledger                                       | Keep as sole ledger write path; payments/store/billing post via gateway handlers, never direct.                                                                                                                                        |
| `POST/GET /api/store/subscriptions*` (`store.controller.ts:332-365`)                                                                   | store `SubscriptionEntity`                           | Keep path, change backing to billing canonical (E7); response shape from `billing-contracts`.                                                                                                                                          |
| (missing) `POST /api/billing/*`                                                                                                        | — (no controller, no `billing` in `gatewayServices`) | **Add**: `controllers/billing/` + `billing` in `gatewayServices` + `ServiceTokens.BILLING_SERVICE` provider + composition id `billing`. Start with `usage/record`, `usage/batch`, `invoices/preview` (mirrors `billing-sdk` builders). |

Composition change is additive: `gatewayServices = [..., 'billing']`, provider definition
`{ token: BILLING_SERVICE, serviceId: 'billing', configKey: 'billing' }`, controller entries with
`requiredServices: ['billing']` so smaller deployments can disable it (falls back to `DisabledClientProxy`).

## 5. Contract libs (single source for REST + TCP)

- Keep `libs/billing/contracts` (12 files: account/plan/price/subscription/entitlement/invoice/invoice-line/usage-\*) as canonical billing shapes; add `record-usage`/`invoice-preview` DTOs with `class-validator` + `@ApiProperty` (response/request shared).
- Add `libs/payments/contracts` (Donation, PaymentEvent, PayoutRequest, webhook result — promote from `payments-domain` adapter types), `libs/store/contracts` (promote `libs/constants/.../store.ts` commands + gateway DTOs), `libs/finance/contracts` (promote ledger posting DTO from `libs/models` finance types). The full L1–L8 list (including chat/social/blogging/learning/profile) is §9.6, which is canonical — this section covers the billing-pilot subset only.
- `libs/constants` commands become re-exports (no shape duplication). Each microservice handler + gateway controller imports the same DTO. Add parity specs per pair (copy `leads-contract-parity.spec.ts`).

## 6. Codegen pilot (type safety end-to-end)

**Pilot scope: billing only** (`POST /api/billing/usage/record`, `POST /api/billing/usage/batch`, `POST /api/billing/invoices/preview`). Small, already has `billing-contracts` + `billing-sdk` + gateway-missing-controller, so the before/after is measurable.

**Track A — UI ← gateway (OpenAPI → Angular):**

1. Gateway CI: export `swagger.json` (`SwaggerModule.createDocument` → artifact; add `get-openapi` script, no runtime change).
2. Add `orval` (or `hey-api`) config generating into `libs/billing-sdk/src/generated/` (inside the publishable SDK — a separate internal lib would violate the publishable boundary rule). Commit generated code (reviewable diff).
3. Refactor `libs/billing-sdk` builders to re-export generated client + thin domain helpers; add `fin-commander` + one more consumer as pilot callers. Acceptance: no hand-written `/api/billing/*` strings remain; `tsc` + `jest billing-ui-data-access` green.
4. Rollout pattern to `payments`, `finance`, `store` UI libs next (retags first: `app-config-data-access scope:shared→app-config`, `social-data-access scope:shared→social`, `fin-commander-data-access type:ui→data-access`).

**Track B — gateway ↔ microservice (shared DTO, same source):**

1. No transport change (TCP stays). Gateway billing controller + `apps/billing` handler import the same `billing-contracts` DTO classes; `ValidationPipe` at gateway, same `class-validator` DTO at microservice entry.
2. Add `billing-contract-parity.spec.ts` (gateway DTO ↔ microservice payload, both directions) + negative tests (extra prop rejected by `whitelist:true, forbidNonWhitelisted:true` parity).
3. Optional: emit AsyncAPI JSON for the 3 pilot patterns from the same DTO source (docs only), to make TCP topics browsable like Swagger. Decide after pilot.

## 7. Sequencing & acceptance

1. Contracts libs (billing extended, payments/store/finance created) + parity specs — no DB change.
2. Gateway `billing` mount (composition + provider + controller) behind `enabledServices`; e2e `gateway-e2e` covers new routes + disabled-service fallback.
3. Dual-write/backfill release (E2 store donations, E5 receipts, E7 entitlements), then drop/rename migrations — each via owning-service `typeorm:migration:generate`, fresh-DB run, `pnpm run validate:typeorm-migrations`.
4. Codegen pilot (Track A+B on billing), then expand per domain.
5. Cutover: remove `POST /api/store/donations` shim, `store.donations` table drop migration.

Acceptance: one writer per table (E1–E7), `/api-docs` covers new billing routes, generated UI client is the only `/api/billing/*` caller, `nx affected` (gateway, billing, payments, store, finance + data-access libs) green, fresh-DB migration run clean.

## 8. Risks

- Backfill volume on `store.donations`/`store.subscriptions` — batch + idempotency keys (`storeDonationId`, `billingSubscriptionId`).
- Lemon Squeezy webhook raw-body handling (`main.ts:107-116`) must stay on payments path during delegation.
- `finance` summary/work-queue reads (`finance.controller.ts:831-854`) depend on ledger timing — post-write read-your-write via gateway `send` ack, not eventual consistency, for pilot.

## 9. Full-domain placement (beyond billing)

Same conventions as §3–§5: one writer per table, references by id across services,
migrations via each owning service's `typeorm:migration:generate` target, gateway routes
in §4-style route maps, contracts libs as the single REST+TCP source. Numbering continues
(E12+, G1+, C1+, L1+, T1+) so rows stay referenceable.

### 9.1 Chat (social vs chat-collector) — real split, same pattern as E1/E2

Both sides define the same `MessageType` enum (`chat/info/warning/system`):
`apps/social/src/entities/chat-message.entity.ts:10-15` and
`apps/chat-collector/src/app/entities/message.entity.ts:4-9`.

| #   | Entity (current path)                                                                                                                                           | Current owner / table    | Target owner                         | Action                                                                                                                                                                                                                                                                                                                                                           | Migration / backfill                                                                                                                                                                                                                                                                                                          |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E12 | `ChatMessage` — `apps/social/src/entities/chat-message.entity.ts` (conversationId, content, reactions `simple-json`, isEdited/isDeleted, readBy `simple-array`) | social (duplicate store) | **chat-collector (canonical store)** | Drop the social table. Message bodies and ordering live in chat-collector; social creates two new tables, `message_reactions(messageId, emoji, userId)` and `message_reads(messageId, userId, readAt)`, backfilled from the JSON/`simple-array` columns. `ChatMessageService` becomes a TCP read client to chat-collector, same as `social→profile` reads today. | `social` migrations: (1) create the two tables + backfill from `chat_message` JSON columns, preserving ids as `chatCollectorMessageId` mapping; (2) follow-up drops `chat_message`. `chat-collector` migration: none (bodies already keyed by `(conversationId, senderId, createdAt)`). Dual-write one release, then cutover. |
| E13 | `MessageType` enum (both files above)                                                                                                                           | duplicated               | **`libs/chat/contracts` (L4)**       | Single enum + `ChatMessageDto`/`ConversationDto` shared by gateway `chat.controller.ts:25`, `social` presence/activity, and `ai-orchestrator` prompt context.                                                                                                                                                                                                    | No migration. Parity spec `chat-contract-parity.spec.ts`.                                                                                                                                                                                                                                                                     |

### 9.2 Community / business content inside payments — move reads out, keep money in

| #   | Entity (current path)                                                                                               | Current owner | Target owner                                                                                                     | Action                                                                                                                                                                                                      | Migration / backfill                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| E14 | `BusinessPage` (`apps/payments/src/entities/business-page.entity.ts`), `BusinessTheme` (`business-theme.entity.ts`) | payments      | **social (community graph) for reads; payments keeps `businessPageId` refs on checkout/sponsorship rows**        | Payments stops serving page/theme content; `GET /api/payments/business/*` becomes gateway fan-out (social read + payments checkout link) or 307 to canonical community routes (§9.4 G3).                    | `payments` migration: drop content columns only after social backfill; keep id refs. No cross-DB join — gateway composes. |
| E15 | `CommunitySponsorship` (`community-sponsorship.entity.ts`), `Offer` (`offer.entity.ts`)                             | payments      | **social owns sponsorship/community-offer content; payments owns charge capture (`classified-payment`, payout)** | Sponsorship tiers/content move to social; payments keeps `sponsorshipId`/`offerId` money refs. `offer.service.ts:48` `CLASSIFIEDS_SERVICE` call stays (money→listing link), content reads come from social. | `payments` migration: add `socialSponsorshipId`/`socialOfferId`, backfill, drop content columns in follow-up.             |
| E16 | `PayoutRequest`, `SellerWallet`, `ClassifiedPayment`, `LemonSqueezyProduct` (`apps/payments/src/entities/`)         | payments      | **payments (keep)**                                                                                              | No move — confirms money-in boundary.                                                                                                                                                                       | None.                                                                                                                     |

### 9.3 Events / Posts — distinct contexts, rename in contracts (no table moves)

`Event` exists in both `apps/social/src/entities/event.entity.ts` (gathering: title, startDate/endDate,
location/locationUrl, privacy public/private/community) and
`apps/blogging/src/app/entities/event.entity.ts` (scheduled content: name, startTime/endTime,
`blog` FK, organizerId). `Post` exists in both `apps/social/src/entities/post.entity.ts` and
`apps/blogging/src/app/entities/post.entity.ts`.

| #   | Collision  | Resolution                                                                                                                     | Action                                                                                                                  |
| --- | ---------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| E17 | `Event` ×2 | Rename in contracts only: `SocialEvent` / `BlogEvent` (`libs/social/contracts`, `libs/blogging/contracts` L5/L6). Tables stay. | Gateway routes disambiguated in G4; OpenAPI codegen (Track A) generates distinct client types so UI libs stop aliasing. |
| E18 | `Post` ×2  | Rename in contracts only: `SocialPost` / `BlogPost`. Tables stay.                                                              | Same as E17; gateway `/posts` vs `/post` fixed in G4.                                                                   |

### 9.4 Gateway route dedupe map

| #   | Current routes                                                                                                                                                                                            | Fix                                                                                                                                                                                                                                                                                                                                         | Owner                                                          |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| G1  | `POST/GET /api/store/donations` + `GET /api/donations` + `GET/POST /api/payments/donations/*`                                                                                                             | Canonical: payments. Store route delegates (see §4).                                                                                                                                                                                                                                                                                        | payments                                                       |
| G2  | `@Controller('communities')` (`communities.controller.ts:54`) vs `@Controller('social/community')` (`community.controller.ts:58`)                                                                         | Merge to one family (`/api/communities/*`); other becomes 307 shim one release. Both currently inject `SOCIAL_SERVICE`; shim is routing-only, no logic fork.                                                                                                                                                                                | social                                                         |
| G3  | `GET /api/payments/business/*` (`payments.controller.ts:440-496`) serving page content                                                                                                                    | Split: content reads → social/community routes; payments keeps `business/checkout` + subscription mutation.                                                                                                                                                                                                                                 | social + payments                                              |
| G4  | `@Controller('posts')` (post-share) vs `@Controller('post')` (blogging) vs `/api/social` posts; `@Controller('event')` (blogging) vs `@Controller('social-events')`                                       | Canonicalize plural (`/api/posts`, `/api/social-events`, `/api/blog-events`), singular routes become 307 shims. Rename DTOs per E17/E18 at the same time so codegen output is stable.                                                                                                                                                       | social + blogging                                              |
| G5  | `@Controller('personalities')` (static theme configs from `theme-models`, `personalities.controller.ts:19` — no backend) vs `@Controller('persona')` (telos personas via TCP, `persona.controller.ts:24`) | Not a collision: distinct concepts sharing a name stem. Keep both paths; disambiguate in contracts/codegen as `ThemePersonality` vs `TelosPersona` (same rename rule as E17/E18) and note ownership in `/api-docs` descriptions. `@Controller('asset')` (`asset.controller.ts:32`, `ASSETS_SERVICE`) has no plural counterpart — no action. | telos/ai-orchestrator (persona); theme (personalities, static) |
| G6  | `trainer.controller` fans out to `STORE_SERVICE` + `LEAD_SERVICE` + `BLOG_SERVICE` (`trainer.controller.ts:70-75`)                                                                                        | Declare ownership: trainer orchestration stays in gateway only if it is pure fan-out with per-service failure semantics (composition-aware, like `DisabledClientProxy`); any write ordering moves to a saga owner (store) or domain events. Decide per endpoint in implementation plan; no table change.                                    | store (saga) or gateway (fan-out)                              |

### 9.5 Composition & layering fixes

| #   | Issue                                                                                                                                                                                     | Fix                                                                                                                                                                                                                                                                                              |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| C1  | `billing` missing from `gatewayServices` + provider definitions (§1)                                                                                                                      | Add `billing` service id, `BILLING_SERVICE` token, `controllers/billing/` (see §4).                                                                                                                                                                                                              |
| C2  | `ai-orchestrator` calls `telos/profile/chat-collector/prompt-proxy` directly (`apps/ai-orchestrator/src/app/app.service.ts:42-46`, `app.module.ts:88-145`), bypassing gateway composition | Rework per §11 R1–R5 (declared `dependencies:` map + shared composition helpers + single-path rule), not a standalone fix.                                                                                                                                                                       |
| C3  | Service-to-service writes bypass gateway: `payments→classifieds` (`payment.service.ts:99`, `offer.service.ts:48`), `social→profile` reads (acceptable)                                    | Rule going forward: cross-service **reads** via TCP client + shared contracts are allowed; cross-service **writes** go through gateway handlers (saga) or domain events. `payments→classifieds` confirm/release/dispute moves to gateway saga owned by classifieds with payments as participant. |
| C4  | `admin-api` (`scope:admin`) vs `gateway` (`scope:gateway`) overlap; `admin-api/bootstrap` injects `AUTHENTICATION_SERVICE` + `PROFILE_SERVICE` directly                                   | Document ownership: `admin-api` = bootstrap/ops only, never a second public ingress; any route that becomes public moves to gateway. No code move in this plan.                                                                                                                                  |

### 9.6 Contracts libs to create (L-series; billing/leads/app-catalog/configurable-plugin exist)

| #   | New lib                                                     | Covers                                                                                                                | Exemplar            |
| --- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------- |
| L1  | `libs/payments/contracts`                                   | Donation, PaymentEvent, PayoutRequest, webhook result (promote from `payments-domain` adapter types)                  | `billing-contracts` |
| L2  | `libs/store/contracts`                                      | Catalog/product/order/subscription/appointment DTOs + commands (promote `libs/constants/.../store.ts` + gateway DTOs) | `billing-contracts` |
| L3  | `libs/finance/contracts`                                    | Ledger posting, receivable, budget/recurring DTOs (promote `libs/models` finance types)                               | `billing-contracts` |
| L4  | `libs/chat/contracts`                                       | Conversation/Message DTOs + shared `MessageType` (E13)                                                                | `leads-contracts`   |
| L5  | `libs/social/contracts`                                     | Community/follow/post-share/poll/presence/`SocialEvent`/`SocialPost` DTOs                                             | `leads-contracts`   |
| L6  | `libs/blogging/contracts`                                   | Blog/catalog/`BlogPost`/`BlogEvent`/contact DTOs                                                                      | `leads-contracts`   |
| L7  | `libs/learning/contracts`                                   | Offering/enrolment/lesson-progress DTOs (promote `learning-domain` shapes)                                            | `leads-contracts`   |
| L8  | `libs/profile/contracts` (+ `auth`/`permissions` as needed) | Profile/timeline reads consumed by social, ai-orchestrator, gateway resolvers                                         | `billing-contracts` |

Each lib ships a parity spec modeled on `apps/lead-tracker/src/app/leads-contract-parity.spec.ts`
(gateway DTO ↔ microservice payload, both directions + `ValidationPipe` whitelist negative test).

### 9.7 Tag / naming consistency (T-series; feasible everywhere, no DB change)

| #   | Fix                                                                                                                                                                                                                                                                      | Files                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| T1  | `app-config-data-access scope:shared→scope:app-config`                                                                                                                                                                                                                   | `libs/app-config-data-access/project.json`              |
| T2  | `social-data-access scope:shared→scope:social`                                                                                                                                                                                                                           | `libs/social-data-access/project.json`                  |
| T3  | `fin-commander-data-access type:ui→type:data-access`, `scope:shared→scope:finance`                                                                                                                                                                                       | `libs/fin-commander-data-access/project.json`           |
| T4  | Clarify `billing/data-access` (`platform:server` backend entities) vs the generated UI client (`billing-sdk/src/generated/`, §6 Track A) — docs + README, keep path                                                                                                      | `libs/billing/data-access/*`, generated code in Track A |
| T5  | No rule change: `type:ui` keeps `type:data-access` (required for generated API clients, Track A). Tightening is structural instead — T3's promotion + the `data-access → ui` ban the boundary already enforces. Intent recorded as a comment on the `type:ui` constraint | `eslint.config.mjs` depConstraints                      |

## 10. Objectives (direct list)

**A. Contracts & types (no DB change; unblocks everything else)**

- [x] O1. Extend `billing-contracts` with record-usage/invoice-preview DTOs (`class-validator` + `@ApiProperty`). Done 2026-09-17 in 4 slices: `RecordUsageDto` (`usage-event.ts` + `usage-event.spec.ts`, 4 tests), `BatchRecordUsageDto` (nested validation, +4 tests), `InvoicePreviewMeter`/`InvoicePreviewInput`/`PeriodInvoicePreviewInput` (`usage-meter.ts`, `invoice.ts` + `invoice.spec.ts`, 8 tests). Interfaces converted to classes in place — same export names, zero consumer churn. Verified per slice: `nx test/lint/build billing-contracts` green (16/16 tests); cone `billing,billing-data-access,billing-domain,billing-sdk` test+lint green; lib builds green.
- [x] O2. Create L1–L8 contracts libs, each with a parity spec. Done 2026-09-17. L1 billing: O1 DTOs + `billing-contract-parity.spec.ts` (6 live patterns incl. both `PREVIEW_INVOICE` branches; `CLOSE_BILLING_PERIOD`/`GET_ENTITLEMENTS` named as dead commands with no sender/handler); this also converted the last three billing interfaces (`GrantUsageBlockDto`, `ConsumeUsageBlockDto`, `UsageSummaryRequest`) to validated classes, zero consumer churn. Verified: 24/24 tests, lint, build, cone `billing,billing-sdk,billing-domain` green uncached.
      Slices (each independently verified via `test`/`lint`/`build` on the new lib):
  - L4a: scaffold `libs/chat/contracts` (file-for-file from `billing-contracts` exemplar) + `chat-message.ts` (shared `MessageType` enum, `ChatMessageDto`, `PostMessageDto`) + validation spec.
  - L4b: `conversation.ts` (shared `ConversationType`, per-TCP-pattern conversation DTOs) + pattern-coverage parity spec (every `ChatCommands` key consumed via gateway/orchestrator has a DTO; drift fails CI).
  - L1/L2/L3, then L5/L6, then L7/L8 follow the same two-step shape (scaffold + message/shapes slice, then relations/patterns slice + parity).
  - L4 done 2026-09-17: `libs/chat/contracts` (`MessageType`/`ConversationType` shared enums, message + per-pattern conversation DTOs, `chat-contract-parity.spec.ts` covering 8 live patterns and naming the 3 unimplemented commands as explicit gaps). Verified: 18/18 tests, lint (incl. contracts→util boundary), build green.
  - L2 done 2026-09-17: `libs/store/contracts` — promoted the store/appointments DTOs out of `models` (`git mv`, `models` re-exports), new `CatalogProductsDto`/`ProductRefDto`/`CheckResourceAvailabilityDto`, parity over all 8 command objects (scalar/empty/scope sends complete by definition; E5/E7 shapes deferred). Verified: 22/22 tests, lint, build, `store` (46) + `models` (71) green. Lesson: new libs need a `tsconfig.base` path entry (billing-contracts has one); without it consumers fail to resolve.
  - L3 done 2026-09-17: `libs/finance/contracts` — promoted the finance DTO dir out of `models`, parity over all 9 command objects (11 mutations covered; reads/updates/deletes verified as `{id}`/scope/`FindManyOptions` sends). Verified: 15/15 tests, lint, build, `finance` (43) + `models` (287), lint `finance,models,fin-commander` green.
  - L6 done 2026-09-17: `libs/blogging/contracts` — promoted the blog DTO dir out of `models` (+ local `DateRange` twin documented for O17), E18 aliases kept at the barrel, parity over all 6 command objects. Verified: 8/8 tests, lint, build, `blogging` (42) + `models` (154), lint `blogging,models` green.
  - L8 done 2026-09-17: `libs/profile/contracts` — promoted the profile DTO dir out of `models`, new query DTOs + `BlogRole` enum (mirrored from the entity), parity naming `Delete` (sent, unhandled) + photo/cover + timeline update/delete + goals/projects gaps explicitly. Verified: 9/9 tests, lint, build, `profile` (42) + `models` (40), lint `profile,models` green.
  - L7 done 2026-09-17: `libs/learning/contracts` — authored (no models DTO dir to promote; `learning-domain` is `type:domain` so values mirrored with pin tests), enrolment/progress/attempt/evaluation/offering DTOs incl. promoted gateway `SetCoEditorsDto` shape, parity over 21 patterns with catalog reads + `GetAttempt` deferred. Verified: 23/23 tests, lint, build green.
  - Smell fixed 2026-09-17: `apps/chat-collector/.../app.controller.ts` string-literal `'CREATE_COMMUNITY_CHAT'` → `ChatCommands.CREATE_COMMUNITY_CHAT`; `chat-collector` test+lint green.
  - L1 done 2026-09-17: `libs/payments/contracts` (donation incl. canonical `DonationDto` E1, payout incl. `PayoutMethod`/`PayoutStatus` enums, webhook; `payments-contract-parity.spec.ts` covering 17 money-in patterns, 24 deferred keys named for E14/E15 + C3). Verified: 20/20 tests, lint, build green.
  - L5 done 2026-09-17: `libs/social/contracts` (`SocialPost`/`SocialEvent` renames E17/E18, community incl. G2 create/join/leave/find, follow edges, poll/share/presence; `social-contract-parity.spec.ts` covering 15 patterns with per-object drift detection over 7 command objects). Verified: 22/22 tests, lint, build green.
- [x] O3. Demote `libs/constants` command files to re-exports of the L-libs. Done 2026-09-17 in 4 slices (O3a billing/store/appointments/payments, O3b chat, O3c social/blogging via `git mv`, O3d finance/learning/profile via `git mv`). Definitions live in the contracts libs; `constants` files are re-export shims (alias applied at exactly one level — the barrel — after a mis-aliased shim round-trip; default-export shims use import+`export default`, which the repo's tsc accepts where `export { default as X }` does not). Parity specs import commands from their own lib index. Verified uncached: all 10 libs test+lint+build green; 12 consumer projects (incl. gateway 1229 tests) green. Lessons: run `nx reset` when new cross-lib edges appear (stale graph breaks the executor's dependency inlining → bogus TS6059); new libs need `tsconfig.base` path entries.
- [x] O4. Apply T1–T5 tag fixes so lint enforces the layering. Done 2026-09-17. T1 (`app-config-data-access` → `scope:app-config`), T2 (`social-data-access` → `scope:social`) clean. T3 (`fin-commander-data-access` → `type:data-access`/`scope:finance`) exposed a real layer violation — it imported `FinanceService`/models from the `type:ui` finance-ui lib — fixed by promoting `FinanceService`+models+http-error utils into a new `libs/finance/data-access` lib (`git mv`, `finance-ui` re-exports, 25 consumer imports repointed at the barrel) and switching fin-commander-data-access onto it. T4: `billing/data-access` README naming note. T5: no rule change (removing `data-access` from `type:ui` would forbid generated clients); intent recorded as a comment on the constraint. Verified uncached: finance-data-access (50), finance-ui (109), fin-commander-data-access (40, lints clean AS data-access — the violation is gone), app-config/social-data-access, fin-commander (158), business-site (182) all green.

**B. Gateway (config-modular, route-dedupe)**

- [x] O5. C1: mount `billing` (service id + token + `controllers/billing/`, composition-gated, e2e covers enabled + disabled fallback). Done 2026-09-17 in 3 slices. O5a: `BILLING_SERVICE` token, `billing` in `gatewayServices` + provider definition + `config.ts`/`config.yaml` (`billing:3019`, free in both compose and gateway maps), billing default port 3024→3019 (old default collided with workspace/learning-service); provider spec +2 tests (enabled TCP proxy, disabled proxy). O5b: `controllers/billing/` (`usage/record`, `usage/batch`, `invoices/preview`, injected composition-aware client, AuthGuard-only — no `billing.*` permissions exist yet, see controller note) registered as `{ id: 'billing', requiredServices: ['billing'] }`; controller spec (5 tests incl. error mapping). O5c: `gateway-e2e/billing.spec.ts` (401 unauthenticated = mounted+guarded, 400 invalid bodies = DTO validation live; happy-path TCP + disabled fallback covered by unit specs since the e2e stack boots full composition). Verified: gateway 1238/1238, lint clean; e2e spec typechecks, live run pending a stack with billing deployed (no billing Dockerfile/compose entry yet — follow-up).
- [x] O6. G1–G4: ship canonical routes + 307 shims with `Deprecation` headers (one release with shims, next release removes). G5 needs no shim (distinct concepts — contracts rename only). Done in slices: G1 — `GET /api/store/donations` is now a 307 to `/api/donations` (canonical payments read) with `Deprecation: true`; `POST /api/store/donations` stays functional until E2 (store-client POSTs store-shaped bodies the payments checkout rejects) with `Deprecation: true` + warn log; spec `store-donations-shim.spec.ts`. Verified: gateway 1240/1240 at G1, lint clean. G2a — the two `provisionCommunityWorkspace` copies (identical bodies) extracted into `CommunityWorkspaceProvisioner` with its own spec; both controllers delegate. Verified: gateway 1242/1242, lint clean. G2 decisions (asked 2026-09-17): canonical family = `/api/social/community/*`; create grants owner + manager; sequencing = shim-first with O14 cutover. G2b — `communities` create now assigns `community_manager` best-effort (mirrors social call site; create never fails on it), plus fixed two `'CREATE_COMMUNITY_CHAT'` string literals to `ChatCommands`; spec +2 tests. Verified: gateway 1244/1244, lint clean. G2c — 7 shims on `/api/communities/*` (create, slug, id, update, delete, members, join → same-shape `/api/social/community/*` paths, 307 + `Deprecation: true`; POST gains chat-room creation per decision; GET id/members error shapes change null/[]→throw per canonical-wins rule); affected handler specs rewritten as redirect assertions (canonical behavior stays covered by social-side specs). Verified: gateway 1240/1240, lint clean. NOT shimmed (audited, divergent): GET / (LIST_LOCALITY vs FIND_MANY), membership/invite/election/manager/audit/suspend/chat-room routes, GET my/user/profile variants — callers migrate these at O14. G3 — no routes moved (verified: all business/sponsorship reads hit payments-only tables; social has no equivalent reads until E14). Instead: E14 target read-shapes authored in `social-contracts` (`BusinessPageContentDto`, `SponsorshipContentDto`, `ActiveSponsorshipsDto`; content+display split — provider money state stays payments-internal, documented per field) with `business-content.spec.ts` (4 tests); per-route disposition recorded — money stays (`business/checkout`, subscription + sponsorship mutations, classifieds, donations), content reads move at O13 (`business/:id`, `business/city/:cityId`, `sponsorship/:id/active`, `sponsorship/user`); no Deprecation headers yet (no successors exist to point at). Verified: social-contracts 26/26, lint, build clean. G4 — `/api/post` → `/api/blog-posts`, `/api/event` → `/api/blog-events` (controller renames; `/api/posts` post-share and `/api/social-events` untouched as canonical); wildcard 307 shims (`blogging-shims.controller.ts`, composition-gated, method+sub-path+query preserved, lookalike-prefix guarded) keep digital-homestead and all existing callers working; spec (11 redirect cases incl. query strings + `/api/postal` non-rewrite). Verified: gateway 1251/1251 (existing post/event specs unaffected by renames), lint clean.
- [x] O7. G6/C3: decide per trainer/payments↔classifieds endpoint — gateway fan-out vs saga owner — and record in implementation plan. Done 2026-09-17. Findings: trainer has exactly one multi-service write (`POST leads`: store-config read → single lead write — no compensation case, gateway orchestration stays); `payClientInvoice` is a config-gated single store write; all 5 payments→classifieds sends are READS (`FIND_BY_ID`/`FIND_BY_USER` for validation, TOCTOU caveat recorded) — no cross-service writes exist, so no saga needed. Decisions (asked): payment confirm/release/dispute keeps either-party caller rule; trainer URL canonicalizes (evidence: zero `/api/trainer` callers, ~30 `/api/business/*` routes via business-data-access) — `@Controller('business')` + `TrainerShimController` wildcard 307 (composition-gated), mount-path spec updated, shim spec (6 cases incl. lookalikes). Verified: gateway 1257/1257, lint clean.
- [ ] O8. C2: implement §11 R1–R5 via group F (O22–O28).
- [x] O9. C4: document `admin-api` = bootstrap/ops only. Done 2026-09-17: `apps/admin-api/README.md` with full route inventory (healthz, bootstrap/_, api/rollouts/_, api/deployment/\*, oauth tooling) — none duplicating gateway product routes; outbound auth/profile use is owner-provisioning only. Verified: lint clean (docs-only).
- [x] O10a. Billing migration scaffolding. Done 2026-09-17: `apps/billing/src/app/staticDatabase.ts` (env convention mirrors `config.ts`: `BILLING_DB_*` → `DB_*` → `ot_billing` default; 3 entities from `billing-data-access`) + `typeorm:migration:{generate,run,revert}` targets mirroring payments. Verified: targets registered, billing test+lint green, DataSource loads with 3 entities (no-connect import check). Live `generate` + `validate:typeorm-migrations` pending a database.

**C. Persistence (one writer per table; owning-service `typeorm:migration:generate`, fresh-DB run + `validate:typeorm-migrations` each)**

- [x] O10b (E2). Done 2026-09-20 against the live dev stack (project `t3code-baf8592e`: postgres + store + payments + gateway + billing). `ot_billing` created + added to `ADDITIONAL_DBS`; billing baseline migration generated via owning target and run (3 tables); `staticDatabase.ts` fixed to honor the db-setup loop's `POSTGRES_*` env (first run failed on localhost default); store `paymentDonationId` migration generated via owning target and run. Gateway POST creates payments row first (new `RECORD_DONATION` pattern/handler/contract; `{cmd}` object form — a live 500 caught the bare-string mismatch), then store row with the ref; payments failure writes nothing (spec-pinned order + failure case). New `PAYMENTS_SERVICE` token+provider+specs. Backfill vacuous (both tables verified 0 rows pre-smoke — no data migration); table drop at O14. Live smoke: POST → payments row (25.00 pending) + store row (2500c, matching ref); GET → 307. `validate:typeorm-migrations` passes. Suites green uncached (billing/store/payments/gateway/contracts). Follow-ups: `%npm_config_name%` doesn't expand on Linux (positional CLI form used); clean rebuilds crash nodemon bind-mounts (restart containers); billing needs prod Dockerfile/compose entry (dev-only entry added).
- [x] O10 (E5/E7). E5 done 2026-09-20 live: billing `BillingInvoiceEntity` + migration + `INVOICE_REPOSITORY`/`TypeOrmInvoiceRepository` + module wiring; preview mints a `draft` row per decision and returns its id (`mintPreview`; pure `InvoicePreviewService` kept for what-if use); store `invoices` → `appointment_receipts` + `billingInvoiceId` via data-preserving rewrite of the generated create+drop; gateway invoice route unchanged (appointment validation stays store-side; linkage fills opportunistically). Live proof: preview minted quote + matching draft row. E7 done 2026-09-20 live: `BillingSubscriptionEntity` + `StoreProductPlanEntity` (empty by design — no invented prices; fallback derives `store:<id>` ids) + migration; `BillingSubscriptionsService` (create/get/terminal-cancel) + 3 TCP patterns + contracts DTOs + parity; gateway create/cancel dual-write (reads stay on mirror; legacy NULL-ref rows skip billing hop; tenant/account fall back to caller until finance provisioning exists); store `subscriptions` → `product_entitlements` + `billingSubscriptionId` via preserving rewrite. Live proof: create wrote billing sub (derived plan, active) + mirror with matching ref; cancel at unit level (live cancel needs a permission grant — out of slice scope). `validate:typeorm-migrations` passes. Suites green uncached (billing/billing-contracts/store-contracts/gateway/store/constants). Backfills vacuous (0 rows throughout — verified).
- [x] O11 (E3/E4). Done 2026-09-20 live: payments `transactions` → `payment_events` + `financeTransactionId` via data-preserving rewrite (generated create-new stranded the old table); finance `source`/`sourceId`/`providerMeta` via trimmed migration (generated diff dragged 12 unrelated FK drops — cut); finance migration file moved to `src/migrations/` to match that service's glob (generate had written to the payments/store-style dir). Both migrations generated via owning targets and run live; tables verified. Backfill vacuous (0 rows both sides). Live proof: dual-write smoke post-rename wrote matching refs; old `transactions` table gone. `validate:typeorm-migrations` passes. Suites green uncached (payments 164, finance 287). Event emission (payments→finance posting) intentionally out of this slice — needs a transport decision (O26-adjacent).
- [x] O12 (E12, decided scope: drop dead code only). Done 2026-09-20 live: survey proved `ChatMessageService` + entity fully dead (zero callers/handlers/routes, 0 rows both sides; gateway `ChatMessage` is the unrelated models wire type). Removed service + 465-line spec + entity (`git rm`), module provider + repository wiring, `loadDatabase` + `staticDatabase` entries. Migration `DropDeadChatMessage` drops the table (rewritten — generate missed the drop and carried unrelated enum drift instead; down restores exact schema incl. real PK name). Verified: table gone live, social suite 365/365 + lint, `validate:typeorm-migrations` passes, social boots clean on fresh dist (bundle contains only the contracts `ChatMessageDto` type + a comment). Projections deferred to a real caller (recorded).
- [x] O13 (E14/E15). Done 2026-09-20 live per three decisions (row-move + dual-write; offers stay in payments as money records — E15 exception recorded; fan-out now, no premature deprecation headers). Social: 3 content entities + `BusinessContentService` (reads/writes/mirror) + 9 TCP patterns (`BusinessContentCommands`) + module/loader wiring + migration (trimmed of unrelated enum drift) run live. Gateway `payments.controller`: 4 fan-out reads (social overlay by back-ref, payments-only fallback, single-object-tolerant per existing specs) + dual-write on 3 creates (payments first, best-effort social mirror with warn) + theme read fallback; ad-hoc social client mirrors the file's existing pattern (token conversion recorded as follow-up) with graceful degradation when unconfigured. L5 parity extended (9 patterns). Live proof: checkout dual-wrote matching refs across DBs; fan-out read-back merged; invalid-UUID input correctly rejected. Verified uncached: social (368) + social-contracts (35) + gateway (1266) + validate script green.
- [x] O14. Cutover release. Done 2026-09-20 live per two decisions (direct-record route preserving anonymous gifts; extend-social-API-first). Callers migrated first: store-client + video-client donations POST → `POST /api/payments/donations` (new gateway route → RECORD_DONATION; payments `Donation.message/anonymous` columns added via migration since the store shape carried user content); owner-console reads → `GET /api/donations` with in-service shaping (component untouched); local-hub community calls → `/api/social/community/*` (incl. 6 NEW social routes: sub-communities, membership check, manager, election get/nominate/vote — the vote route accepts both `candidateId`/`candidateUserId`, fixing a latent client/server mismatch); digital-homestead + blogging-data-access → `/api/blog-posts/*`; e2e mocks + all affected specs updated. Removed: store POST+GET shims, 7 community shims, blog shims, trainer shim (+ dead provisioner delegation in communities controller); `store.donations` microservice stack deleted (controller/service/spec/entity/module wiring/loaders) and table dropped via migration with orphan-guard + pre-drop message backfill. NOT dropped (documented): `product_entitlements` (mirror reads live), payments content columns (checkout writes live), `DonationCommands` re-exports. Verified: repo grep clean; suites green uncached (gateway/store/local-hub/digital-homestead/store-client/video-client/owner-console/blogging-data-access); live — old paths 404, canonical 200s, `validate:typeorm-migrations` passes.

**D. Codegen pilot → rollout (full type safety)**

- [x] O15. Track A pilot on billing: export `swagger.json` in CI → generate `billing-ui-data-access` → `billing-sdk` re-exports generated client → no hand `/api/billing/*` strings. Done 2026-09-21 in 3 slices. O15a: `get-openapi` (`tools/openapi/export-gateway-openapi.ts`, `swagger-document.ts`) → `dist/openapi.json` (548 paths); fixed oauth `@Param('provider')` + profile-analytics `@Query('domain'/'limit')` validation gaps the export exposed. O15b: orval 8.34.0, `orval.config.ts` (`input.filters.tags: ['billing']` — `output.filters` is silently ignored in v8), client generated into `libs/billing-sdk/src/generated/` (a separate internal lib was scaffolded first, then folded: `visibility:publishable` SDK cannot depend on `visibility:internal`); fixed preview union body invisible to Swagger (`@ApiBody` oneOf). O15c: SDK re-exports generated service (Angular peerDeps) + builders kept thin; `billing-sdk-generated-parity.spec.ts` (builder↔generated types incl. Date→ISO boundary) + `billing-generated-client.spec.ts` (route allowlist); gateway preview now validates explicitly (union metatype defeats the global pipe; TCP collapses all errors to 500 — proven by probe) restoring O5 e2e 400; microservice BadRequest guard kept as defense-in-depth; CI drift gate in `ci-cd.yml` validate job. Verified: billing-sdk 8/8, gateway 1240/1240, billing 15/15, business-site 158/158, fin-commander 182/182, live O5 billing e2e 3/3, regen idempotent, grep shows `/api/billing/*` only in generated + specs + controller.
- [x] O16. Track B pilot on billing: shared DTOs in gateway + microservice handler, parity spec green. Done 2026-09-21: global ValidationPipe (whitelist + forbidNonWhitelisted + transform, mirroring gateway) on billing bootstrap; converted the three inline/union-adjacent handler params to real DTO classes (`CreateSubscriptionFromProductDto`, `BillingSubscriptionRefDto` x2) — union `previewInvoice` keeps Object metatype (pipe skips it; O15c service guard + gateway explicit 400 enforce it instead); parity spec +22 extra-props cases both directions (gateway-side + TCP-round-tripped microservice-side). Verified: parity 50/50, billing 15/15, live TCP probe (valid accepted, extra rejected with handler never running for all class-typed patterns). Known transport limit (O15c): TCP collapses errors to generic 500, so live rejection reads as 500. Found pre-existing, out of scope: `StoreProductPlanEntity.productId` is uuid-typed so non-uuid store ids fail the override lookup before `store:<id>` fallback.
- [x] O17. Roll out Tracks A+B per domain in dependency order: billing → chat (E13) → payments/store/finance (E1–E7) → social/blogging renames (E17/E18, G4) → learning/profile. Done 2026-09-21, domain by domain with per-domain progress notes in §O17. Generated clients: billing-sdk, chat/payments/learning/profile-ui-data-access, store-data-access, finance/data-access, blogging-data-access, social-data-access (10 orval projects, CI drift gate covers all). No hand `/api/*` gateway-route strings remain outside generated code + specs + metadata (mutation matrix, interceptors, e2e matchers) + 2 documented SSR exceptions.
- [x] O18. Decide AsyncAPI JSON for TCP patterns after pilot (docs only). Done 2026-09-21: verdict DROP — brokerless Nest TCP has no consumer for the document; parity specs already assert the executable contract (dispatch rule, wire boundary, error collapse) which AsyncAPI cannot encode. Rationale in §O18.

**E. Verification per objective**

- [x] O19. `nx affected` (gateway + touched services + data-access/contracts libs) green: build, lint (boundaries), jest, e2e slice for touched routes. Done 2026-09-22: S-O19a — affected build 76/76 (fixed: profile-microservice DTO ripple, ai-orchestrator DisabledClientProxy variance, learning budget 1→1.1mb, classifieds node types, marketing-generator hermetic defaults), lint 134/134, jest all green except learning-runner port conflict (proven environmental: foreign Nest app squats 3099). S-O19b — gateway billing 3/3 + communities 17/17 (migrated 12 e2e cases off dead CRUD to canonical; documented soft-delete 200 + missing-row 500-collapse), TCP-direct social 20/20 + profile 11/11 + chat-collector 1/1, store-client UI vs locally-served fresh code (donations mock passes — earlier failure was stale worktree code; products 9/10, one seed-dup strict-mode flake), live curl smokes all domains. Stack findings: e2e dependsOn-build self-sabotages nodemon containers (use direct jest); blogging 3011 unpublished (TCP e2e needs CI stack); UI containers mount a DIFFERENT checkout (worktree t3code/compare-learning-app-repos) — backend smokes valid, UI Playwright only valid against locally-served builds (see triage note).
- [x] O20. Fresh-database migration run + `pnpm run validate:typeorm-migrations` before merge, per repo rules. Done 2026-09-22: `docker system prune -af --volumes` (76GB, per explicit request), fresh `postgres_data` volume, `db:setup` → 132 migrations green / 0 errors, governance validation passes, full stack rebuilt + healthy, key smokes green (register 201, billing 201, store 200, communities 200). Incidentally fixed: pnpm lockfile drift (billing-sdk peerDeps) blocking docker builds. KNOWN GAP (fresh DB, pre-existing, not this branch): community creation 500s — `community_owner@appScope=community` role row exists in no pipeline (legacy seed script deprecated, RoleInit doesn't create it, permissions seed lacks it); communities e2e needs it. Follow-up slice: seed the row or make the provisioner resilient. Also noted: e2e `dependsOn: build` + nodemon bind-mounts self-sabotage live-stack runs (use direct jest); blogging 3011 unpublished; port 3099 squatted.
- [ ] O21. `/api-docs` covers every new/canonical route; generated clients are the only UI callers for migrated domains (grep for hand `/api/<domain>/*` returns only generated code).

## 11. AI orchestrator → gateway pattern (declared dependencies)

### 11.1 Current state (verified)

The orchestrator bypasses the gateway with its own direct TCP clients:

| Downstream         | Orchestrator client (provider)                                   | Config key (`apps/ai-orchestrator/src/assets/config.yaml`)    | Consumed as                                                                                                                   |
| ------------------ | ---------------------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| profile            | `ServiceTokens.PROFILE_SERVICE` (`app.module.ts:122-137`)        | `dependencies.profile` (host `profile:3002`)                  | `ProfileCommands.Get` (`app.service.ts:158-163,264-269`), `system-prompt-builder.service.ts:60`                               |
| telos-docs-service | `ServiceTokens.TELOS_DOCS_SERVICE` (`app.module.ts:105-120`)     | `dependencies.telos_docs_service` (`telos-docs-service:3008`) | `PersonaTelosCommands.FIND` (`app.service.ts:113-115`), `system-prompt-builder.service.ts:58`, `persona-voice.service.ts:180` |
| chat-collector     | `ServiceTokens.CHAT_COLLECTOR_SERVICE` (`app.module.ts:139-154`) | `dependencies.chat_collector` (`chat-collector:3007`)         | `ChatCommands.POST_MESSAGE` (11 call sites in `app.service.ts`, incl. progress/final/error paths)                             |
| prompt-proxy       | `ServiceTokens.PROMPT_PROXY` (`app.module.ts:88-103`)            | `dependencies.prompt_proxy` (`prompt-proxy:3009`)             | wired but currently unused at runtime (comments in `app.service.ts:187-189,240-243` note deliberate removal)                  |

Meanwhile the gateway reaches the orchestrator via `AI_ORCHESTRATION_SERVICE`
(`gateway-service-providers.ts`, serviceId `ai-orchestration`, composition-gated) while
`chat.gateway.ts:42-49` **also** injects `CHAT_COLLECTOR_SERVICE`, `TELOS_DOCS_SERVICE`,
and `PROFILE_SERVICE` directly. So one chat flow has two live paths to the same downstream
services: `client → gateway → orchestrator → telos/profile/chat` and
`client → gateway → telos/profile/chat`.

### 11.2 The three defects this plan fixes

1. **Declared but unasserted dependencies.** The orchestrator's downstream set lives in its
   `config.yaml` `dependencies:` map + four provider blocks — the same paradigm as the
   gateway's `services:` map — but nothing asserts it against the gateway's `gatewayServices`
   list, so a service can be gateway-composed (or removed) without the orchestrator noticing.
2. **Fail-hard instead of compose-aware.** Each orchestrator provider `throw`s when its config
   is missing (`app.module.ts:92,109,126,143`), while the gateway degrades to
   `DisabledClientProxy`. Disabling `telos-docs-service` in gateway composition therefore
   produces incoherent behavior: gateway callers get a clean "disabled" error, orchestrated
   callers either crash on boot or — worse — succeed by reaching the service directly.
3. **Dual paths.** Gateway handlers and the orchestrator both call telos/profile/chat for the
   same flows, with no rule for which path owns a route.

### 11.3 Target pattern (reuse existing paradigms — nothing new invented)

Surveyed first: `ServiceTokens` (`libs/constants/.../service.tokens.ts` — canonical token
registry, already shared); per-app `config.yaml` `dependencies:` maps (`TcpServiceConfig`,
gateway `config.ts:287-311` and orchestrator `assets/config.yaml:2-22` — same shape);
composition gating (`gateway-composition.ts` + `DisabledClientProxy`, currently
gateway-private); TCP `CommonCommands.HealthCheck`
(`ai-orchestrator/.../app.controller.ts:21-23` — the existing health paradigm,
message-pattern not HTTP). `libs/compose-lib` (Angular component composition) and
`libs/app-registry` (UI navigation) were checked and are unrelated. The only relocation
is marked [RELOCATE].

- **R1. Declared manifest = the existing `config.yaml` `dependencies:` map.** No new manifest
  file. The orchestrator already declares downstream exactly like the gateway does
  (`profile`, `chat_collector`, `prompt_proxy`, `telos_docs_service`). All four are
  `required` except `prompt_proxy`, which stays declared-but-optional (wired, unused) so
  re-enabling it is a flag flip, not a rewire. Enforcement is the
  O23 coherence spec: orchestrator dependency keys must resolve to ids in the gateway's
  `gatewayServices` list with a `ServiceTokens` entry. Drift fails CI instead of surprising
  at runtime.
- **R2. Compose-aware clients via the existing composition code [RELOCATE].** Promote
  `gateway-composition.ts` (`enabledServices`, `filterEnabledEntries`,
  `loadGatewayCompositionFromFile`) and `DisabledClientProxy` verbatim into `libs/constants`
  next to `ServiceTokens` (that lib already owns service wiring: tokens + commands), with
  the gateway re-exporting to keep imports stable. Both apps then run identical gating logic.
  The orchestrator reads the **same** `GATEWAY_COMPOSITION_PATH` file where deployments share
  storage (no new env var); where it cannot, presence of the key in its own `dependencies:`
  map is the signal (key absent = disabled, not `throw`). The four `throw`s in
  `app.module.ts:92,109,126,143` become disabled-proxies.
- **R3. Single path per flow.** Route rule: orchestrated flows go
  `client → gateway → orchestrator → downstream` and gateway handlers do not re-call the
  downstream for the same step; non-orchestrated routes keep `gateway → service` direct.
  Concretely: `chat.gateway` persona-chat flows go through the orchestrator client only;
  direct `profile/telos/chat` clients in `chat.gateway` remain for the non-AI paths
  (connection auth, history fetch), documented per handler.
- **R4. Shared contracts.** Orchestrator's downstream payloads use the L-libs from §9.6:
  `ProfileDto` from L8, chat shapes from L4, telos shapes from a new `libs/telos/contracts`
  (same L-series pattern). Parity spec `orchestrator-contract-parity.spec.ts` covers
  `ProfileCommands.Get`, `PersonaTelosCommands.FIND`, `ChatCommands.POST_MESSAGE`.
- **R5. Observable composition via the existing HealthCheck pattern.** Extend the current
  `@MessagePattern({ cmd: CommonCommands.HealthCheck })` reply with per-dependency state
  (`{ status, dependencies: { profile: 'enabled' | 'disabled', ... } }`) instead of adding an
  HTTP endpoint; gateway readiness for `ai-orchestration` routes fails closed when a
  `required` downstream (all R1 deps except `prompt_proxy`) reports disabled.

### 11.4 Objectives (group F)

- [ ] O22. Orchestrator providers built from the `config.yaml` `dependencies:` map via the
      shared composition helpers (R1–R2); `prompt-proxy` marked optional; no new manifest file.
- [x] O23. Coherence spec. Done 2026-09-17: `GATEWAY_SERVICE_IDS` centralized in `libs/constants/.../service-composition.ts` (gateway builds its default composition from it — behavior identical), `ORCHESTRATOR_SERVICE_IDS` exported from the orchestrator module, spec `orchestrator-coherence.spec.ts` (4 tests: registry resolution, orphan detection on registry removal, token existence, exception-list minimality with `prompt-proxy` as the one documented non-gateway exception). Negative-proven (mutating the exception list fails 3 tests). Verified uncached: ai-orchestrator (406) + gateway + constants green, lint clean.
- [x] O24. [RELOCATE] composition + disabled-proxy into `libs/constants`, gateway re-exports. Done 2026-09-17 in 2 slices. O24a: `gateway-composition.ts` + spec moved via `git mv` to `libs/constants/.../service-composition.ts` (identifiers verbatim; shared-use note on the historical `Gateway*` names), `DisabledClientProxy` extracted there too, gateway files re-import. O24b: orchestrator providers rebuilt on a data-driven `createOrchestratorProviders(composition)` (composition-gated + missing-config → shared disabled proxy, four boot-time throws deleted, per-dep enabled/disabled boot log, same `GATEWAY_COMPOSITION_PATH` source); spec `orchestrator-dependencies.spec.ts` (4 tests). Verified uncached: constants (46) + gateway (1255) + ai-orchestrator (402) green, lint clean. Lessons: `nx reset` after new cross-lib edges (stale graph → bogus TS6059); default-export shims need import+`export default` form.
- [ ] O25. Per-handler path audit of `chat.gateway.ts` + `profile.controller.ts` AI paths:
      mark each downstream call orchestrated vs direct (R3) in a README table; remove duplicate
      calls on orchestrated flows.
- [ ] O26. Telos/profile/chat payloads moved to L4/L8/telos-contracts + parity spec (R4).
- [ ] O27. Extended HealthCheck reply with dependency state + gateway readiness gate (R5);
      `gateway-e2e` covers orchestrator route with a downstream disabled (expects clean
      disabled error, not hang — same `RequestTimeoutInterceptor` bound as §1).
- [ ] O28. Docs: orchestrator README records the gateway pattern (manifest → composition →
      single path → contracts) so the next downstream addition follows R1–R5.

## 12. Remaining slices, detailed (2026-09-17)

Conventions from §2 apply (shim → cutover, one writer per table, owning-service
`typeorm:migration:generate`, `pnpm run validate:typeorm-migrations`). Each
slice lists its own verification; none depends on an unfinished slice except
where noted.

### O9 — admin-api ownership note (docs only, no code)

Survey: `apps/admin-api/src/app/` holds `bootstrap/` (owner CLI + controller +
service), `deployment/`, `auth/`, `oauth/`, `images/`. Slice: one
`apps/admin-api/README.md` (or ARCHITECTURE note) recording C4 — bootstrap/ops
only, never a second public ingress — plus a route inventory naming any route
that overlaps gateway paths (those move to gateway if ever made public).
Verify: docs review + `nx lint admin-api` clean (no code touched).

### O10 — store↔payments/billing reference columns (E2/E5/E7)

Prerequisite first: `apps/billing` has NO `staticDatabase.ts` and NO
`typeorm:*` targets (only build/serve/test). O10a scaffolds both mirroring the
`payments` run-commands pattern (`node -r ts-node/register ... -d
src/app/staticDatabase.ts`), verified by generating an empty migration and
`validate:typeorm-migrations`. Then, each independently verifiable:

- O10b (E2): store `paymentDonationId` column → dual-write release (gateway
  store-donations handler writes payments first) → backfill
  (`amountCents→decimal`, preserve `storeDonationId`) → drop `store.donations`.
- O10c (E5): store `appointment_receipts` rename + `billingInvoiceId`; billing
  NEW invoice table + entity (none exists — only `InvoicePreviewService`).
- O10d (E7): store `product_entitlements` rename + `billingSubscriptionId`;
  billing plan/price coverage for store products (seed mapping, no data move).
  Each: generated migration + fresh-DB run + owning-service test suite green.
  Blocks O14 store cutover.

### O11 — payments event log + finance ledger columns (E3/E4)

O11a: payments `transactions` → `payment_events` rename + `financeTransactionId`
(payment migration above). O11b: finance `source`/`sourceId`/`providerMeta`
columns. Verify: both migrations fresh-DB clean, `payments` + `finance` suites
green. Targets exist on both services.

### O12 — chat message move (E12)

Social: new `message_reactions(messageId, emoji, userId)` +
`message_reads(messageId, userId, readAt)` tables, backfill from the JSON
columns, then drop `chat_message`; `ChatMessageService` becomes a TCP read
client. chat-collector: unchanged. Verify: social suite + backfill reversibility
(`down` restores). Targets exist on both services.

### O13 — content moves (E14/E15)

Reads for `BusinessPage`/`CommunitySponsorship`/`Offer` content move to social
(G3 authored the target DTOs); payments keeps money refs. Verify per move:
backfill + drop-content-columns migrations on both sides, both suites green.

### O14 — cutover release (blocked on O10–O13 + caller migrations)

Remove: store-donations POST + GET shim, 7 community shims, blog shims,
trainer shim. Drop deprecated tables. Migrate callers first: store-client
donations POST → payments checkout; local-hub + client-interface community
paths → `/api/social/community/*`; digital-homestead blog paths →
`/api/blog-posts|events/*`. Verify: repo-wide grep for old paths returns only
CHANGELOG/plan mentions; full affected suites green; e2e slices for touched
routes pass against the live stack.

### O15 — Track A codegen pilot (billing). Decisions (asked): orval; pilot callers

fin-commander + business-site; generated code committed with CI drift check.
Surveyed current state: `apps/gateway/src/main.ts:49-65` builds the Swagger
document in memory only (no export); no generator installed; no
`billing-ui-data-access` lib exists; `billing-sdk` is hand-written builders
over contracts types (`buildRecordUsagePayload` etc.); fin-commander consumes
billing via hand `HttpClient` calls.

- O15a (export): `get-openapi` script (package.json) booting the gateway
  module in-process and writing `dist/openapi.json`; CI uploads it as an
  artifact. No runtime change. Verify: script runs locally, JSON validates
  (orval consumes it in O15b — that IS the validation).
- O15b (generate): install orval (devDependency) + `orval.config.ts` targeting
  `libs/billing-sdk/src/generated/` — directly inside the publishable SDK,
  NOT a separate `billing-ui-data-access` lib (scaffolded first, then folded:
  a `visibility:internal` lib cannot be depended on by the
  `visibility:publishable` SDK per the boundary rule; Angular ships as SDK
  peerDeps). Commit the generated output as the reviewable diff. Verify: lib
  test+lint+build green; orval re-run is a no-op (clean tree).
- O15c (adopt): `billing-sdk` builders re-export the generated client
  (thin wrappers kept for call-site stability); fin-commander + business-site
  switch their billing calls onto it. Verify: repo grep for hand-written
  `/api/billing/*` returns only generated code + specs; both app suites
  green; one live smoke (fin-commander billing read against the dev stack).
- CI drift gate (part of O15c): CI regenerates and fails on a dirty tree,
  so hand-edits to generated code cannot slip through.

### O16 — Track B microservice validation (billing). Decisions: none needed.

DTO classes already shared (O1); `apps/billing/src/main.ts` has no pipes.
Slice: enable the global `ValidationPipe` (whitelist + forbidNonWhitelisted +
transform, mirroring the gateway's `main.ts:37-46` config) on the billing
microservice bootstrap, then extend `billing-contract-parity.spec.ts` with
negative cases proving extra props reject in BOTH directions (gateway DTO →
TCP → microservice handler). Verify: parity green, billing suite green
(update any handler tests that send extra props — whitelist will now strip
or reject them).

### O17 — codegen rollout per domain. Decisions: none (order + acceptance fixed).

Order: billing (O15/O16) → chat (E13) → payments/store/finance (E1–E7) →
social/blogging renames (E17/E18, G4) → learning/profile. Per domain, same
three slices as O15 (export is done once globally — reuse `dist/openapi.json`;
generate lib; adopt callers) with the same acceptance: generated code
committed, no hand strings outside generated code, lib test+lint+build green,
one live smoke per domain, CI drift gate covers all libs. Domains with no UI
callers (e.g. pure microservice patterns) get Track B only.

Progress 2026-09-21 — **chat done**: `chat-ui-data-access` (orval `chat`
tag, 6 routes, 350 lines) + `GetOrCreateDirectChatBodyDto` +
gateway DTO annotations; adopters `community-ui`,
`client-interface/chat.service`, `local-hub` + `forgeofwill` new-message,
`forgeofwill` messages + `project.service`. Fixes found en route: the two
new-message callers sent an unread `participantIds` body (now
`recipientProfileId`); `senderId` no longer travels on send (server binds
it); removed dead `deleteConversation` (no such route); `createCommunityChat`
now requires server-mandated `ownerId`. Remaining `/api/chat` strings are
Ollama LLM completions endpoints (different API), not gateway routes.
Verified: chat-ui-data-access 1/1, chat-contracts 18/18, community-ui 93/93,
client-interface 559/559, local-hub 356/356, forgeofwill 314/314, gateway
1240/1240, regen idempotent, live smoke (find 200, unauth 401, invalid
bodies 400). Next: payments/store/finance.

Progress 2026-09-21 — **payments done**: `payments-ui-data-access`
(orval `payments` tag, 1565 lines covering donations/classifieds/business/
sponsorship/offers/transactions/portal/seller/webhook). Only the donations
routes have UI callers, so adopt = `store-client` + `video-client`
`createDonation` onto `paymentsControllerRecordDonation` (URL/body
identical; their specs pass unchanged). Other routes are Track B only for
now. Drive-by fix: dispute route used `@Body('reason')` (invisible to
Swagger, generated `undefined` body) → explicit `@ApiBody` + `@Body()`
object; unit spec updated. Verified: payments-ui-data-access 2/2,
store-client 55/55, video-client 84/84, gateway payments specs 49/49, all
lints, regen idempotent, live smoke (public donations: invalid 400, valid
anonymous 201 with real row; dispute 500s are payment-not-found TCP
collapse on a fake id, unchanged semantics). Next: store, then finance.

Progress 2026-09-21 — **store done**: gateway `store.controller.ts`
(40 routes) got `@ApiTags('store')` + `@ApiOperation` throughout (it had
none); `@ApiQuery(required:false)` on the two optional `catalogId` params;
explicit `@ApiBody` for check-availability window. Generated into the
existing `store-data-access` lib (already the UI client lib — no confusing
second `store-*data-access` name), 1821 lines / 40 methods. Adopters:
`owner-console`, `store-client`, `video-client` services +
`store-authoring-data.service` (inside the lib). Fixes en route:
`@ApiProperty`→`@ApiPropertyOptional` on two `product.dto` fields (orval
saw them required); `toWireDate` boundary mappers (Date→ISO, null→absent);
bodiless PUTs now send no HTTP body (TCP payload identical — specs
updated); `HttpParams`-spread hazard (generated clients spread options —
use plain records); `deleteConversation`-class dead code not present here.
Remaining `/api/store` strings are e2e intercept matchers + the mutation
matrix (metadata, not callers) + `/api/donations` (different tag, later).
Verified: store-data-access 7/7, store-contracts 22/22, owner-console
656/656, store-client 55/55, video-client 84/84, gateway store spec 13/13,
all lints, regen idempotent, live smoke (products 400 w/o catalog, 200
via TCP with catalog). Next: finance (72 routes).

Progress 2026-09-21 — **finance done**: orval `finance` project (8 tags:
finance/account/transaction/inventory-item/budget/financial
invoice/checkout/fin-commander), generated into existing
`finance-data-access` (3416 lines / 72 methods). Adopters:
`FinanceService` (~60 methods) + `FinCommanderPlanApiService` (plan/goal/
scenario/directive reads + writes). Fixes en route: 8 `Record<string,
unknown>` create bodies DTO-typed (plaid webhook deliberately left
loose); `@ApiQuery(required:false)` on 8 optional `workspace` params
(method-level — param-level `@ApiQuery` doesn't compile); bulk
`@ApiProperty`→`@ApiPropertyOptional` across 18 finance-contracts files
(159 lines) for `@IsOptional()` fields orval saw as required;
`toWireDate`/null-strip/cast boundary mappers (server-required but
UI-optional fields like `spent`/`transactionDate` pass through so the
server still rejects, as before); verified no live regression (UI shapes
validate; identity scope overlaid server-side; whitelist strips nothing
current callers send). Grep-clean (only the tenant-header interceptor,
which matches URLs). Verified: finance-data-access 51/51,
fin-commander-data-access 40/40, finance-contracts 15/15, fin-commander
182/182, gateway 1240/1240, regen idempotent all 5 projects, live smoke
(routes mounted/guarded; fin-commander plans 401 unauth). Next:
social/blogging renames, then learning/profile.

Progress 2026-09-21 — **social done**: orval `social` project (19 tags,
incl. legacy `communities` URL-identically — canonical migration stays
O14's call) into existing `social-data-access` (5810 lines / 140
methods + client spec). Adopters: `community-ui` service + posts
component, `client-interface` + `owner-console` community services.
Fixes en route: explicit `@ApiBody` for 4 invisible bodies
(appoint/invite/ensureChatRoom/updateMemberRole + closeElection +
post/find rework to a typed body); `@ApiQuery(required:false)` for list
name/localityType; `@ApiProperty({type:Boolean})` for createChatRoom;
removed 5 dead UI methods with no gateway route (getMember/isMember/
getUserInvites/getCommunityById/chat-channels) + fixed 4 live-broken
callers to canonical same-backend routes (leave DELETE→POST, invite +
cancelInvite + get/members + CRUD out of dead `/api/communities/*`
paths); `createChatRoom:true` preserved (contract-required, unread
server-side); null-strips; bodiless-POST spec updates. Verified:
social-data-access 4/4, social-contracts 35/35, community-ui 88/88,
client-interface 559/559, owner-console 656/656, gateway 1240/1240, all
lints, regen idempotent all 7 projects, live smoke (public communities
200 with real rows, social get 401 unauth). Next: learning/profile.

Progress 2026-09-21 — **learning done**: `learning` tag on the REST
controller (GraphQL resolver untouched — out of orval scope) + `@ApiBody`
for 7 inline write bodies (runs/submit/answer/enrol/progress/offerings)

- `@ApiQuery(required:false)` for optional trackId/lesson queries;
  orval `learning` project into new `learning-ui-data-access` (991 lines /
  23 methods + client spec). Adopter: `learning-data.service` (SSR
  `catalog()`/`subjects()` deliberately stay on `publicRead` — generated
  client speaks relative URLs only; documented exception). Verified:
  learning 300/300, gateway specs green. Infra gap (pre-existing, for
  O19/O20): no `ot_learning_service` in dev compose → `/api/learning/*`
  TCP paths 500 EAI_AGAIN live.

Progress 2026-09-21 — **profile done**: orval `profile` project
(`profile`+`timeline`+`profile-analytics`) into new
`profile-ui-data-access` (896 lines / 19 methods + client spec).
Adopters: forgeofwill/video-client/system-/business-configurator/
forum-ui/community-ui/client-interface/owner-console/local-hub callers +
analytics service. Fixes en route: explicit `@ApiBody` for create
(allOf + appId), by-ids, recordView, findVotes; `@ApiQuery` for viewers
limit; `UpdateProfileDto` rewritten explicitly (PartialType metadata
invisible → validation + codegen saw only `id`, silently stripping
updates; `id` stays optional per PartialType semantics); `required:
false` across create-profile DTO; get-by-id callers moved to canonical
`by-id/:id` (telos back-fill); removed dead forum `getUserProfile`
(`:users/:id` never existed); fixed dead plural `DELETE /api/profiles/:
id` → canonical. Verified: all app/lib suites green (forgeofwill 314,
video-client 84, configurators, forum-ui 19, client-interface 559,
community-ui 88, local-hub 356, owner-console 656, profile-contracts 9,
gateway 1240), all lints, regen idempotent all 10 projects, live smoke
(post/find 200 with real posts; by-id + analytics routes mounted).
O17 codegen rollout COMPLETE — tick below.

Progress 2026-09-21 — **blogging done** (E17/E18/G4 renames had already
landed; this was their codegen rollout): class-level tags on all 5
blogging controllers (they had none) + `@ApiQuery(required:false)` for
optional `catalogId`/`baseUrl`/lead-filter params; orval `blogging`
project (5 tags) into existing `blogging-data-access` (1753 lines / 42
methods + client spec). Adopters: lib's own authoring + public services,
`digital-homestead` blog + contact services, `owner-console`
blog-catalog + contact-leads, `christopherrutherford-net` contact,
`hai` landing contact. Fixes en route: `HttpParams`-spread hazard again
(plain records); free-form `{unknown}` generated bodies need spread
call-sites for named UI types; `deleteConversation`-style dead code not
present; contact `postContact` return narrows `Object`→`void` (one spec
mock updated; responses only logged). Remaining `/api/blog*` strings are
metadata/matchers/URL-builders, except the permissions-inspector which
still shows stale pre-G4 `/api/blogging/post` paths (flagged, not fixed
here). Verified: blogging-data-access 16/16, digital-homestead 158/158,
hai 30/30, christopherrutherford-net 26/26, owner-console 656/656,
gateway 1240/1240, all lints, regen idempotent all 6 projects, live
smoke (published 200 with seeded post, contact invalid 400, valid 201).
Next: social (19 tags), then learning/profile.

Progress 2026-09-21 — **social done**: orval `social` project (19 tags,
incl. legacy `communities` URL-identically — canonical migration stays
O14's call) into existing `social-data-access` (5810 lines / 140
methods + client spec). Adopters: `community-ui` service + posts
component, `client-interface` + `owner-console` community services.
Fixes en route: explicit `@ApiBody` for 4 invisible bodies
(appoint/invite/ensureChatRoom/updateMemberRole + closeElection +
post/find rework to a typed body); `@ApiQuery(required:false)` for list
name/localityType; `@ApiProperty({type:Boolean})` for createChatRoom;
removed 5 dead UI methods with no gateway route (getMember/isMember/
getUserInvites/getCommunityById/chat-channels) + fixed 4 live-broken
callers to canonical same-backend routes (leave DELETE→POST, invite +
cancelInvite + get/members + CRUD out of dead `/api/communities/*`
paths); `createChatRoom:true` preserved (contract-required, unread
server-side); null-strips; bodiless-POST spec updates. Verified:
social-data-access 4/4, social-contracts 35/35, community-ui 88/88,
client-interface 559/559, owner-console 656/656, gateway 1240/1240, all
lints, regen idempotent all 7 projects, live smoke (public communities
200 with real rows, social get 401 unauth). Next: learning/profile.

### O18 — AsyncAPI decision. Decisions: none yet (this IS the decision slice).

Spike (time-boxed, docs-only either way): emit AsyncAPI JSON for the 3
billing pilot patterns (`RECORD_USAGE`, `BATCH_RECORD_USAGE`,
`PREVIEW_INVOICE`) from the same DTO source used by orval; evaluate
readability for TCP topics vs the parity specs. Record keep/drop + rationale
in this plan. No runtime or CI changes in the spike.

**Verdict (2026-09-21): DROP as a maintained artifact.** Spike emitted a
valid AsyncAPI 3.0 doc (3 channels, 4 messages, 5 schemas lifted verbatim
from `dist/openapi.json`, 281 lines) via a throwaway emitter, then removed
both — git history preserves them if this is ever revisited.
Rationale: our transport is brokerless Nest TCP, so no consumer exists for
the document (no AsyncAPI→Nest codegen in the loop, unlike orval for HTTP)
— it would be a third description of the same contracts with zero
enforcement and its own regen/CI-drift cost. Worse, it cannot encode the
three subtlest facts about these patterns: the `periodStart`-dispatch rule,
the `Date`↔ISO-string wire boundary, and the TCP error-collapse to generic
500s — all of which the parity specs assert executably, alongside the
live-vs-dead command enumeration. TCP addressing itself stays where it is:
the 12 command strings in `billing-commands.ts`, pinned by the parity
`covers every live pattern` test. Revisit only if a broker or a
Nest-TCP codegen enters the loop.

### O25 — AI path audit (R3)

Surveyed surface: `chat.gateway.ts` (4 injected clients, 15 direct sends),
`profile.controller.ts` (AI-orchestration + telos clients), learning resolver.
Slice O25a: per-handler orchestrated-vs-direct table in the orchestrator README
(O28 may land it). Slice O25b: remove duplicate calls on orchestrated flows
(chat.gateway persona-chat paths that re-call profile/telos/chat directly).
Verify: README table complete (every send classified), gateway suite green,
no behavior change on non-orchestrated paths (connection auth, history fetch).

### O26 — payload migration (R4)

Prerequisite: `libs/telos/contracts` does NOT exist yet — O26a scaffolds it
(Telos persona/doc shapes, same two-step shape as L4–L8). Then O26b migrates
orchestrator imports (profile→L8, chat→L4, telos→new) and O26c migrates
gateway `chat.gateway` + `profile.controller` AI-path imports (incl. the
legacy singular `recipientId` → canonical `recipientIds`). Verify per slice:
respective suites green + parity specs extended.

### O27 — HealthCheck extension + readiness gate (R5)

O27a: extend the orchestrator's `CommonCommands.HealthCheck` TCP reply with
per-dependency state + spec (healthy/disabled matrix). O27b: gateway readiness
gate failing closed for `ai-orchestration` routes when a required downstream
reports disabled + `gateway-e2e` disabled-downstream case (clean disabled
error, bounded by `RequestTimeoutInterceptor`). Verify: unit matrix green,
e2e passes against live stack.

### O28 — orchestrator README

Record manifest → composition → single path → contracts + the R3 audit table
so the next downstream addition follows R1–R5 without re-deriving them.
Docs-only; closes group F.

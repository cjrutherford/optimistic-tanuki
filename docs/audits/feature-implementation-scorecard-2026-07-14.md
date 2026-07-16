# Feature & Implementation Scorecard — 2026-07-14

Realistic due-diligence evaluation of the repository's feature domains. Each domain was
evaluated by an independent first-pass reviewer (score /10 plus sub-scores), then the
load-bearing claims were verified by a second validation pass against the actual code.
Scores below are the **post-validation** numbers. Validation verdicts: 19 of 20 spot-checked
claims confirmed (one partially), 1 refuted.

Scope: evaluation and recommendations only — no changes were implemented.

## Summary

| #   | Domain                                | Score   | First-pass | Biggest issue                                                                            |
| --- | ------------------------------------- | ------- | ---------- | ---------------------------------------------------------------------------------------- |
| 1   | Theme / Design System & Shared UI     | **7.5** | 7          | Heavily-mocked theme service tests                                                       |
| 2   | Towne Square / Local Hub              | **6.5** | 6.5        | 810-line PaymentService has zero unit tests                                              |
| 3   | Gateway & Platform Services           | **6**   | 6.5        | No timeouts/retries on any TCP client — cascading hang risk                              |
| 4   | Social & Community                    | **6**   | 6          | Search returns posts without visibility/moderation filtering                             |
| 5   | AI & Marketing Generation             | **6**   | 6          | "LLM-powered" concepts are actually 6 hardcoded templates; no cost tracking              |
| 6   | Video & Media                         | **6**   | 6          | No server-side upload validation; hardcoded profileId; unauthenticated transcoder socket |
| 7   | Authentication & Permissions          | **5.5** | 6.5        | OAuth auto-link account-takeover risk; ineffective login rate limits                     |
| 8   | DevOps, Deployment & Operator Tooling | **5**   | 5.5        | Real-format Tailscale OAuth secret committed in k8s/base/secrets.yaml                    |
| 9   | Forge of Will / Project Execution     | **4**   | 5          | Zero authorization on all project CRUD — any authenticated caller sees every project     |
| 10  | Billing, Payments & Finance           | **3.5** | 5          | Payment webhook signature captured but never verified — forgeable payment events         |

**Portfolio average: ~5.6/10.** Feature breadth is genuinely impressive and the UI/design
layer is the strongest part of the codebase. The recurring weaknesses are authorization
depth (services trust the gateway's authentication but rarely enforce ownership),
payment-path integrity, and backend test substance ("should be defined" stubs).

---

## Remediation status — updated 2026-07-16

Remediation has shipped in batches since this audit. The first three batches are committed
in `2d800b92` (191 files); the seed-cluster fixes below are still uncommitted in the working
tree. A full `pnpm build:dev` across all 42 projects passes.

**Completed workstreams**

- **Five priority fixes:** HMAC webhook signature verification (Domain 10 headline);
  secrets untracked + pre-commit scanning (Domain 8 headline); project-planning ownership
  enforcement (Domain 9 headline); real login throttling + OAuth verified-email hardening
  (Domain 7 headline); gateway TCP request timeouts (Domain 3 headline).
- **Theme & design system (Domain 1):** real `setPersonality()` integration tests (closes the
  over-mocked-tests headline); a JND-aware distinctiveness metric enforced as a build-failing
  test; font single-source-of-truth + web-font loading fix; `soft-touch`/`professional`
  redesign; code-generated docs matrix + Storybook "all 12" grid.
- **Money correctness (Domains 10 & 2):** store money migrated to integer cents end-to-end
  (entities, shared DTOs, UI, data-migration, edge-case tests) with every downstream consumer
  updated (gateway, owner-console, store-client, video-client, business-\* UI, ui-models);
  Fin Commander amounts standardized to cents and its plan-API backend built for real —
  tenant/profile-scoped persistence in `apps/finance`, gateway routes, seeded permissions —
  replacing the localStorage stub; 50 unit tests added for the previously-untested 810-line
  local-hub PaymentService; two latent PaymentService bugs fixed (swallowed server error
  messages; donation-route consistency).
- **Dev environment & seeds:** `docker:dev:bootstrap` validated end-to-end; nine seed error
  classes fixed and verified at zero — auth-seed 500s, availability overlaps, out-of-window
  appointments, dead `/authentication/me` calls, public-post 400s (`visibility` field not in
  DTO), community-create denial, and role-assign 403s. `local_hub_member` now grants
  `community.create` (local-hub scope) and `social.post.create` (social scope) in both
  `default-permissions.json` and `scripts/seed-permissions.sh`; the impossible seed
  self-elevation block was removed. Remaining non-fatal warnings: seeds probe
  `GET /health`, which the gateway does not define, and one pg `DeprecationWarning`.
- **LLM generation made real** (2026-07-16, all three phases of
  `docs/plans/2026-07-16-llm-generation-real.md`): the marketing generator now has genuine
  LLM authorship — a `POST /api/marketing-generator/generate` pass where the model writes
  the creative copy into the template scaffold from the brief (`generationMode: 'llm'`,
  provenance "AI-generated") — alongside the existing enrichment polish; every LLM response
  is zod-schema-validated before merging (no more regex + blind `JSON.parse`); token usage
  (prompt/completion counts, model, duration) is captured per call, aggregated at
  `GET /api/marketing-generator/usage`, logged structurally, recorded on insight events, and
  shown in the results UI; failures and id-mismatched payloads fall back honestly to
  "AI-fallback"; brief free-text is sanitized (control chars stripped, 500-char caps) before
  prompt embedding; the configured temperature is now actually sent; prompt-proxy's 1-hour
  timeout became `PROMPT_PROXY_TIMEOUT_MS` (default 120 s) with per-call usage log lines;
  `signal-foundry.md` and `mvp-overview.md` now describe the real behavior. Verified
  end-to-end against a mock Ollama: authorship merge, honest fallback, and usage counters.
- **Social authorization & privacy** implemented (2026-07-16, all three phases of
  `docs/plans/2026-07-15-social-authorization-privacy.md`): shared post-visibility scope
  (`apps/social/src/app/common/post-visibility.util.ts`) enforcing moderation/followers-only/
  scheduled/block rules across search, trending, feeds, and single-post fetch; vote identity
  server-derived at the gateway with upsert semantics + partial unique indexes + de-dup/orphan
  cleanup migration (`1775100000000-vote-dedup.ts`) — also fixed votes silently creating
  orphan rows (handlers read `Payload('id')` but the gateway sends `postId`); vote-route
  throttle now uses a working named-throttler override; profile search pushed down to a new
  `Search:Profile` command (SQL `ILike` + exclude-list + capped paging), eliminating both
  1,000-row in-memory scans. Verified live end-to-end (idempotent re-vote → one row; junk
  client profileId overridden). Corrections to the plan discovered during implementation:
  `Post` has no `deleted` column (hard delete), and unpublished _scheduled_ posts were an
  additional leak, now filtered.

**Per-domain headline status**

| #   | Domain                   | Headline issue                                 | Status                                             |
| --- | ------------------------ | ---------------------------------------------- | -------------------------------------------------- |
| 1   | Theme / Design System    | Over-mocked theme tests                        | ✅ resolved                                        |
| 3   | Gateway & Platform       | No TCP timeouts/retries                        | ✅ resolved                                        |
| 7   | Authentication           | OAuth auto-link; weak login limits             | ✅ resolved                                        |
| 9   | Forge of Will            | Zero authz on project CRUD                     | ✅ resolved                                        |
| 10  | Billing & Finance        | Forgeable webhooks                             | ✅ resolved (+ money-correctness done)             |
| 8   | DevOps & Tooling         | Committed Tailscale secret                     | 🟡 code shipped · **owner must rotate credential** |
| 2   | Towne Square / Local Hub | 810-line PaymentService, zero tests            | 🟡 unit tests added · offer-lifecycle E2E open     |
| 4   | Social & Community       | Search ignores visibility/moderation           | ✅ resolved (2026-07-16, all 3 plan phases)        |
| 5   | AI & Marketing           | Templates presented as LLM; no cost tracking   | ✅ resolved (2026-07-16, LLM authorship + usage)   |
| 6   | Video & Media            | No upload validation; unauth transcoder socket | ❌ open                                            |

**Still open (next drill-in):** Video ingest hardening, Social WebSocket backend-or-docs
decision, Local Hub offer E2E, gateway `/api/health` endpoint, circuit breakers at service
boundaries (incl. prompt-proxy), money-handling docs. **Owner action:** rotate the exposed
Tailscale credential.

---

## 1. Theme / Design System & Shared UI — 7.5/10

Sub-scores: functionality 8 · code quality 7 · tests 6 · security 7 · docs 7

Evidence (validated):

- 12 complete personalities covering typography, spacing, shadows, animations, color harmonies — `libs/theme-models/src/lib/personalities.ts` (2,056 lines).
- Runtime personality switching with font loading and persistence — `libs/theme-lib/.../theme.service.ts:251-280`; CSS variable generation `:624-807`.
- WCAG contrast validation with auto-adjust — `libs/theme-models/src/lib/contrast-utils.ts:14-128`.
- Personality Storybook stories **do exist** (`personality-showcase.stories.ts`, `personality-preview.component.stories.ts`) — first-pass claim to the contrary was refuted, hence the +0.5 adjustment.

Improvements:

1. **(High)** Integration tests for `setPersonality()` asserting generated CSS variables and font-loading completion — current `theme.service.spec.ts` is fully mocked.
2. **(Med)** Build-time validation of the Google Fonts allowlist (`font-loading.service.ts:151-171`).
3. **(Med)** Generated API docs (compodoc/TypeDoc) for `ThemeService` and `Personality`.
4. **(Low)** Matrix contrast test: 12 personalities × representative primaries × light/dark via `ensureContrast()`.
5. **(Low)** Deprecate `palette-migration.ts` once no app depends on it.

## 2. Towne Square / Local Hub — 6.5/10

Sub-scores: functionality 7 · code quality 7 · tests 5 · security 7 · docs 8

Evidence (validated):

- Commerce is genuinely implemented: classifieds, donations (one-time + recurring), business-page tiers, sponsorships, offer negotiation, wallet/payouts — `apps/local-hub/src/app/services/payment.service.ts` (810 lines), seller dashboard (1,078 lines).
- Modern Angular: standalone components, signals, member guard, SSR-safe storage.
- **Confirmed:** no `payment.service.spec.ts` exists anywhere in the app.
- E2E covers join + post-listing only; the core transaction flow is untested.

Improvements:

1. **(High)** Unit tests for PaymentService (checkout, offer accept/counter, error paths).
2. **(High)** E2E for the full offer lifecycle: post → offer → pay → confirm → funds released.
3. **(Med)** Split the 1,078-line SellerDashboardComponent into presentational components.
4. **(Med)** Document offer/payment state machines in `docs/guides/local-hub-commerce.md`.
5. **(Med)** Document rate-limiting/CSRF posture for payment endpoints.

## 3. Gateway & Platform Services — 6/10

Sub-scores: functionality 7.5 · code quality 6.5 · tests 6 · security 7.5 · docs 6

Evidence (validated):

- Strong request hygiene: global ValidationPipe with whitelist, CORS/CSP/HSTS headers (`apps/gateway/src/main.ts:28-94`), origin validation + sec-fetch-site CSRF checks (`bootstrap/security.ts:96-164`), JWT verification with optional introspection (`auth/auth.guard.ts:37-115`).
- **Confirmed:** every TCP `ClientProxy` is created with bare `{host, port}` — no retry, no timeout (`gateway-service-providers.ts:197-203`) — and no gateway controller applies `timeout()` to `firstValueFrom`. One slow microservice can hang requests indefinitely.
- Several handlers forward RPC errors unwrapped (`asset.controller.ts:121-131`, `authentication.controller.ts:129-144`).

Improvements:

1. **(Critical)** Timeout + retry on TCP clients and `firstValueFrom(obs, {timeout})` in controllers.
2. **(High)** Standardize error translation — audit all `firstValueFrom` calls, apply the existing `toHttpException` pattern.
3. **(High)** Circuit breaker (e.g., opossum) around failure-prone dependencies including S3.
4. **(Med)** Document failure modes/timeouts (`docs/services/gateway/resilience.md`).
5. **(Med)** Tests for RPC failure scenarios (timeout, malformed payload, RpcException).

## 4. Social & Community — 6/10

Sub-scores: functionality 6 · code quality 6 · tests 5 · security 5 · docs 5

Evidence (validated):

- Post/comment CRUD with DOMPurify sanitization works (`post.service.ts:85-89`).
- **Confirmed:** search returns posts with no visibility/moderation filter and loads up to 1,000 profiles into memory (`search.service.ts:72-104`) — privacy leak + scalability problem.
- **Confirmed:** docs promise WebSocket real-time (typing, read receipts, presence); the client service exists but `apps/social` has no WebSocket gateway at all. Notification debounce is 5 minutes (`notification.service.ts:29`).
- **Confirmed:** scheduled posts have full CRUD + `publishScheduledPost`, but nothing triggers publication (no cron/queue) — reachable only via RPC.
- **Confirmed:** votes have no dedup — no unique constraint, no existing-vote check (`vote.service.ts:14-21`).
- Only 11 of ~30 backend services have spec files.

Improvements:

1. **(High)** Fix the search privacy leak: filter by moderation status + privacy settings.
2. **(High)** Implement backend WebSocket handlers or correct the feature docs.
3. **(High)** Test coverage for search/poll/analytics/reaction services incl. access control.
4. **(Med)** Scheduled-post publisher (cron/queue polling `findPendingScheduledPosts`).
5. **(Med)** Vote dedup: unique `(postId, userId)` constraint + service check.
6. **(Med)** Make notification debounce configurable (5 min contradicts "real-time").

## 5. AI & Marketing Generation — 6/10

Sub-scores: functionality 7 · code quality 6 · tests 5 · security 6 · docs 5

Evidence (validated):

- Signal Foundry's brief → concepts → materials → exports pipeline is real and functional.
- **Confirmed:** concept generation maps over 6 hardcoded `CONCEPT_ANGLES` — deterministic templates, not LLM generation (`marketing-generator.service.ts:51-96`); LLM enrichment is a separate optional layer with graceful degradation.
- **Confirmed:** zero token counting or cost tracking anywhere; prompt-proxy HTTP timeout is 1 hour (`app.service.ts:19`).
- All LLM tasks target Ollama `llama3.2:3b` (`ai-orchestrator/src/assets/config.yaml:29-42`); LLM JSON parsed by regex without schema validation (`marketing-enrichment.server.ts:183-213`).

Improvements:

1. **(High)** Token counting + per-user/workspace cost tracking with observability events.
2. **(High)** Config-driven model selection with a production-grade provider option.
3. **(Med)** Zod/JSON-Schema validation of LLM responses before merging.
4. **(Med)** Adaptive timeouts + circuit breaker in prompt-proxy.
5. **(Med)** Prompt-injection sanitization on brief inputs and templates.
6. **(Low)** Align marketing copy ("LLM-powered concepts") with the template-based reality, or make generation actually LLM-driven.

## 6. Video & Media — 6/10

Sub-scores: functionality 6 · code quality 6 · tests 5 · security 5 · docs 7

Evidence (validated):

- Working two-stage ffmpeg pipeline (MP4 → HLS) with ffprobe metadata (`video-transcoder-worker/internal/transcode/worker.go:46-68`); single quality ladder, hardcoded veryfast/CRF 23.
- Clean video lifecycle state machine and HLS manifest rewriting to asset IDs.
- **Confirmed:** upload hardcodes `profileId: 'user-profile-id'` (`upload.component.ts:546`); transcoder accepts raw TCP JSON commands with no authentication (`main.go:41-69`); only client-side `accept="video/*"` validation.
- **Confirmed:** `apps/audio-workstation` and `apps/orchestra-client` have empty `src/` — pure stubs.

Improvements:

1. **(High)** Server-side MIME + magic-byte validation with an allowlist before transcoding.
2. **(High)** Wire profileId from auth context; add auth to the transcoder socket protocol.
3. **(Med)** Multi-quality tiers + variant playlists.
4. **(Med)** Server-side upload size limits + rate limiting.
5. **(Med)** Remove or implement the audio-workstation/orchestra-client stubs.

## 7. Authentication & Permissions — 5.5/10

Sub-scores: functionality 8 · code quality 7 · tests 6.5 · security 4.5 · docs 7

Evidence (validated):

- Broad feature set: login, registration, MFA, magic links, password reset, OAuth. Email tokens are SHA256-hashed, one-time, properly TTL'd (`email-auth.service.ts:178-185`). `timingSafeEqual` used in password policy.
- **Confirmed:** OAuth auto-links providers to existing accounts purely by email — no provider `email_verified` check, no consent step (`oauth.service.ts:67-86`). Account-takeover-adjacent.
- **Partial:** login lacks a route-level `@Throttle`, and while a global ThrottlerGuard exists, its limits (10000/s, "Increased for E2E") provide no practical brute-force protection.
- **Confirmed:** bootstrap controller keeps owner/activation state in static class variables with a non-timing-safe `!==` token compare (`bootstrap.controller.ts:34-78`) — broken under clustering and callable by anyone before an owner exists.
- Coverage: AppService 50.66% lines / 38.61% branches; bootstrap controller 32% lines / 0% branches.

Improvements:

1. **(Critical)** Real brute-force limits on login (e.g., 5/min/IP + per-account lockout/backoff).
2. **(High)** Require provider-verified email or explicit user confirmation before OAuth auto-link.
3. **(High)** DB-backed bootstrap tokens with expiry + `timingSafeEqual` comparison.
4. **(Med)** Tests for revocation, MFA, and OAuth link/unlink paths in AppService.
5. **(Med)** Single canonical JWT secret key; fail startup when unset.

## 8. DevOps, Deployment & Operator Tooling — 5/10

Sub-scores: functionality 7 · code quality 7 · tests 6 · security 2.5 · docs 6.5

Evidence (validated):

- **Confirmed:** `k8s/base/secrets.yaml:10-22` is git-tracked and contains a JWT secret (dev placeholder "supersecretstring") plus Tailscale OAuth client ID/secret in real tailscale oauth client-secret format — plausibly live credentials in history.
- **Confirmed:** only 3 of 47 compose services have health checks; `:latest` base images and hardcoded `storageClassName: microk8s-hostpath` in k8s base.
- Genuine strengths: ~900-line CI pipeline with matrix builds, caching, E2E, and real k6 + Lighthouse performance gating (validated); well-tested Go admin-env-wizard (14 test files, passing); production-grade multi-stage Dockerfiles (non-root, dumb-init).

Improvements:

1. **(Critical)** Rotate the committed Tailscale credentials, purge/replace `k8s/base/secrets.yaml` with External Secrets or Sealed Secrets, add pre-commit secret scanning.
2. **(High)** Health checks for >90% of compose services.
3. **(High)** Pin base images; enable Dependabot for image updates.
4. **(Med)** Configurable storage class via Kustomize overlays.
5. **(Med)** Tests for admin-env-wizard `cmd/` packages + generated-artifact smoke tests.
6. **(Med)** `docs/devops/secrets-management.md` + production runbook.

## 9. Forge of Will / Project Execution — 4/10

Sub-scores: functionality 7 · code quality 5 · tests 3 · security 2 · docs 6

Evidence (validated):

- All five marketed capabilities (projects, tasks, risks, journals, timers) structurally exist; solid TypeORM modeling; 26 polished UI components with real Storybook stories.
- **Confirmed:** zero authorization on the backend — `ProjectService.findAll` with an empty query returns every project in the database, and no `@MessagePattern` handler has any guard (`project.service.ts:36-73`, `project.controller.ts`). Any authenticated user can read/modify anyone's projects.
- **Confirmed:** backend service specs are 18-line "should be defined" boilerplate (project, risk, timer).
- Debug `console.log` in production services; generic `Error()` throws instead of HTTP exceptions.

Improvements:

1. **(Critical)** Ownership/membership enforcement on every project-planning CRUD path.
2. **(High)** Real backend service tests (CRUD, error paths, authz) — the 208-line `ag-tasks-table.component.spec.ts` is the in-repo quality bar.
3. **(Med)** Replace `console.log` with the shared logger; NestJS exception types + filters.
4. **(Med)** E2E for the core loop: project → task → timer → risk → journal.
5. **(Low)** Swagger annotations on controllers.

## 10. Billing, Payments & Finance — 3.5/10

Sub-scores: functionality 5 · code quality 5 · tests 4 · security 2 · docs 4

Evidence (validated):

- **Confirmed:** the gateway payments webhook captures the signature header and never uses it, and no HMAC verification exists anywhere downstream in apps/payments (`payments.controller.ts:811-823`, `apps/payments/src/app/app.controller.ts:440-445`). Payment/subscription events are forgeable — critical for a system that moves money (Local Hub payouts depend on this path).
- **Confirmed:** store order totals computed in floating point (`orders.service.ts:19-38`) while the billing domain correctly uses integer cents (`invoice-preview.service.ts:68`) — inconsistent money representation across the platform; Fin Commander models and CSV imports also use floats.
- **Confirmed:** `fin-commander-plan-api.service.ts` is a complete stub (every method returns `[]`/`undefined`); the product runs on localStorage.
- Good: usage-event idempotency via unique `(tenantId, appScope, eventKey)`.
- No spec files for store orders/donations services.

Improvements:

1. **(Critical)** HMAC-SHA256 webhook signature verification before processing any payment event.
2. **(High)** Integer-cents money handling in store orders + rounding tests.
3. **(High)** Standardize Fin Commander amounts to cents (models, CSV importer).
4. **(Med)** Tests for orders/donations (zero, negative, multi-item cases).
5. **(Med)** Implement the Fin Commander plan API backend (replace localStorage stub).
6. **(Low)** Money-handling + webhook-security docs for apps/payments and apps/store.

---

## Cross-cutting themes

1. **Authorization stops at the front door.** The gateway authenticates well, but downstream services (project-planning, social search, votes) rarely enforce ownership. Fixing this pattern once (a shared ownership-guard convention for `@MessagePattern` handlers) would lift several domains at once.
2. **The payment path is the single most urgent fix**: unverified webhooks + floating-point money + untested PaymentService compound into real financial risk.
3. **Test substance, not test presence.** Many domains have spec files that only assert `toBeDefined()`. Coverage numbers overstate real protection.
4. **Docs occasionally promise more than the code ships** (WebSocket real-time, "LLM-powered" concepts). Either build the missing half or align the docs.
5. **Resilience is uniformly missing** at service boundaries: no timeouts, retries, or circuit breakers on gateway TCP clients or the transcoder socket.

## Method

- First pass: 10 independent Claude Haiku reviewers, one per domain, read-only, required to cite file:line for every claim.
- Validation pass: 2 Claude Sonnet reviewers re-opened the 20 highest-impact claims. Result: 18 confirmed, 1 partial (login throttling exists but is ineffective), 1 refuted (personality Storybook stories do exist). Scores adjusted accordingly (Theme +0.5; Gateway −0.5; Auth −1; DevOps −0.5; Forge of Will −1; Billing −1.5).

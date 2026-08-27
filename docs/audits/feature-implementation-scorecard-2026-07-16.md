# Feature & Implementation Scorecard — Re-Evaluation 2026-07-16

Second-pass due-diligence re-evaluation of the repository, run after six remediation
workstreams shipped against the [2026-07-14 baseline audit](./feature-implementation-scorecard-2026-07-14.md).
Each of the 10 original domains was re-reviewed by an independent read-only subagent that
carried the baseline section, verified whether each prior finding is now fixed / partial /
open, and hunted for new issues (remediation code explicitly in scope). A new **11th domain —
Design Quality (Theme & Personality System)** — was added at the user's request and scored on
six design-specific sub-dimensions. Load-bearing claims were validated by re-opening the cited
code directly.

**Calibration note:** the baseline used Claude Haiku reviewers; this pass used Claude Sonnet
for the 10 domains and Claude Opus for the design review. Some score movement therefore
reflects a deeper reviewer, not only code change — deltas are directional, not precise. The
working tree at review time contained three shipped-but-uncommitted batches (social
authorization/privacy, real LLM generation, seed hardening); they were reviewed as-is.

## Summary

| #   | Domain                                 | Baseline | **New** | Δ    | Biggest current issue                                                       |
| --- | -------------------------------------- | -------- | ------- | ---- | --------------------------------------------------------------------------- |
| 1   | Theme / Design System & Shared UI      | 7.5      | **7.5** | —    | `ensureContrast()` stalls at RGB extremes; most auto-fixes are dead code    |
| 2   | Towne Square / Local Hub               | 6.5      | **6.5** | —    | Payment release/dispute discard caller identity — no ownership check        |
| 3   | Gateway & Platform Services            | 6.0      | **6.5** | +0.5 | Retry/circuit-breaker still absent; a shipped change breaks a test suite    |
| 4   | Social & Community                     | 6.0      | **6.5** | +0.5 | `/feed` + public comments route still bypass the new visibility scope       |
| 5   | AI & Marketing Generation              | 6.0      | **7.0** | +1.0 | prompt-proxy topology mismatch; core concepts still a 6-template scaffold   |
| 6   | Video & Media                          | 6.0      | **5.0** | −1.0 | Public unfiltered video lookup (IDOR); upload size guard deleted            |
| 7   | Authentication & Permissions           | 5.5      | **6.7** | +1.2 | Auth service still falls back to `default_jwt_secret`; bootstrap unchanged  |
| 8   | DevOps, Deployment & Operator Tooling  | 5.0      | **5.5** | +0.5 | Secret still in git history; referenced rotation runbook doesn't exist      |
| 9   | Forge of Will / Project Execution      | 4.0      | **5.0** | +1.0 | Task-notes/time-entries + all MCP tools fully unauthorized                  |
| 10  | Billing, Payments & Finance            | 3.5      | **4.0** | +0.5 | Cross-tenant Fin Commander access via client-controlled header              |
| —   | **Design Quality — Theme/Personality** | _new_    | **7.0** | new  | Token SCSS drifted across 18 copies; motion a11y opt-in; 5/12 no type voice |

**Portfolio average (10 comparable domains): ~6.0/10, up from 5.6.** Including the new design
domain, 11-domain average ≈ 6.1. The remediation genuinely moved the needle — the two lowest
domains (Billing, Forge) and the two headline-vuln domains (Auth, AI) all rose — but the
deeper second pass surfaced **new critical access-control gaps** in four domains (Local Hub
payments, Social feed/comments, Forge notes/MCP, Billing cross-tenant) that offset some gains.
The recurring theme is unchanged from the baseline: **authorization is enforced on the
front-door path that was fixed, but sibling paths and alternate transports (MCP, public
routes, direct handlers) were not swept.**

---

## Cross-cutting themes (updated)

1. **Authorization is fixed per-path, not per-domain.** Every domain that got an authz fix
   left an unfixed sibling: Social's visibility scope covers search/trending but not `/feed`
   or public comments; Forge's ownership covers 6 REST entities but not task-notes,
   time-entries, or any MCP tool; Local Hub's payment service trusts caller-supplied IDs on
   release/dispute; Billing's finance guard is defeated by a client-controlled tenant header.
   A shared, transport-agnostic ownership convention applied by audit (not by hand) remains
   the single highest-leverage fix.
2. **"End-to-end" claims are often scoped to one app.** Integer-cents landed in `apps/store`
   but not `apps/payments` (still decimal); the prompt-proxy timeout fix doesn't protect
   marketing-generator (wrong transport/port in the shipped topology); "money end-to-end"
   and "prompt-proxy hardened" both over-read.
3. **Test substance improved where remediation happened.** PaymentService (50 tests), social
   visibility (19), LLM validation, store rounding, project-planning ownership all have real
   assertions now — but the untested modules are disproportionately the unauthorized ones.
4. **Docs now mostly match code** for Theme (generated matrix verified in sync) and AI
   (honest provenance) — but DevOps references a secrets runbook that doesn't exist, and
   Social's WebSocket claim is still unresolved.
5. **Resilience is still front-door-only.** Gateway request timeouts exist; retries and
   circuit breakers do not, and the one boundary timeout fix (prompt-proxy) doesn't sit on
   the path that actually calls the LLM.

---

## 1. Theme / Design System & Shared UI — 7.5/10 (baseline 7.5, Δ —)

Sub-scores: functionality 7.5 · code quality 7 · tests 7 · security 6.5 · docs 7.5

**Verified fixes:** `theme.service.spec.ts` now runs real `setPersonality()` against actual
DOM CSS-variable output (11/11 passing — the mocked-tests headline is genuinely closed); the
JND distinctiveness metric is a real build-failing guard verified against live personality
data; the code-generated docs matrix diffs exactly against its generator script.

**New issue:** `ensureContrast()`'s auto-direction heuristic (`contrast-utils.ts:100-105`)
silently stalls when the color to adjust is already at an RGB extreme (white text can't
lighten further), so AAA-tier personalities like `minimal` fail their contrast requirement
with only a swallowed `console.warn` — reproduced live. Compounding it, most of
`validateThemeContrast()`'s computed auto-fixes (`whiteOnPrimary`, `primaryOnBackground`,
`muted`, `secondaryOnBackground`) are dead code, never applied to the rendered theme.

**Still open:** `contrast-utils.ts` (headline a11y evidence) still has zero unit tests; no
compodoc/TypeDoc for `ThemeService`/`Personality`; `palette-migration.ts` not deprecated.

**Delta:** flat — real progress on the named weakness offset by a live bug found in the exact
accessibility subsystem the baseline took at face value.

## 2. Towne Square / Local Hub — 6.5/10 (baseline 6.5, Δ —)

Sub-scores: functionality 6.5 · code quality 6.5 · tests 7.5 · security 4.5 · docs 6.5

**Verified fixes:** the 50 PaymentService unit tests are substantive (real error-path
assertions, not `toBeDefined()` stubs); the two latent bugs (swallowed server errors,
donation-route consistency) are genuinely fixed.

**New criticals (validated):** `apps/payments/src/app/app.controller.ts:103-113` —
`releaseFunds` receives `{paymentId, sellerId}` and `disputePayment` receives
`{paymentId, userId, reason}`, but both discard the caller identity and pass only `paymentId`
to the service; any authenticated caller can release/dispute _any_ payment by ID.
`releaseFunds` (`payment.service.ts:228-257`) also has no idempotency guard — repeat calls
re-credit the seller wallet.

**Still open:** offer-lifecycle E2E (none exists); SellerDashboardComponent still ~1,077
lines, unsplit and untested; integer-cents did not reach local-hub/classifieds/payments.

**Delta:** net wash — tests 5→7.5, but security 7→4.5 on the newly-found payment-authz holes.

## 3. Gateway & Platform Services — 6.5/10 (baseline 6.0, Δ +0.5)

Sub-scores: functionality 7 · code quality 6 · tests 6.5 · security 7.5 · docs 6

**Verified fix:** the headline hang risk is closed — a global `RequestTimeoutInterceptor`
(30s default) with real tests.

**New issues (validated):** the uncommitted `getPost` signature change
(`social.controller.ts:277`, added required `@User() user`) causes `social.controller.test.ts`
to fail with a **TS2554 compile error** — the whole suite (20+ tests) currently contributes
zero coverage. `getSharedPost` (`:290`) is documented "(public)" and takes an optional user
but lacks `@Public()`, so the class-level `AuthGuard` 401s anonymous requests — the "public
shared post" route isn't public. The vote-route named-throttler fix wasn't propagated to the
sibling `post`/`reaction`/`comment` routes, which remain silently unthrottled.

**Still open:** retry + circuit breaker absent; error translation in only ~2 of ~35
controllers (auth controller still collapses everything to 500); no `/api/health`.

**Delta:** +0.5 — real timeout fix, tempered by the self-inflicted test break and unfinished
resilience/error-handling work.

## 4. Social & Community — 6.5/10 (baseline 6.0, Δ +0.5)

Sub-scores: functionality 6 · code quality 6.5 · tests 6 · security 5.5 · docs 5

**Verified fixes:** the headline search-privacy leak is genuinely closed and well-tested
(`post-visibility.util.spec.ts` + `search.service.spec.ts`, 19 cases); profile search pushed
to a capped DB query; vote dedup via server-derived identity + partial unique indexes +
migration.

**New criticals (validated):** the shared visibility scope is **not applied uniformly** —
`getCommunityFeed` (`app.controller.ts:1034-1124`), backing the live `/social/feed` endpoint,
uses no visibility scope at all (no moderation filter, no scheduled-post filter, one-way block
handling). Comments bypass parent-post visibility entirely, and `POST /social/comments/find`
is `@Public()` (`gateway .../social.controller.ts:460`) — anyone can read comments on any post
regardless of privacy. `castVote` is check-then-act, not an atomic upsert (the unique index is
the real guard).

**Still open:** WebSocket backend-or-docs decision; broad service test coverage.

**Delta:** +0.5 — the exact headline leak is fixed, but a comparably severe feed/comments leak
remains, so movement is modest.

## 5. AI & Marketing Generation — 7.0/10 (baseline 6.0, Δ +1.0)

Sub-scores: functionality 8 · code quality 7 · tests 8 · security 7 · docs 7

**Verified fixes:** LLM authorship (`generate()` in `marketing-enrichment.server.ts`) is real
and zod-schema-validated (`marketing-llm.schemas.ts`) with honest fallback labeling
(`applied:false` when scaffold ids don't match); token usage is wired end-to-end
(`extractUsage` → `GET /usage` → results-page UI); brief-text sanitization and the temperature
fix are present; docs align with behavior.

**Caveats found:** authorship is an optional overlay (`includeAiPolish`, default true) on the
still-unchanged 6-item `CONCEPT_ANGLES` scaffold. Usage tracking is explicitly "not a billing
source of truth" (in-memory, resets on restart) — the baseline "cost tracking" ask is
half-addressed. **New wiring gap:** marketing-generator posts raw HTTP to
`prompt-proxy:11434`, but `prompt-proxy` in `docker-compose.yaml` is a NestJS TCP microservice
on port 3009 — so the prompt-proxy timeout/logging fix doesn't protect marketing-generator's
calls in the shipped topology (pre-existing, but it undercuts one of the four claimed fixes).

**Delta:** +1.0 — substantial, well-tested remediation that mostly avoids overclaiming.

## 6. Video & Media — 5.0/10 (baseline 6.0, Δ −1.0)

Sub-scores: functionality 5 · code quality 5 · tests 5 · security 4 · docs 7

No remediation touched this domain (confirmed by git status), so all baseline gaps persist
verbatim; the drop reflects deeper findings the first pass missed.

**New issues (validated):** `findOneVideo` (`gateway .../videos.controller.ts:164`) is
`@Public()` and forwards to a service `findOne` (`video.service.ts:48`) that — unlike
`findAll`/`findRecommended`/`findTrending` — applies no `visibility:'public'` filter, so
private/unlisted videos are readable by anyone who guesses the UUID (IDOR). A 500MB client
upload guard was added (`3ba1d946`) then deleted (`3dbe783d`) with no replacement, and the only
upload test now asserts a 750MB file uploads without error — locking the regression in as
"expected"; with no server-side size/MIME check either, there is no size limit anywhere.

**Still open (all baseline items):** hardcoded `profileId:'user-profile-id'`
(`upload.component.ts:546`); unauthenticated raw-TCP transcoder (`main.go:41-69`);
single-quality ladder; audio-workstation/orchestra-client empty stubs.

**Delta:** −1.0 — no change to the code, but the IDOR and the size-guard regression are real
and were not counted in the baseline.

## 7. Authentication & Permissions — 6.7/10 (baseline 5.5, Δ +1.2)

Sub-scores: functionality 8 · code quality 7 · tests 7 · security 6.5 · docs 7

**Verified fixes:** OAuth auto-link now requires a provider-verified email
(`oauth.service.ts:74-106`); login/MFA/reset routes get real named-throttler limits plus
per-account lockout (`app.service.ts:58-102`). Both headline vulns closed and tested.

**New/remaining (validated):** the authentication microservice still silently falls back to
`'default_jwt_secret'` in three spots (`app.module.ts:81,121,128`) and does not fail startup
when unset — while the gateway now _does_ throw (`gateway/app.module.ts:387-391`), an
unclaimed asymmetry. Bootstrap controller (`bootstrap.controller.ts:34-35,78`) still uses
static in-process state and a non-timing-safe `!==` token compare — unchanged and still
reachable. The new `local_hub_member` `community.create` grant is a capability expansion worth
explicit product sign-off (not an escalation bug).

**Delta:** +1.2 — the largest gain; two confirmed headline vulns genuinely fixed and tested.

## 8. DevOps, Deployment & Operator Tooling — 5.5/10 (baseline 5.0, Δ +0.5)

Sub-scores: functionality 7 · code quality 6.5 · tests 6 · security 4.5 · docs 6

**Verified fixes:** the secret is placeholder'd out of HEAD; a working pre-commit hook whose
regex matches the original leaked-token pattern; `:latest` eliminated from build Dockerfiles;
Dependabot now covers Docker.

**New/remaining (validated):** `k8s/base/secrets.yaml` is **still git-tracked** and the real
Tailscale secret is **still recoverable from git history** (HEAD scrubbed, history not purged);
`.gitignore` entries for it are dead no-ops since it's already tracked, and
`generate-secrets.sh` writes real secrets back into that same tracked path — a repeat-incident
footgun. `docs/devops/secrets-management.md` — referenced from three places as the rotation
runbook — **does not exist**. Healthchecks unchanged at 3/47 services; `storageClassName` still
hardcoded. `go test ./...` in `tools/admin-env-wizard` currently fails (2 broken tests) but CI
runs only 2 of 8 Go packages, and the compose/k8s parity steps run `continue-on-error: true`.

**Delta:** +0.5 — real secret-scanning + image-pinning progress; offset by history not purged,
a missing referenced runbook, and two untouched High items. **Owner action still stands:
rotate the Tailscale credential.**

## 9. Forge of Will / Project Execution — 5.0/10 (baseline 4.0, Δ +1.0)

Sub-scores: functionality 7 · code quality 5 · tests 5 · security 4 · docs 7

**Verified fix:** ownership enforcement is real and well-tested for six sub-domains
(project, task, risk, timer, change, journal) via the REST gateway — a genuine improvement
from zero anywhere — using the `project-access.util.ts` convention.

**New criticals (validated):** Task-notes and task-time-entries are unauthorized end-to-end —
neither service accepts a `requestingUserId` and the gateway
(`project-planning.controller.ts:616-791`) never forwards one, so any `forgeofwill_planner`
can read/edit/delete anyone's notes and time entries. All five MCP agent tools
(`apps/gateway/src/app/mcp/*`) pass no identity and have no guards, leaving the same data fully
unscoped through the MCP transport.

**Still open:** `console.log` in production services and generic `throw new Error()` (not
`RpcException`) persist, inconsistent with the new convention.

**Delta:** +1.0 — real ownership for the core entities; security reaches only 4/10 because two
REST sub-domains and the whole MCP surface remain unauthorized.

## 10. Billing, Payments & Finance — 4.0/10 (baseline 3.5, Δ +0.5)

Sub-scores: functionality 6 · code quality 5 · tests 5 · security 2 · docs 3

**Verified fixes:** webhook HMAC verification is done right — timing-safe, computed over the
raw body (`payments-webhook.ts:14-32`; raw-body capture at `main.ts:96-105`), fail-closed,
and tested (accept/tamper/wrong-secret/missing-secret cases). Store money is integer cents
end-to-end with a genuine float-drift regression test. Fin Commander has a real
tenant-scoped backend replacing the localStorage stub.

**New critical (validated):** the Fin Commander finance routes gate on a **client-controlled**
`x-finance-tenant-id` header (`finance.controller.ts:210+`), and the reviewer traced that the
`finance_member` role every profile receives is assigned with a NULL `targetId`, making the
permission-target match a no-op — so any authenticated finance user can read/write any other
tenant's plans/goals/scenarios by setting the header. Security stays at 2/10: a new critical
of equal severity replaced the old headline.

**Scope caveats:** integer-cents did **not** reach `apps/payments` (still decimal columns +
float fee math); webhook path has **no replay protection** (no nonce/event-id dedup).

**Delta:** +0.5 — webhook + store-cents are real wins; the cross-tenant hole and
payments-domain float money keep security pinned at the bottom.

---

## 11. Design Quality — Theme & Personality System — 7.0/10 (new domain)

Sub-scores: visual identity & distinctiveness 8 · token architecture 6 · accessibility 6 ·
typography 7 · cross-app consistency 6 · docs & tooling 8

A design-lead review of the ~26k-line theme/personality corpus (12 personalities, the token
engine, 18 consumer libs, 9 motion backgrounds, Storybook, generated docs).

**Strengths:** the 12 personalities are structurally distinct and the JND distinctiveness
metric is genuinely rigorous with build-failing thresholds; the generated docs matrix and the
All-12 Storybook grid (light+dark) make a real design-review surface; the personality token
vocabulary (17 `--personality-*` categories) is thoughtfully chosen.

**Weaknesses (validated):**

1. **The token layer has already drifted.** `personality-tokens.scss` is copy-pasted into 18
   libs; 15 are byte-identical but 3 have diverged (verified: `form-ui`, `forum-ui`,
   `social-ui`). The duplication is failing in practice — it needs one shared partial.
2. **Distinctiveness is structural, not chromatic.** The JND metric compares harmony
   _parameters_ but never the _generated_ color, so two personalities on the same primary can
   render near-identical palettes. And 5/12 personalities (classic, minimal, bold,
   professional, foundation) use identical heading/body font families — no typographic voice —
   while elegant/architect/soft-touch/electric/playful carry real pairing character.
3. **Accessibility is opt-in.** All 9 motion backgrounds gate on an `@Input() reducedMotion`
   flag with no intrinsic `@media (prefers-reduced-motion: reduce)` fallback, so an app that
   forgets to wire it animates regardless; and the runtime `contrast-verification.ts` is never
   invoked on personality apply (only generation-time `ensureContrast` runs — and see Domain 1
   for its stall bug).

**Improvement priorities:** (H) collapse the 18 SCSS copies to one shared partial and
reconcile the 3 drifted ones; (H) give the 5 voiceless personalities distinct font pairings;
(H) add an intrinsic reduced-motion fallback to motion-ui; (M) extend the JND metric to sample
generated color, not just harmony params; (M) invoke runtime contrast verification on apply;
(L) unit-test `contrast-utils.ts`.

---

## Method

- **Re-review pass:** 10 independent Claude Sonnet reviewers (one per baseline domain,
  read-only, file:line citations required), each given its baseline section and asked to
  verify prior findings + hunt new issues. 1 Claude Opus reviewer for the new design domain
  across six sub-dimensions.
- **Validation:** the highest-impact and most severe claims (payment-authz, social feed/comments
  leak, gateway test break + non-public shared route, auth JWT fallback, video IDOR, billing
  cross-tenant header, design SCSS drift) were re-verified by re-opening the cited code
  directly; every spot-checked claim held.
- **Caveats:** Sonnet/Opus reviewers read deeper than the baseline's Haiku pass, so some delta
  is reviewer calibration; scores are directional. The working tree carried three
  shipped-but-uncommitted batches, reviewed as-is. This document does not re-score the
  baseline — it records the current state and the movement since 2026-07-14.

# OT + Towne Square Public Release Readiness Audit

**Started:** 2026-10-05

**Scope:** `apps/client-interface` (Optimistic Tanuki), `apps/local-hub` (Towne Square), shared user-facing libraries/services required by their primary workflows, and the shared HAI product-navigation surface.

**Companion standard:** [HAI philosophy](../product/HAI-PUBLIC-GOOD-PHILOSOPHY.md)

**Status:** Active audit / execution plan
**Product intent authority:** The owner-supplied audit and philosophy define the baseline below. RR-00 preserves that intent; runtime conformity is evaluated in later slices. Changes to product boundaries require an explicit documented owner decision/ADR.

---

## 1. Goal

Determine whether Optimistic Tanuki (OT) and Towne Square (TS) meet a responsible public-release standard, document every material gap, and provide small, agent-consumable implementation slices to close those gaps.

This is both:

1. a **release-readiness audit**, and
2. a **marketing truth audit**.

Marketing should be written from accepted product behavior rather than asking implementation to catch up with aspirational copy.

The release target is:

> **Everything we advertise works, private things stay private, primary workflows do not predictably break, and an ordinary person can understand the product without its creator standing beside them.**

---

## 2. Audit discipline

This audit follows the repository's existing acceptance discipline:

- **Source evidence is not acceptance.**
- **Unit tests are not automatically end-to-end acceptance.**
- **A route or component existing does not prove the user journey works.**
- **A feature in a plan does not mean it is released.**
- **No slice is `ACCEPTED` until its stated acceptance checks have been exercised.**

### Status values

| Status         | Meaning                                                           |
| -------------- | ----------------------------------------------------------------- |
| `PLANNED`      | Scope and acceptance criteria exist; audit/execution not started. |
| `AUDITING`     | Evidence collection in progress.                                  |
| `GAP FOUND`    | Material release gap confirmed.                                   |
| `IMPLEMENTING` | Remediation work in progress.                                     |
| `VERIFYING`    | Implementation exists; acceptance checks pending.                 |
| `ACCEPTED`     | All acceptance criteria have evidence.                            |
| `DEFERRED`     | Explicitly judged non-blocking for the intended launch.           |
| `BLOCKED`      | Cannot proceed without an external decision/dependency.           |

### Severity values

| Severity | Meaning                                                                                                                                                                  |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `P0`     | Blocks deliberate public promotion/release. Broken critical flow, security/privacy violation, destructive behavior, materially false claim, or similarly serious defect. |
| `P1`     | Launch-quality gap. Product may function, but ordinary users are likely to be confused, excluded, misled, or encounter unprofessional behavior.                          |
| `P2`     | Valuable post-launch improvement; not required for a responsible initial public release.                                                                                 |

### Advertised-claim disposition

Every public claim discovered during the audit must receive one of these dispositions:

| Disposition | Meaning                                                                                                                            |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `VERIFY`    | Claim appears implemented; prove it through the required acceptance evidence.                                                      |
| `COMPLETE`  | Claim is not yet fully true, but the implementation and validation can responsibly fit inside one bounded release-readiness slice. |
| `REWORD`    | The underlying capability exists, but the public wording overstates, obscures, or misdescribes it.                                 |
| `RETRACT`   | Remove the present-tense claim until substantial future work is completed.                                                         |
| `DEFER`     | Valid future direction, but explicitly roadmap-only for the current release.                                                       |

A claim assigned `COMPLETE` may remain part of the intended release only if its implementation, validation, privacy/authorization implications, failure states, and user-facing behavior fit in a single bounded slice.

A claim must not remain presented as currently available while its `COMPLETE` slice is unfinished.

### Deferred Feature Register

The audit must maintain a running register of features that are strategically valid but too expensive, risky, broad, or dependency-heavy to complete within the current public-release program.

Deferral is not equivalent to rejection.

Each deferred item must record enough analysis that a later agent can understand why it was deferred and what would be required to resume it without repeating the same discovery work.

For each deferred feature, record:

- **ID** — stable identifier such as `DF-001`.
- **Product** — OT, TS, shared HAI, or another affected surface.
- **Feature / claim** — concise description.
- **Why it matters** — user/product value.
- **Current state** — absent, prototype, partial, behind PR, backend-only, UI-only, etc.
- **Reason for deferral** — scope, infrastructure, product ambiguity, legal/operational risk, security/privacy complexity, cost, missing dependencies, or validation burden.
- **Implementation estimate** — relative effort (`S`, `M`, `L`, `XL`) and a short explanation.
- **Validation estimate** — relative effort (`S`, `M`, `L`, `XL`) and why validation is expensive.
- **Dependencies** — technical, product, operational, or external prerequisites.
- **Risk profile** — privacy, security, moderation, data integrity, operational, abuse, or reputational risks.
- **Marketing disposition** — usually `RETRACT` or clearly labeled `DEFER`.
- **Revisit trigger** — concrete condition that should cause the feature to be reconsidered.
- **Related slices / PRs / ADRs** — where future work should begin.
- **Last reviewed** — date and, where useful, the relevant repository state/commit.

Relative-effort guidance:

- `S` — comfortably fits in one bounded slice with straightforward acceptance.
- `M` — likely one substantial slice or two small slices; limited cross-system impact.
- `L` — multiple slices, cross-service changes, significant E2E/operational validation.
- `XL` — program-level work, major architecture, legal/operational capability, federation, payments, reputation systems, or similarly broad efforts.

A feature should normally enter the Deferred Feature Register when any of the following are true:

1. It cannot be implemented **and validated** in one bounded release-readiness slice.
2. It introduces a new persistent service, payment flow, moderation/reputation system, legal obligation, or security boundary.
3. It depends on unresolved product policy.
4. It requires production operational capability that does not yet exist.
5. Its validation cost is materially larger than its implementation cost.
6. Completing it would distract from a P0/P1 launch requirement with greater user value.

The register is intended to preserve product ambition without allowing aspirational features to silently expand the current launch scope.

---

## 3. Product intent baseline

### Optimistic Tanuki

Core promise:

> **You are the social network.**

OT is people- and interest-centered. Groups/communities are free-form and optional but encouraged.

Primary principles to verify:

- primary user/community feeds are non-engagement-ranked;
- discovery/trends/suggestions are separate from primary feeds;
- private-community posts never escape the private community;
- public-community posts reach outside the community only when the author explicitly chooses public visibility;
- forums remain first-class durable/slow discussion;
- chat, feed, and forum serve different conversational tempos;
- OT is intended to remain free to use;
- OT should not claim adoption/scale it does not have.

### Towne Square

Core promise:

> **Towne Square is organized around place.**

Primary principles to verify:

- geographic/locality focus remains the product boundary;
- users can belong where a place is meaningfully part of their life, not only where they sleep;
- public locality/community browsing works without login where intended;
- classifieds and local exchange are a primary acquisition/usefulness hook;
- released marketing describes only implemented functionality;
- Daylight becomes marketable only after its PR, deployment, and acceptance checks complete;
- civic usefulness should be practical rather than preachy.

### HAI relationship

- OT and TS are sibling HAI apps.
- Shared identity/login should reduce friction.
- The shared HAI floating tag/app surface is the primary persistent ecosystem-navigation mechanism.
- Do not add redundant persistent cross-promotion unless evidence shows the shared mechanism is insufficient.

---

## 4. Initial verified findings

These findings are based on repository source/plan evidence. Runtime acceptance remains outstanding unless explicitly stated.

### F-001 — OT landing page contains unsupported scale claim

**Severity:** P0 — truth-in-marketing

**Area:** OT marketing

**Evidence:** Current OT landing copy includes language equivalent to "Join thousands of groups already building their own networks." Current project state does not support that adoption claim.

**Expected:** No invented user/community counts or fabricated social proof.

**Remediation:** Replace with honest early-stage invitation language.

**Slice:** RR-01.

**RR-01 update (2026-10-05):** Copy remediated; see [findings](./findings/RR-01.md). This resolves the identified wording, not acceptance of the associated product behavior.

### F-002 — OT positioning does not fully reflect intended product model

**Severity:** P1

**Area:** OT positioning/onboarding

**Evidence:** Current landing emphasizes starting a group network, while intended product philosophy is "you are the social network": user-centered graph, relationships, optional communities, broader public network, separate discovery.

**Expected:** First-run/public copy explains the user-centered graph accurately.

**Remediation:** Rewrite landing hierarchy and HAI app metadata after core behavior audit confirms claims.

**Slice:** RR-01.

**RR-01 update (2026-10-05):** Copy remediated; see [findings](./findings/RR-01.md). This resolves the identified wording, not acceptance of the associated product behavior.

### F-003 — OT HAI tag copy is architecture-oriented rather than user-oriented

**Severity:** P1

**Area:** Shared HAI ecosystem UI

**Evidence:** OT is described as "The broader HAI social and utility ecosystem" / a "social, messaging, and utility layer."

**Expected:** User-facing HAI tag explains what OT is useful for, not how it fits internal architecture.

**Remediation:** Rewrite after product language is accepted.

**Slice:** RR-02.

**RR-02 update (2026-10-05):** Shared-surface remediation has frontend evidence; full acceptance remains VERIFYING. See [findings](./findings/RR-02.md).

### F-004 — Towne Square landing advertises functionality ahead of implementation

**Severity:** P0 — truth-in-marketing

**Area:** TS marketing

**Evidence:** Current TS landing includes moderation/reputation implications, community funding/donations, business "Pro Tier," featured placement, and analytics while the Local Hub product plan records moderation/reputation and payments as not implemented.

**Expected:** Public landing describes released behavior only.

**Remediation:** Remove/hide unreleased claims until implementation is accepted; do not soften them into ambiguous present tense.

**Slice:** RR-01.

**RR-01 update (2026-10-05):** Copy remediated; see [findings](./findings/RR-01.md). This resolves the identified wording, not acceptance of the associated product behavior.

### F-005 — Daylight is not yet a released production capability

**Severity:** P1 until marketed; P0 if advertised as live before acceptance

**Area:** TS / civic briefing

**Evidence:** PR #275 "Integrate the Daylight feed into Local Hub" is open and not merged as of audit start.

**Expected:** Daylight appears in production marketing only after merge, deployment, and RR-07 acceptance.

**Remediation:** Treat as release candidate.

**Slice:** RR-07.

### F-006 — OT floating-chat open method appears recursively self-calling

**Severity:** P0 candidate; runtime verification required

**Area:** OT messaging

**Evidence:** `AppComponent.openChat(conversationId)` finds a matching contact and calls `this.openChat(contact.id)` again rather than delegating to a distinct selection/open action. If `contact.id === conversationId`, this is unbounded recursion.

**Expected:** Selecting a conversation opens it without recursion/crash.

**Remediation:** Reproduce with focused test/runtime, fix through the shared/appropriate chat API, then add regression coverage.

**Slice:** RR-05.

### F-007 — Shared HAI tag is already present in both app shells

**Severity:** Informational / positive finding

**Area:** HAI ecosystem navigation

**Evidence:** Both OT and TS import/configure `HaiAboutTagComponent`.

**Expected:** Audit the existing mechanism rather than add a second persistent cross-product switcher.

**Remediation:** Validate links, copy, keyboard/touch accessibility, responsive behavior, and logged-in/logged-out behavior.

**Slice:** RR-02.

**RR-02 update (2026-10-05):** Shared-surface remediation has frontend evidence; full acceptance remains VERIFYING. See [findings](./findings/RR-02.md).

---

## Local private-repository dependency: `retumbl`

The reputation prototype lives in the private repository:

`https://github.com/cjrutherford/retumbl`

The repository is expected to be **cloned locally on the machine where the implementation/audit agent runs**. It may not be available through the GitHub connector or GitHub App installation.

Agents working RR-14 should:

1. Look for a local sibling checkout before treating repository access as blocked.
2. Prefer a path supplied by the operator when one is available.
3. If no path is supplied, inspect reasonable sibling locations relative to the current monorepo checkout, but do not modify the private repository unless explicitly instructed.
4. Treat `retumbl` as a source/prototype to evaluate, not as authoritative production code.
5. Record the exact commit SHA reviewed.
6. Do not copy secrets, private configuration, credentials, or unrelated proprietary content from `retumbl` into the Optimistic Tanuki monorepo.
7. Reuse concepts/code only after licensing/ownership compatibility and architectural fit are confirmed.
8. If the local clone is unavailable, mark RR-14 blocked and continue other slices rather than guessing about its implementation.

The intended outcome is a documented `reuse / adapt / rewrite / reject` decision for each relevant reputation/trust subsystem.

## 5. Intended slice registry

The `RR-xx` namespace is intentionally separate from existing product/engineering slice numbers.

| Slice | Title                                                                     | Initial status                   | Primary severity  |
| ----- | ------------------------------------------------------------------------- | -------------------------------- | ----------------- |
| RR-00 | Philosophy, scope, and release contract                                   | ACCEPTED; see findings/RR-00.md  | P0/P1 foundation  |
| RR-01 | Product truth and public marketing audit                                  | VERIFYING; see findings/RR-01.md | P0                |
| RR-02 | HAI ecosystem identity/tag/shared-login UX                                | VERIFYING                        | P1                |
| RR-03 | Authentication, registration, session, and account lifecycle              | VERIFYING                        | P0                |
| RR-04 | OT feed, discovery, follows, visibility, and privacy                      | GAP FOUND                        | P0                |
| RR-05 | OT communities, forum, chat, and messaging                                | GAP FOUND                        | P0                |
| RR-06 | TS locality browsing, membership, classifieds, and buyer/seller messaging | PLANNED                          | P0                |
| RR-07 | Daylight civic feed release acceptance                                    | BLOCKED on PR/deployment         | P1/P0-if-marketed |
| RR-08 | Safety, reporting, blocking, moderation, and authorization boundaries     | PLANNED                          | P0                |
| RR-09 | Accessibility, responsive/mobile, themes, and motion                      | PLANNED                          | P1                |
| RR-10 | Reliability, error recovery, uploads, sockets, and degraded states        | PLANNED                          | P0/P1             |
| RR-11 | Legal/support/privacy/account deletion and public-operational basics      | PLANNED                          | P0/P1             |
| RR-12 | End-to-end launch gate and regression matrix                              | PLANNED                          | P0                |
| RR-13 | Final public positioning, onboarding, and launch marketing package        | PLANNED                          | P1                |
| RR-14 | Reputation prototype evaluation and migration path (`retumbl`)            | PLANNED; local access confirmed  | P1/P2             |
| RR-15 | Federation/self-hosting feasibility and architecture decision             | AUDITING                         | P1/P2 strategic   |

---

# 6. Slice definitions

## RR-00 — Philosophy, scope, and release contract

**Status:** ACCEPTED. [Findings and acceptance evidence](./findings/RR-00.md).

**Goal:** Enshrine shared product principles and define what "public ready" means.

### Deliverables

- Add the shared HAI product/public-good philosophy document.
- Link it from repository agent guidance.
- Record OT and TS product boundaries.
- Establish severity/status vocabulary.
- Establish the rule that acceptance requires evidence, not source presence.

### Acceptance criteria

- [x] Philosophy document is committed in a stable repo location.
- [x] `AGENTS.md` links to it and tells agents to treat it as normative.
- [x] OT and TS product intent in this audit matches owner intent.
- [x] RR slice registry is committed and becomes the release-readiness source of truth.
- [x] Any future exception to core philosophy requires an explicit project ADR or equivalent documented decision.

---

## RR-01 — Product truth and public marketing audit

**Status:** VERIFYING. [Findings](./findings/RR-01.md) and [claim inventory](./findings/RR-01-CLAIMS.md). Live authenticated review remains outstanding.

**Goal:** Reconcile every public claim through `VERIFY`, `COMPLETE`, `REWORD`, `RETRACT`, or `DEFER`, while preserving strategically valuable deferred features in the Deferred Feature Register.

### OT checks

- [x] Remove fabricated scale/social-proof claims.
- [x] Inventory every feature claim on `/`.
- [x] Map every claim to accepted behavior or remove/qualify it.
- [x] Reframe around "You are the social network."
- [x] Explain communities as optional shared nodes/spaces rather than the entire product.
- [x] Explain private/public community-post visibility accurately.
- [x] Distinguish primary feed from Explore/discovery.
- [ ] Confirm "free" language against actual monetization/account requirements.

### TS checks

- [x] Inventory every claim on `/`.
- [x] Remove/disable present-tense claims for unimplemented payments/donations/Pro analytics/moderation/reputation.
- [ ] Lead with local utility, communities, classifieds, and messaging that actually work.
- [x] Do not market Daylight as released until RR-07.
- [x] Confirm city/community statistics are live/real rather than placeholders before showing them as factual counts.

### Acceptance evidence

- Screenshot/copy inventory before and after.
- Route/action mapping for each surviving feature claim.
- Every advertised claim has a recorded disposition: `VERIFY`, `COMPLETE`, `REWORD`, `RETRACT`, or `DEFER`.
- Any `COMPLETE` claim has a single bounded implementation/validation slice.
- Any expensive deferred capability has a Deferred Feature Register entry with implementation and validation analysis.
- Public pages reviewed logged out and logged in.
- No known fabricated social proof or unreleased present-tense claim remains.

---

## RR-02 — HAI ecosystem identity/tag/shared-login UX

**Goal:** Make the existing HAI relationship understandable and useful without redundant UI.

### Checks

- [ ] HAI tag appears where intended in both apps.
- [x] Keyboard access and focus behavior work.
- [x] Touch/mobile placement does not obscure primary controls/content.
- [x] OT and TS app descriptions are user-facing and accurate.
- [ ] Sibling-app links resolve to correct public origins/routes.
- [ ] Shared credentials and separate sign-in sessions are tested rather than assumed.
- [x] Switching products does not imply shared local state that is actually app-specific.
- [x] Logged-out behavior is understandable.
- [x] HAI tag does not create an accessibility trap or persistent nuisance.

### Acceptance evidence

- Desktop + mobile viewport E2E.
- Keyboard-only interaction.
- Cross-app navigation test.
- Same-account login test with separate sign-in sessions, switching OT -> TS and TS -> OT (operator-confirmed product model).

---

**RR-02 update (2026-10-05):** VERIFYING. Checked items have local frontend evidence; authenticated placement, live reverse navigation, and real same-account login remain open. See [findings](./findings/RR-02.md).

**Delivery boundaries:** RR slices do not automatically require separate PRs or releases. Email transport is one shared repair; RR-05/RR-06 own product-level validation and only need repair PRs for confirmed blocking defects. See [PR boundaries and release gates](./EXECUTION-PLAN.md#pr-boundaries-and-release-gates).

## RR-03 — Authentication, registration, session, and account lifecycle

**Goal:** Validate the identity foundation shared by both products.

### Checks

- [x] Registration works from fresh browser state. (real development-stack browser evidence; auto-verified accounts).
- [x] Login works. (real development-stack browser evidence; auto-verified accounts).
- [ ] OAuth paths that are presented to users work.
- [ ] Profile-required routing is understandable.
- [x] Session restore works after refresh. (real development-stack browser evidence; auto-verified accounts).
- [ ] Expired/revoked session returns user to a safe state.
- [x] Logout clears expected client/session state. (real development-stack browser evidence; auto-verified accounts).
- [x] Cross-app shared credentials/session behavior matches product claims. (real development-stack browser evidence; auto-verified accounts).
- [x] Duplicate registration and invalid credentials show human-readable errors (local browser contract evidence).
- [ ] Password reset/email auth routes work if exposed.
- [x] Account deletion/export behavior is identified and documented (implementation remains RR-11).

### P0 conditions

Auth bypass, stale-user data after logout, cross-account leakage, unusable registration/login, or a misleading shared-login promise.

**RR-03 update (2026-10-05):** VERIFYING. Session/profile safety regressions remediated; real authentication service, browser contract checks and three real development-stack browser flows passed. OAuth/email completion and full account lifecycle evidence remain open. Operator confirmed verification delivery; missing gateway SMTP environment wiring explains log-only invitations in Compose and is repaired here, with invite receipt/claim rechecks carried into RR-05/RR-06. See [findings](./findings/RR-03.md).

---

## RR-04 — OT feed, discovery, follows, visibility, and privacy

**Status:** GAP FOUND. [Findings and real-stack privacy gates](./findings/RR-04.md). Anonymous post-read bypass repaired; private-community and realtime content disclosures remain P0. Following-feed, explicit audience, and source-sharing gaps also confirmed. No privacy acceptance or promotion waiver.

**Goal:** Verify OT's defining control/visibility philosophy in real behavior.

### Checks

- [ ] Primary feed ordering is documented and tested.
- [ ] Primary feed does not silently use engagement-maximizing ranking.
- [ ] Explore/trending/suggestions are separate surfaces.
- [ ] Follow/unfollow behavior works.
- [ ] Post audience is visible before publishing.
- [ ] Private-community posts cannot be fetched/discovered by unauthorized users.
- [ ] Public-community posts do not become globally public unless the post is explicitly public.
- [ ] Direct post URLs enforce the same visibility policy.
- [ ] Search does not leak private content.
- [ ] Notifications do not leak private content previews.
- [ ] Shares/reposts preserve or narrow source visibility; never broaden it silently.
- [ ] Deleted/restricted content disappears consistently from feed/search/direct routes.

### Required evidence

API authorization tests + browser E2E with at least two users and multiple community/privacy states.

---

## RR-05 — OT communities, forum, chat, and messaging

**Goal:** Verify the main relationship/discussion surfaces.

### Communities

- [ ] Find/join/create behavior matches permissions.
- [ ] Member management authorization is server-enforced.
- [ ] Public/private community state is understandable.
- [ ] Community feed privacy matches RR-04.
- [ ] Community chat works on desktop/mobile.

### Forum

- [ ] Main forum works for its intended authenticated/public states.
- [ ] Topic/reply permissions are enforced.
- [ ] Durable URLs survive navigation/refresh.
- [ ] Forum is usable as a slower long-form surface.
- [ ] Document gap/plan for per-community forums if not implemented; do not market them as existing.

### Messaging/chat

- [ ] Reproduce or clear F-006 recursive `openChat` concern.
- [ ] Conversation list loads.
- [ ] Opening a conversation works.
- [ ] Sending/receiving works across two users.
- [ ] Reconnect does not duplicate/drop messages unexpectedly.
- [ ] Read/typing/reaction claims are tested if marketed.
- [ ] Block/privacy behavior affects messaging correctly.

### Acceptance evidence

Focused unit regression for confirmed defects plus two-user browser E2E.

**Invite follow-up (2026-10-05):** Operator reports invite email only logs. RR-03 repairs omitted gateway SMTP environment wiring; this slice must validate actual invite receipt and claim behavior. See [RR-03 findings](./findings/RR-03.md).

---

## RR-06 — TS locality browsing, membership, classifieds, and messaging

**Goal:** Validate Towne Square's currently released core.

### Public locality experience

- [ ] `/`, `/cities`, city detail, `/communities`, and public community pages work logged out.
- [ ] City/locality route parameters remain consistent across nested routes.
- [ ] Empty/no-supported-locality states are useful.
- [ ] Locality membership language does not imply strict residency unless enforced.

### Membership

- [ ] Join/unjoin works.
- [ ] Nonmembers can browse what product policy says is public.
- [ ] Member-only actions are enforced by API authorization, not only route guards.

### Classifieds

- [ ] Browse listing.
- [ ] View detail.
- [ ] Create with image(s).
- [ ] Edit own listing.
- [ ] Mark/update status as supported.
- [ ] Delete/remove own listing.
- [ ] Unauthorized users cannot edit another seller's listing.
- [ ] City and community classified routes both work.

### Buyer/seller messaging

- [ ] Contact Seller starts the intended conversation.
- [ ] Seller receives and can reply.
- [ ] Listing context is understandable in the conversation.
- [ ] Deleted/sold listing behavior is sensible.

### Acceptance evidence

Logged-out browser path plus two-user member/buyer/seller E2E.

**Invite follow-up (2026-10-05):** Operator reports invite email only logs. RR-03 repairs omitted gateway SMTP environment wiring; this slice must validate actual invite receipt and claim behavior. See [RR-03 findings](./findings/RR-03.md).

---

## RR-07 — Daylight civic feed release acceptance

**Goal:** Make Daylight a trustworthy TS feature, not merely a merged feature.

**Current dependency:** PR #275 is open at audit start.

### Checks after merge/deployment

- [ ] Civic briefing service deploys in production-like environment.
- [ ] Supported locality list is explicit.
- [ ] Every briefing item has traceable source provenance.
- [ ] Source links are usable.
- [ ] Daily/weekly cadence matches locality activity.
- [ ] Empty days and source failures do not fabricate a briefing.
- [ ] AI/generated summarization clearly distinguishes source facts from synthesis where necessary.
- [ ] Dates/timezones are correct for locality.
- [ ] PDF/OCR failures degrade safely.
- [ ] No source is represented as successfully ingested when retrieval failed.
- [ ] TS UI communicates freshness ("updated at", briefing period).
- [ ] At least the initial ~6 test localities are acceptance-tested.
- [ ] Marketing copy is added only after these checks pass.

### Acceptance evidence

Per-locality source trace samples, failure-path tests, production-like E2E, and manual comparison against source material.

---

## RR-08 — Safety, reporting, blocking, moderation, and authorization boundaries

**Goal:** Ensure advertised safety controls exist and access boundaries hold.

### OT

- [ ] Block works.
- [ ] Mute works.
- [ ] Reporting works.
- [ ] Privacy settings affect relevant reads/actions.
- [ ] Community moderator/member-management actions are permission checked server-side.

### TS

- [ ] Do not claim full moderation/reputation system until implemented.
- [ ] Determine minimum abuse-report path required for initial public release.
- [ ] Validate seller/user blocking behavior if available.
- [ ] Validate membership/action authorization.

### Shared

- [ ] Rate/abuse controls for public write endpoints are identified.
- [ ] User-generated asset/content permissions are checked.
- [ ] Admin/mod actions are auditable where implemented.

---

## RR-09 — Accessibility, responsive/mobile, themes, and motion

**Goal:** Ensure ordinary public use is not desktop/mouse-only.

### Checks

- [ ] Keyboard-only navigation through all critical workflows.
- [ ] Visible focus.
- [ ] Modal focus trap/restore.
- [ ] Form labels/errors.
- [ ] Screen-reader names for icon-only controls.
- [ ] Appropriate live announcements.
- [ ] Contrast in supported themes.
- [ ] Reduced-motion preference respected by decorative/personality motion.
- [ ] 320–375px phone widths usable without blocked actions.
- [ ] Tablet and common desktop layouts.
- [ ] HAI floating tag does not cover primary mobile controls.
- [ ] Touch targets reasonable.

### Acceptance evidence

Automated accessibility scan where available + manual keyboard/mobile checks.

---

## RR-10 — Reliability, error recovery, uploads, sockets, and degraded states

**Goal:** Make failure survivable and understandable.

### Checks

- [ ] API timeout states.
- [ ] 401/403 handling.
- [ ] 404/deleted content.
- [ ] 500 handling.
- [ ] Asset upload failure/retry.
- [ ] Oversize/invalid asset behavior.
- [ ] WebSocket disconnect/reconnect.
- [ ] Duplicate real-time event handling.
- [ ] Empty data states.
- [ ] Slow-loading states.
- [ ] Form double-submit prevention/idempotency where needed.
- [ ] User-entered text is not lost unnecessarily on recoverable failure.
- [ ] SSR/direct deep-link behavior works on public routes.

---

## RR-11 — Legal/support/privacy/account deletion and public-operational basics

**Goal:** Ensure a public user knows the rules, how data is handled, and how to get help.

### Inventory/decisions

- [ ] Privacy policy location.
- [ ] Terms/community-use expectations.
- [ ] Support/contact route.
- [ ] Abuse/report contact route.
- [ ] Account deletion mechanism/process.
- [ ] Data export mechanism/process.
- [ ] Cookie/tracking behavior documented accurately.
- [ ] Donation/free-forever language documented carefully.
- [ ] Age requirements decided.
- [ ] DMCA/copyright contact/process if public UGC warrants it.
- [ ] Service status/outage communication approach identified.

Legal review may be needed for final wording; this slice's engineering goal is that the product behavior and operational process exist and do not contradict published text.

---

## RR-12 — End-to-end launch gate and regression matrix

**Goal:** Make public readiness reproducible.

### Required launch matrix

At minimum:

**OT**

- visitor -> register -> profile -> feed;
- user A follows/interacts with user B;
- private community visibility isolation;
- public community + private/public post combinations;
- community membership/member management;
- forum topic/reply;
- direct message send/receive;
- block/report/privacy;
- mobile critical flow.

**TS**

- visitor browses locality/community/classified;
- register/login/shared identity;
- join community;
- create/edit/delete classified;
- second user contacts seller;
- seller replies;
- authorization negative cases;
- mobile critical flow;
- Daylight paths when RR-07 accepted.

### Launch gate

Public promotion requires:

- [ ] No open P0 finding.
- [ ] Every P1 finding is either fixed or explicitly accepted/deferred with rationale.
- [ ] Critical E2E matrix is green in a production-like environment.
- [ ] Public marketing has been rechecked against accepted features.
- [ ] Known limitations are documented.

---

## RR-14 — Reputation prototype evaluation and migration path (`retumbl`)

**Goal:** Determine whether the existing private `cjrutherford/retumbl` prototype contains reputation/trust concepts that should be adapted into OT/TS rather than rebuilt.

**Current dependency:** Local access confirmed by the operator on 2026-10-05 at `/home/cjrutherford/workspace/retumbl`; mapping HEAD `9f2c1cc76cad41208cdbe8104682d2bc0c196491`. Repository access is no longer blocked. Status is `PLANNED`; architecture/reputation evaluation has not been completed. Record the actual reviewed SHA and working-tree state when execution begins; inspect read-only and do not copy secrets or private configuration.

### Questions to answer once accessible

- [ ] What problem does the prototype actually solve: user reputation, content reputation, moderator trust, peer trust, anti-abuse scoring, federation trust, or something else?
- [ ] Is reputation global, per-community, per-instance, per-domain, or contextual?
- [ ] What events affect scores?
- [ ] Are scores public, private, explainable, appealable, and reversible?
- [ ] Can users be harmed by brigading, Sybil attacks, collusion, retaliation, or inherited reputation?
- [ ] Are negative actions automated or advisory?
- [ ] Is there a durable audit/event log behind score changes?
- [ ] Does the prototype have APIs/data models reusable inside the Nx monorepo?
- [ ] Can the logic be separated from its original UI/runtime?
- [ ] What privacy data does it require?
- [ ] How would it behave across federated instances?
- [ ] Can a community opt out or define its own policy?
- [ ] Can moderators override decisions without destroying auditability?

### Required output

- Architecture summary of `retumbl`.
- Reuse matrix: `reuse`, `adapt`, `rewrite`, `reject`.
- Updated implementation/validation estimates for DF-001.
- Threat model covering brigading/Sybil/collusion/retaliation.
- ADR recommending whether reputation belongs in shared HAI infrastructure, OT only, TS only, or should remain separate.
- If a useful subset is genuinely one bounded slice, create a new `RR-xx` implementation slice; otherwise keep it deferred.

### Acceptance rule

No public claim such as "reputation-based moderation", "trusted users", or automated trust scoring may be made until the adapted system passes explicit abuse/adversarial validation.

---

## RR-15 — Federation/self-hosting feasibility and architecture decision

**Goal:** Move federation from an aspiration to a deliberate architectural decision without forcing premature implementation into the current launch.

This slice is an **architecture/research slice**, not a commitment to ship federation in the first public release.

### Product goals

Federation/self-hosting should serve these principles:

- a community should not disappear because the central HAI service disappears;
- users and communities should retain meaningful ownership/portability;
- independent servers should be able to participate without surrendering local governance;
- central OT/TS should remain easy for ordinary users;
- federation must not silently weaken privacy promises.

### Questions to answer

#### Identity and addressing

- [ ] What is the canonical identity: central HAI account, WebFinger-style actor, DID, instance-local account, or another model?
- [ ] Can the existing shared OT/TS login coexist with federated identity?
- [ ] How are users, communities, posts, comments, messages, media, and localities globally identified?
- [ ] What happens when an instance disappears or changes domain?
- [ ] Is account migration supported, and what moves with it?

#### Protocol strategy

- [ ] Evaluate ActivityPub as a primary candidate rather than inventing a protocol by default.
- [ ] Evaluate whether AT Protocol concepts are relevant, and document incompatibilities/operational burden.
- [ ] Evaluate whether a smaller HAI-specific protocol layered on existing standards is justified.
- [ ] Identify which OT features map naturally to standard federation objects and which do not.
- [ ] Identify whether TS locality/civic data should federate differently from generic OT social content.

#### Privacy

- [ ] Define what "private community" means when multiple servers are involved.
- [ ] Determine whether private/followers-only federation can meet the current privacy philosophy.
- [ ] Document the unavoidable limitation that remote servers receiving content can retain it.
- [ ] Ensure UI can explain those boundaries plainly before enabling cross-instance private sharing.

#### Communities and forums

- [ ] Decide whether communities are owned by one instance, mirrored, portable, or multi-home.
- [ ] Determine moderation authority for remote members/posts.
- [ ] Map durable forum threads/replies to the chosen federation model.
- [ ] Decide whether community-specific forums should be designed federation-aware before implementation.

#### Moderation and reputation

- [ ] Separate **local moderation decisions** from **portable/global reputation**.
- [ ] Do not permit one instance to silently impose a universal reputation score on another.
- [ ] Evaluate blocklists, trust relationships, moderation advisories, signed moderation events, and local overrides.
- [ ] Integrate RR-14 findings from `retumbl`.

#### Direct messaging

- [ ] Decide whether DMs federate in the first federation MVP.
- [ ] If yes, define delivery, encryption expectations, metadata exposure, blocking, retention, and failure behavior.
- [ ] If no, make the limitation explicit.

#### Media and storage

- [ ] Define remote-media fetch/caching strategy.
- [ ] Address malicious media, size limits, content type validation, deletion propagation, and storage abuse.
- [ ] Define canonical ownership and tombstones for deleted content.

#### Discovery

- [ ] Decide how Explore/trends handle remote content without contaminating the user's primary chronological feed.
- [ ] Define remote search/indexing rules.
- [ ] Ensure private/unlisted content is not indexed.

#### Operations and self-hosting

- [ ] Define the smallest supported self-hosted topology.
- [ ] Determine database/object-storage/mail/push requirements.
- [ ] Decide Docker/Compose packaging expectations.
- [ ] Define version compatibility and upgrade policy.
- [ ] Determine whether an HAI relay/directory is optional or required.
- [ ] Define instance health, abuse contact, and administrative bootstrap.

### Recommended phased federation model to evaluate

**Phase F0 — Export/portability groundwork**

- stable global IDs;
- exportable user/community content;
- clear visibility model;
- no cross-instance traffic yet.

**Phase F1 — Public read federation**

- public profiles/posts/communities can be followed/read remotely;
- no private content or DMs;
- local moderation remains authoritative locally.

**Phase F2 — Public write interaction**

- remote follow, reaction, reply, public community participation;
- signed/authenticated server-to-server requests;
- robust abuse controls.

**Phase F3 — Community federation**

- explicit remote membership;
- community moderation across instances;
- durable forum federation;
- stronger policy interoperability.

**Phase F4 — Private/follower-scoped federation**

- only if privacy semantics can be explained honestly and accepted operationally.

**Phase F5 — Optional federated messaging**

- only after a separate security/privacy decision.

This phased model should be validated or replaced by the ADR; it is not yet an implementation commitment.

### Required output

- Federation ADR.
- Protocol comparison and selection rationale.
- Domain model/ID impact assessment.
- Threat model.
- Privacy semantics document.
- Migration plan that does not require rewriting OT/TS all at once.
- A bounded "federation MVP" slice list.
- Updated DF-003 implementation and validation estimates.
- Decision on whether upcoming community-forum work should be federation-aware now.

### Acceptance criteria

RR-15 is accepted when the architecture is sufficiently concrete that a future agent can implement the first federation MVP without reopening foundational identity, privacy, addressing, and protocol questions.

Federation itself remains unadvertised as a released feature until its implementation slices pass acceptance.

---

## RR-13 — Final positioning, onboarding, and launch marketing package

**Goal:** Market the accepted products accurately and intentionally.

This slice intentionally comes after the release gate work has established what can be promised.

### OT deliverables

- final positioning architecture;
- revised landing page;
- new-user onboarding;
- community-steward acquisition messaging;
- "You are the social network" explanation;
- feed vs Explore explanation;
- privacy language;
- forum "slow discussion" positioning;
- honest early-stage invitation language.

### TS deliverables

- local-utility positioning;
- locality/community explanation;
- classifieds acquisition messaging;
- civic-information messaging;
- Daylight marketing only if RR-07 accepted;
- OT sibling-product contextual reference through HAI ecosystem language where useful.

### Shared

- HAI tag copy;
- consistent product-family language;
- screenshots/demos based only on accepted workflows;
- launch checklist and initial acquisition experiments.

---

# 7. Deferred Feature Register

This table is a running summary. Add detail below the table or in a dedicated `DF-xxx` document when analysis becomes substantial.

| ID     | Product               | Feature                                                                  | Value                                                                                               | Current state                                                                                                                                                   | Impl.                                    | Validation | Primary reason deferred                                                                                                                                                                                                                        | Marketing                                     | Revisit trigger                                                                                                                     |
| ------ | --------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| DF-001 | TS/OT                 | Reputation-driven moderation / automated restrictions                    | Helps communities scale trust and safety without central staff handling every decision              | A related untested prototype reportedly exists in private repo `cjrutherford/retumbl`; local checkout confirmed; full evaluation pending RR-14                  | M/L pending prototype review             | XL         | Existing prototype may reduce implementation cost, but validation still requires policy, abuse modeling, moderator UX, auditability, appeals/override behavior, adversarial E2E, and cross-instance implications if federation proceeds        | DEFER pending RR-14                           | Revisit immediately when `retumbl` is available to the audit; RR-14 will re-estimate and decide reuse/adaptation/rejection          |
| DF-002 | TS                    | Payments, donations, featured classifieds, paid business tiers/analytics | Potential sustainability and local-business tooling                                                 | Payment services/components exist but financial/entitlement behavior is unaccepted; RR-01 withdraws funding, tiers, featured placement, and analytics promotion | XL                                       | XL         | Payments introduce financial, refund, entitlement, webhook, tax/accounting, fraud, disclosure, and operational support requirements                                                                                                            | RETRACT/DEFER                                 | Revisit after core classifieds/community usage is validated and a monetization ADR defines exact business model                     |
| DF-003 | OT/TS shared platform | Self-hosting and federation                                              | Long-term resilience, portability, community ownership, and continuity beyond the central HAI sites | Architectural aspiration; promoted into active feasibility analysis                                                                                             | XL likely, but to be decomposed by RR-15 | XL         | Identity federation, canonical IDs, content addressing, moderation/trust boundaries, protocol/versioning, discovery, migration, security, cross-instance privacy, media delivery, abuse controls, and operations require explicit architecture | DEFER implementation; AUDIT NOW               | Revisit implementation after RR-15 produces an ADR, protocol recommendation, bounded MVP, and migration path                        |
| DF-004 | OT                    | Per-community forums                                                     | Gives each community a durable "slow ring" for governance/policy discussion                         | Product intent established; implementation status unverified/likely absent                                                                                      | M/L                                      | L          | Requires community-scoped forum authorization, navigation, moderation, notifications, search/privacy integration, and migration/UX decisions                                                                                                   | DEFER                                         | Revisit after RR-05 accepts the main forum and community permission model, then determine whether it can become a bounded follow-up |
| DF-005 | TS                    | Daylight expansion beyond initial accepted localities                    | Scales civic utility beyond initial launch footprint                                                | PR/integration in progress for initial locality set                                                                                                             | L                                        | XL         | Source diversity, ingestion adapters, OCR/source quality, locality rules, timezone/freshness validation, and ongoing source maintenance scale non-linearly                                                                                     | DEFER expansion; initial set handled in RR-07 | Revisit after RR-07 proves operational reliability and source-maintenance cost for the first supported localities                   |

## Deferred-feature analysis rules

- A deferred feature remains visible here even if its public claim is removed.
- When new evidence reduces its scope enough to fit one bounded slice, change its disposition from `DEFER` to `COMPLETE` and assign an `RR-xx` slice.
- If product strategy changes and the feature is no longer desirable, mark it `REJECTED` rather than deleting its history.
- Re-estimate implementation and validation independently. A feature with easy implementation but expensive trustworthy validation should remain deferred.
- Update the register whenever an audit finding would otherwise be summarized as "future work" without cost/risk analysis.

# 8. Suggested execution order

See [EXECUTION-PLAN.md](./EXECUTION-PLAN.md) for the working order, candidate owners, dependency gates, and required end-of-slice findings report. The sequence below remains the baseline.

1. **RR-00** — commit philosophy and audit plan.
2. **RR-01** — remove materially false public claims immediately.
3. **RR-03** — establish identity/session baseline.
4. **RR-04 + RR-05** — OT defining privacy/social/discussion behavior.
5. **RR-06** — TS currently released core.
6. **RR-02** — validate ecosystem switching/shared-login once auth behavior is known.
7. **RR-08** — safety/authorization boundaries.
8. **RR-09 + RR-10** — public usability and reliability.
9. **RR-11** — public operational/account lifecycle requirements.
10. **RR-14** — evaluate the `retumbl` reputation prototype as soon as private-repo access is available.
11. **RR-15** — federation/self-hosting architecture feasibility; may run in parallel because it informs future schema/identity/community decisions without blocking initial launch.
12. **RR-07** — Daylight when the PR/deployment dependency is ready; it may run in parallel where possible.
13. **RR-12** — full launch gate.
14. **RR-13** — final marketing/onboarding based on accepted reality.

RR-01 may make immediate copy removals before the rest of the audit; final copy belongs to RR-13.

---

# 9. Audit log

Use this section for concise status changes. Detailed evidence should live in slice-specific documents if a slice grows large.

| Date       | Item                    | Change                                                                                                                                                                                                              |
| ---------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-06 | RR-04 privacy audit     | Repaired anonymous read bypass and preserved reporter identity. Real multi-user gates expose private-community and realtime content; GAP FOUND with P0 release blockers. See findings/RR-04.md.                     |
| 2026-10-05 | RR-01 remediation       | Inventoried public claims, withdrew unsupported promotion, qualified early access, and fixed landing data loading. VERIFYING pending real authenticated review; see findings/RR-01.md.                              |
| 2026-10-05 | RR-02 verification      | Remediated copy, placement, keyboard focus, mobile tabs, contrast, and registry fallback. Operator confirmed shared credentials with separate sessions; live reverse navigation and real account tests remain open. |
| 2026-10-05 | RR-03 verification      | Hardened session restoration, profile ownership/cache cleanup, form errors and OAuth provider visibility. Real service revocation and browser contract regressions passed; lifecycle acceptance remains VERIFYING.  |
| 2026-10-05 | RR-00 accepted          | Foundation committed as 1a8f206a4; acceptance evidence committed as e16279992. Registry synchronized with the accepted slice report.                                                                                |
| 2026-10-05 | Execution mapping       | Added execution map and per-slice findings protocol; operator confirmed local `retumbl` at `9f2c1cc76cad41208cdbe8104682d2bc0c196491`. RR-14 access unblocked, evaluation PLANNED. No slice accepted.               |
| 2026-10-05 | Audit created           | Defined RR-00 through RR-13 and initial findings F-001 through F-007.                                                                                                                                               |
| 2026-10-05 | Daylight                | Recorded PR #275 as open/unmerged; RR-07 blocked from production acceptance.                                                                                                                                        |
| 2026-10-05 | OT messaging            | Recorded recursive `openChat` as P0 candidate pending reproduction.                                                                                                                                                 |
| 2026-10-05 | Marketing truth         | Recorded unsupported OT adoption claim and TS unreleased-feature claims as P0 truth gaps.                                                                                                                           |
| 2026-10-05 | Reputation + federation | Added RR-14 for `retumbl` prototype evaluation (blocked on connector access) and RR-15 for active federation/self-hosting feasibility. Updated DF-001/DF-003 accordingly.                                           |

---

# 10. Canonical repository layout

```text
docs/
  product/HAI-PUBLIC-GOOD-PHILOSOPHY.md
  release-readiness/
    MASTER-AUDIT.md
    EXECUTION-PLAN.md
    DEFERRED-FEATURES.md
    slices/RR-00.md … RR-15.md
    findings/RR-00.md
```

Detailed findings live in `findings/RR-xx.md`; keep their status synchronized with the registry and owning slice. The release-readiness package remains in its current stable location.

---

# 11. AGENTS.md integration

Product constraints, ADR exceptions, acceptance discipline, claim dispositions, and local prototype handling are installed in [AGENTS.md](../../AGENTS.md). [AGENTS-SNIPPET.md](./AGENTS-SNIPPET.md) records the same guidance.

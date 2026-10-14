# RR13-I03 — Launch evidence and experiments (internal draft)

**Status:** INTERNAL OWNER-REVIEW DRAFT — owner direction defers public launch experiments and a public status page for this release. Internal orientation and launch checklists are being prepared for review. Public assets and promotion remain subject to the evidence and approval gates below; this owner decision does not cancel them. Local evidence has different slice dispositions: RR-04 is ACCEPTED; RR-03 is VERIFYING; RR-05-I01 and RR-06-I01 are bounded ACCEPTED checkpoints while their parent slices remain VERIFYING. RR-12 remains NOT ACCEPTED. Daylight remains excluded until RR-07 acceptance; RR-11 operations remain open.

This document is a gated evidence checklist and experiment-planning template. It does not authorize screenshots, demos, publication, participant recruitment, or outreach.

## Candidate local evidence set for later review

The candidates below draw on RR12-I01's local regression matrix and separate owning-slice reports; each row names its provenance and limit. They could be reconsidered for an asset only after the owning workflow and RR-12 accept the reviewed release revision. None has been captured as a screenshot/demo, accepted for promotion, or checked against current production.

| Candidate asset subject | Local evidence to revisit | Current limit / claim boundary |
| --- | --- | --- |
| OT profile-to-feed orientation | RR12-I01 `user-journey.spec.ts`: registration, profile creation/edit, and protected feed shell on desktop and Pixel 5 | Does not establish the post-registration route beyond the shell, feed content, or production behavior. |
| OT audience/feed choice | RR-04 / RR-04-I03 ACCEPTED: follow/unfollow, Public/Following/Communities feeds, chronology, Explore separation, and the documented visibility/privacy rules | RR-04 accepts this scoped behavior. Do not broaden it to general discovery or caption it as a blanket privacy guarantee; production/revision approval remains separate. |
| OT community discussion | RR05-I01 bounded ACCEPTED: create/find/join/approve; forum create/reply/navigation; chat persistence/reconnect. Parent RR-05 remains VERIFYING. | Does not establish steward recruitment, invitation email delivery, governance, or moderation outcomes. |
| TS locality and listing conversation | RR06-I01 bounded ACCEPTED: map/seeded locality and two-user seller listing/image/contact-reply/sold-removed/post-leave management. Parent RR-06 remains VERIFYING. | Broader responsive/accessibility acceptance remains open; no payment, transaction completion, general locality coverage, or production acceptance is implied. |
| Cross-product account entry | RR-03 VERIFYING: local registration, manual sign-in, settings, account refresh/logout/session rejection, and separate OT/TS sign-ins | Do not imply SSO/shared sessions. Auto-verification does not prove email, magic-link, or password-reset delivery. RR-02 remains an independent gate. |

Evidence sources and their distinct dispositions are recorded in [RR12-I01](./RR-12-I01.md) and the respective slice reports. RR-04 is accepted for its documented scope; RR05-I01 and RR06-I01 are bounded accepted checkpoints with parent slices still VERIFYING. These dispositions do not approve marketing assets or substitute for exact production revision correlation and RR-01 claim reconciliation.

## Asset evidence checklist

Complete one row per proposed asset after its journey is accepted. Do not fill missing evidence with a prototype, source screenshot, development-stack run, or a different revision.

| Field | Required evidence | Current state |
| --- | --- | --- |
| Product and asset purpose | OT or TS; exact audience and intended statement | Not approved |
| Reviewed revision | Operator-correlated source/build/image/Argo/runtime identity tied to RR-12 accepted revision | Blocked: RR-12 not accepted; served bundle identity uncorrelated |
| Owning workflow | RR-01 claim ID, owning slice, accepted journey ID and result | Not established for launch assets |
| Capture environment | Exact reviewed deployment, date/time, viewport, browser/runtime, signed-in state, and sanitized fixture account | Not captured |
| Claim overlay | Every visible assertion mapped to RR-01 disposition and accepted evidence; no unaccepted account/private data | Not reviewed |
| Privacy and safety pass | Visible audience choices and records reviewed; no private content or personal data disclosed | Not run |
| Accessibility and viewport review | Keyboard/focus, screen-reader labeling, contrast, motion, desktop and mobile dimensions | Not run |
| Owner review | Product, behavior owner, release owner signoff and residual limits | Not obtained |
| Artifact handling | Internal path, restrictive permissions, retention owner, and approved public derivative | Not defined; keep any future private evidence access-restricted |

Do not screenshot, publish, or present a workflow before its owner accepts it. RR12-I01's 17 journeys on the isolated local development stack are bounded regression evidence, not production-like exact-revision proof or a marketing demo. T3 browser preview was unavailable in the headless environment; no visual capture is implied here. A future capture should use a synthetic account and deliberately non-sensitive fixture content, exclude private messages and personal identifiers, and retain only the approved final derivative plus the minimum review record needed to reproduce its revision and claim mapping. The owner must set the internal storage location, access list, and retention/deletion date before capture; this draft sets no operator retention promise.

## Release checklist outline

Before external promotion, record evidence for each item and link it to the exact revision:

- RR-01 claims reconciled against source and served OT/TS bundles; all `RETRACT`/`DEFER` claims absent from released copy.
- RR-12 accepted with deployment identity correlation and the production-like journey matrix.
- Every retained workflow statement points to an accepted owner journey and is worded within its `VERIFY`/`REWORD` disposition.
- RR-03/04/05/06/10 establish the identity, audience, feed/community/locality/listing/message paths being shown.
- RR-07 accepted before any Daylight or released civic-feed statement appears.
- RR-11-approved privacy, support, abuse reporting, contact, and account-lifecycle statements are present where required; no invented contact or legal process is used.
- RR-02/03 shared-account language is accurate; do not imply seamless cross-app sessions without evidence.
- Accepted asset checklist completed for every screenshot, demo, and derivative.
- Responsive/accessibility and ordinary failure states reviewed for the shown workflow.
- Experiment statement and measurement respect the HAI philosophy; there is no fake urgency, fake scale, manipulative notification, or engagement-maximizing objective.
- Release owner records browser-visible review when a browser runtime is available; if unavailable, mark it not run rather than infer a pass.
- Capture operator records the minimum artifact metadata needed to link each approved derivative to its exact reviewed revision, journey, claim dispositions, viewport, and owner signoff. Keep raw captures access-restricted during review, remove fixture identifiers, and delete rejected/temporary captures under an owner-approved handling period.

## Acquisition experiment template

Public launch experiments are deferred for this release by owner direction; none is authorized or scheduled. The questions below are retained only as internal future-review prompts, not current proposals. Any later-release proposal must document:

| Field | Required content |
| --- | --- |
| Question | One product-value question tied to an accepted workflow, not time-on-site or raw engagement. |
| Audience and recruitment | Exact audience, consent/recruitment owner, and RR-11-approved contact process. Do not use a public outreach channel until its operational prerequisite is accepted. |
| Variant | One clear statement or orientation choice; no false scarcity, fabricated adoption, or hidden audience expansion. |
| User control | Opt-in participation, what the participant sees, the minimum data collected, how to stop, and how responses are handled. Prefer task outcomes and aggregate themes; do not add intrusive tracking or silent audience expansion. |
| Success measure | Task completion, comprehension, ability to choose audience/next step, or opt-in aggregate feedback about a reported user outcome. Define stop conditions before recruitment: stop if participants infer unsupported privacy, guaranteed transaction completion, staffed moderation, or launch availability, or if a safety/privacy issue appears. |
| Limits | Small sample and environment limitations; no adoption or customer-count claim from test participation. |
| Review and record | Product/safety/privacy owner, release owner, dates, approved materials, and findings linked to the tested revision. |

Future-review prompts only: whether a new visitor can explain OT's people-centered model and optional communities after reading the landing; whether a visitor can describe TS locality in terms of their relationship to a place; and whether a visitor can distinguish the locally exercised TS listing/contact/reply tasks from payment or guaranteed transaction behavior. These are not selected or scheduled for this release. RR-11's limited contact-copy approval is not an outreach or research-operations approval; no participants, channels, dates, sample targets, or contact process are selected. Any later-release session would require separate owner direction and review of its recruitment and handling plan.

No screenshots/demos were captured, no experiment was run, and no outreach, public status page, or public publication occurred in preparing this draft. Owner direction defers public launch experiments and a public status page for this release; public asset/promotion approval remains governed by the separate evidence gates.

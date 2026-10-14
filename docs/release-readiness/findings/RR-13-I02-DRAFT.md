# RR13-I02 — New-user and steward orientation (internal draft)

**Status:** DRAFT PREPARED — implementation and public use held. This document is a source-linked planning guide; it is not an approved orientation flow or acquisition message. RR-12 remains NOT ACCEPTED, RR-03/04/05/06 evidence is incomplete, and RR-11's manual/public-operations approvals remain open.

## Current route map

| Product and entry | Source-backed route/action | What the source establishes | What remains unproven |
| --- | --- | --- | --- |
| Optimistic Tanuki landing | `/` in `apps/client-interface/src/app/app.routes.ts`; “Create an Account” and “Sign In” call `navigateToRegister()` / `navigateToLogin()` in `landing.component.ts`, routing to `/register` and `/login`. | Public landing, account-entry actions, early-access language, optional-community positioning, and a “How It Works” section exist. | Registration/profile completion, first post-registration destination, feed/Explore actions, accessibility/responsive checks, and end-to-end current release evidence. The route tree has no dedicated first-session orientation route. |
| Optimistic Tanuki authenticated entry | `/feed` has `AuthGuard` and `ProfileGuard` in `app.routes.ts`. | The route is guarded in source. | Guard recovery, first-session behavior, privacy/feed acceptance, and useful post-register guidance require RR-03/04 evidence. Do not assume registration always lands here. |
| Optimistic Tanuki Explore | `/explore` is a separate route with `AuthGuard` and `ProfileGuard` in `app.routes.ts`. | Route separation and guards exist in source. | RR-01 OT07 remains `REWORD`; discovery behavior remains under test. Do not teach Explore as an accepted workflow or imply that feed presence makes a post public. RR-04 audience-selection evidence governs post visibility. |
| Towne Square public exploration | Landing `Explore Map` calls `navigateToCities()` to `/cities`; city cards call `navigateToCity(slug)` to `/city/:slug` (`landing.component.ts`). Those routes exist in `apps/local-hub/src/app/app.routes.ts`. | Landing copy says people may browse localities without an account and labels membership, classifieds, and messaging early access. | Supported-locality data and browsing journey acceptance belong to RR-06. RR-07 applies only to a civic/Daylight branch, not locality browsing. Public runtime behavior still needs evidence. |
| Towne Square account entry | Landing “Join your community” calls `navigateToRegister()` to `/register`; sign-in routes to `/login`. | Account-entry route wiring exists in source. | MemberGuard behavior, profile setup, first-session destination, and membership/listing/messaging journeys remain subject to RR-03/RR-06/10. No dedicated first-session route was found. |
| Towne Square classifieds | Source routes include `/city/:slug/classifieds`, `/c/:communitySlug/classifieds`, and guarded `/new` forms. | Route declarations and membership guards exist in source. | Listing creation, buyer/seller contact, payment exclusion, errors, and accessibility need owning-slice acceptance. RR-01 TS03/TS20 remain `REWORD`/`VERIFY`. |

Source pointers: `apps/client-interface/src/app/components/landing.component.html:155-180,471-500`; `apps/client-interface/src/app/components/landing.component.ts:32-45`; `apps/client-interface/src/app/app.routes.ts:107-110,183-190`; `apps/local-hub/src/app/pages/landing/landing.component.html:1-34,148-157,232-264`; `apps/local-hub/src/app/pages/landing/landing.component.ts:80-100`; `apps/local-hub/src/app/app.routes.ts:8-100`; `docs/release-readiness/findings/RR-01-CLAIMS.md` OT05–OT07, TS01–TS03, TS19–TS22.

## Copy boundaries for later orientation work

The current internal direction may teach people that Optimistic Tanuki centers on people and interests, with communities optional, and that Towne Square centers on places that are part of a person's life. It may point to source-confirmed public exploration or account-entry routes only after those routes have current runtime evidence. Describe feed/Explore, privacy, communities, membership, classifieds, messaging, and uploads as early access or under test until their owning slices accept them. RR-01 OT07's Explore/discovery wording remains `REWORD`; do not present Explore as accepted or imply that feed presence makes a post public. RR-04 audience-selection evidence must establish whether a post is public before any orientation describes post visibility.

Do not promise that invitations are delivered. The reviewed invitation path is broken; email delivery is a shared configured capability, not a per-app configuration question. Do not promise trusted moderation, organizer permissions, moderation decisions, appeals, community governance, donation/sponsorship, payments, seller transaction completion, or Daylight. RR-11 has no approved support or abuse-contact operation to reproduce in public copy.

## Community-steward acquisition

**Held.** Do not publish or send an organizer/steward recruitment message yet. RR-08's safety acceptance does not establish the missing RR-11 operating policy/contact, current steward controls, responsibilities, appeal path, or invitation delivery. When those owners provide accepted evidence, the message must state only the verified steward task, who can perform it, how reports/escalations are handled, and what the product does not do. Until then, use no implied moderator/steward role in onboarding.

## Acceptance work still required

1. RR-03/04/05/06/10 owners identify the exact first-session actions and routes they accept.
2. RR-11 owners supply approved operations, contact, and responsibility language before public steward recruitment.
3. Implementers map the guide to reachable logged-out and new-account journeys; do not invent a route or placeholder screen for this document.
4. Validate relevant routes with the owning end-to-end journeys, keyboard/screen-reader review, and small/mobile viewports.
5. Reconcile the resulting copy to RR-01 and the exact RR-12 accepted revision, then update this draft's status with evidence.

No UI code, public copy, tests, outreach, or route placeholders were added for this draft.

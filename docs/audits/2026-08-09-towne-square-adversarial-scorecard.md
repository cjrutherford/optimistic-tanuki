# Towne Square Adversarial Scorecard

**Date:** 2026-08-09  
**Scope:** `local-hub`, `local-hub-e2e`, and the gateway/payment boundaries directly exposed by Towne Square  
**Review mode:** hostile end-to-end trace of public discovery, city/community classifieds, cookie authentication, offers/payments, responsive behavior, accessibility, and automated verification

## Score

| Dimension                        |   Weight |      Score | Evidence                                                                                                  |
| -------------------------------- | -------: | ---------: | --------------------------------------------------------------------------------------------------------- |
| Correctness and security         |      35% |       4/10 | One cross-user disclosure path and two broken primary navigation/session paths                            |
| User experience                  |      25% |       6/10 | Strong visual identity and public landing flow, but city classifieds and authenticated deep links fail    |
| Design-system fit                |      20% |       7/10 | Intentional Soft Touch personality and shared UI usage; local page CSS remains oversized and inconsistent |
| Accessibility and responsiveness |      10% |       3/10 | Serious contrast failures, unnamed map controls, and reproducible horizontal overflow                     |
| Verification confidence          |      10% |       2/10 | Unit/build gates pass while live E2E and important user outcomes fail                                     |
| **Weighted total**               | **100%** | **4.8/10** | Re-score after the four delivery slices below                                                             |

## Evidence collected

- `local-hub:lint`, `local-hub:test:ci`, and `local-hub:build:production` passed. The production build reports multiple component-style budget warnings, including Towne Square landing, city, cities, and community pages.
- Agent Browser loaded `http://127.0.0.1:8087/` without console or page errors at desktop width.
- At 375×667, the landing page measured 541px of document width. The support and business grids were the largest overflow offenders.
- The landing-page axe scan reported one serious rule violation covering 24 contrast failures. The carousel controls also expose an unsupported `aria-label` on a roleless `div`.
- A separate live adversarial trace found the cities page at 425px document width on a 375px viewport and 24 unnamed interactive Leaflet locality markers.
- The checked-in live-stack E2E target ran 34 tests; 28 failed. Authenticated tests fail while creating a session because login is not successful. The initial run also exposed that Nx attempts an unsupported Playwright browser installation unless `--skipInstall` is supplied on this host.

## Ordered findings

### [P0] Restrict classified offers and payment records to transaction participants

**Evidence:** `apps/gateway/src/controllers/payments/payments.controller.ts:335`, `apps/gateway/src/controllers/payments/payments.controller.ts:640`, `apps/payments/src/app/services/offer.service.ts:173`, `apps/payments/src/app/services/payment.service.ts:483`

The authenticated gateway endpoints forward only a classified or payment identifier. The payment service returns the records without checking that the caller is the buyer, seller, or classified owner. Any authenticated user with a public classified UUID can enumerate private negotiations and can follow an accepted payment ID to payment proof and dispute data.

**Impact:** cross-user disclosure of negotiation and payment information.

### [P1] Normalize city and community route parameters before loading classifieds

**Evidence:** `apps/local-hub/src/app/app.routes.ts:29`, `apps/local-hub/src/app/pages/classifieds/classifieds.component.ts:73`, `apps/local-hub/src/app/pages/classified-detail/classified-detail.component.ts:82`, `apps/local-hub/src/app/guards/member.guard.ts:34`

City routes define `:slug`, while list, detail, and member guard code read only `communitySlug`. City classifieds therefore request `/api/communities/slug/`, enter an error state, and redirect back through community URLs even when navigation began under `/city/...`.

**Impact:** city classifieds cannot reliably load, deep-link, or create listings.

### [P1] Align SSR route protection with the HttpOnly cookie-session contract

**Evidence:** `apps/local-hub/src/server.ts:69`, `apps/gateway/src/controllers/authentication/authentication.controller.ts:689`

The gateway scopes `ot_session` to `/api`, while Local Hub's Express gate checks a legacy `ot-local-hub-authToken` cookie on page requests. A valid cookie session is neither sent to nor recognized on `/account`, `/messages`, or `/seller-dashboard`.

**Impact:** authenticated reloads and bookmarked deep links redirect to login.

### [P2] Give Leaflet locality markers accessible names

**Evidence:** `apps/local-hub/src/app/components/map/map.component.ts:300`

Leaflet makes locality markers focusable buttons, but the generated marker elements do not receive an accessible name. Tooltip text is not sufficient for the control's accessible name.

**Impact:** keyboard and screen-reader users encounter anonymous map actions.

### [P2] Remove narrow-viewport overflow from landing and city discovery

**Evidence:** `apps/local-hub/src/app/pages/landing/landing.component.scss:438`, `apps/local-hub/src/app/pages/cities/cities.component.scss:622`

The landing support/business grids do not collapse at their existing breakpoints, producing a 541px page at 375px. The cities map rail similarly resolves wider than its viewport and produces a 425px page.

**Impact:** primary content and controls are clipped or require horizontal scrolling on supported phone widths.

### [P2] Raise local text and control contrast to WCAG AA

**Evidence:** `apps/local-hub/src/app/pages/landing/landing.component.scss`, `apps/local-hub/src/app/pages/cities/cities.component.scss:350`, `apps/local-hub/src/app/components/map/map.component.scss:93`

Muted foregrounds render as low as 2.22:1 against card surfaces. The landing scan identified 24 serious failures, including feature descriptions, donation metadata, and controls; city filters and the map legend use the same weak semantic combination.

**Impact:** important explanatory and control text is difficult to read and fails WCAG AA.

## Residual risks and open questions

- The failed authenticated E2E setup may include stale local stack state, but it still demonstrates that the suite is not currently a reliable release gate.
- Messaging, offers, donations, seller dashboard actions, and community management lack browser-level outcome tests.
- `expectPageLoads` proves only a sub-400 response and visible body, so redirects and rendered error states can pass.
- Authorization must be enforced in the owning payment service, not only in the gateway, because internal callers may bypass HTTP controllers.

## Prioritized delivery slices

1. **P0 payment authorization:** propagate caller identity and enforce buyer/seller ownership in the payment service, with negative tests.
2. **P1 routing and session correctness:** normalize route context and make server-side protection compatible with the HttpOnly session model.
3. **P2 responsive and accessible discovery:** repair both overflow surfaces, marker names, semantic contrast, and carousel semantics.
4. **Verification hardening:** replace permissive smoke assertions with observable browser outcomes and restore a stable authenticated E2E fixture.

## Post-remediation re-score

| Dimension                        |   Weight |      Score | Final evidence                                                                                                                                                                      |
| -------------------------------- | -------: | ---------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Correctness and security         |      35% |     9.5/10 | Canonical classified ownership now protects offer/payment reads and mutations, legacy seller data is repaired on bounded collection reads, and release credits the canonical seller |
| User experience                  |      25% |       9/10 | City/community routes preserve their family, cookie-backed protected reloads succeed, and classified creation returns to a stable list URL                                          |
| Design-system fit                |      20% |     8.5/10 | Existing shared components and semantic theme tokens were retained; remaining production warnings are pre-existing shared-style debt                                                |
| Accessibility and responsiveness |      10% |       9/10 | 375px pages have no horizontal overflow; all 24 rendered map actions are keyboard-focusable buttons with accessible names                                                           |
| Verification confidence          |      10% |     9.5/10 | Full live browser suite: 43 discovered, 41 passed, 2 seed-dependent map cases skipped, 0 failed; affected tests, lints, and production builds pass                                  |
| **Weighted total**               | **100%** | **9.1/10** | No remaining actionable P0/P1/P2 was found in the final reviewed slices                                                                                                             |

### Final verification evidence

- Full live Playwright run against the rebuilt Docker stack: 41 passed, 2 skipped, 0 failed.
- Agent Browser: `/communities` renders 246 results without an error state; `/cities` at 375×667 reports `clientWidth=375`, `scrollWidth=375`, and 24 named, keyboard-focusable marker buttons.
- Fresh Nx tests passed for `gateway`, `payments`, `classifieds`, and `local-hub`; lint passed for those projects plus `local-hub-e2e`.
- Production builds passed for `gateway`, `payments`, `classifieds`, and `local-hub`. The earlier Local Hub failure was traced to the restricted runner denying Nx's Unix IPC socket (`EPERM`), not to Angular compilation; no heap or budget configuration was changed.

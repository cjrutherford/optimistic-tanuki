# E2E Stabilization: Plan and Progress

## Objective

Make the CI-equivalent E2E environment isolated, dependency-correct, and
reliable; then resolve the runtime failures found by the client UI suite.

## Scope and Working Constraints

- The local runner must represent the GitHub Actions E2E environment, while
  keeping each run isolated from a developer's existing Docker stack.
- E2E service composition comes from the registry/manifest rather than a
  manually guessed list of containers.
- Exact-source verification uses `E2E_IMAGE_SOURCE=build`; this avoids stale
  local images and was the basis for the browser evidence below.
- The workspace is intentionally dirty and contains broad CI stabilization
  changes. This document records the slice completed during the current pass;
  it does not imply ownership of every changed file in the worktree.

## Completed

- Added manifest-driven service selection and an isolated Compose runner with
  database setup, permission seeding, readiness checks, and teardown.
- Added exact-source Docker rebuild support so browser tests exercise current
  application code rather than stale images.
- Repaired client E2E lifecycle handling and validated the environment
  manifest, readiness, and Compose contract checks.
- Fixed responsive button hit targets in the shared auth UI.
- Fixed content-box overflow in the community shell, Find Communities route,
  and the client application content shell.
- Added diagnostics to the profile/communities E2E assertion so an overflow
  failure names the elements that exceed the viewport.

### CI and environment work completed earlier in this effort

- Established the E2E environment manifest and service planner, with tests for
  service closure, readiness, and UI E2E CI contracts.
- Made database bootstrap (`db-setup`) and permission seeding explicit
  prerequisites for isolated runs.
- Updated the local CI runner to build manifest-bounded services in batches,
  start dependencies in order, wait for readiness, preserve diagnostics on
  failure, and tear down only its own Compose project.
- Updated multiple E2E target configurations to use the standardized CI
  lifecycle and Chrome-compatible Playwright settings.
- Removed Dockerfile patterns that mutate package-manager state at runtime and
  exercised fresh-image startup paths.

### Runtime and test-flow repairs completed earlier

- Made the chat gateway fail soft when optional Telos functionality is absent
  and improved chat collector persistence ordering.
- Repaired permission seed validation and invalid role/permission
  associations, with focused seed tests.
- Corrected client server-rendering route behavior and stabilized shared E2E
  registration, login, and profile-edit fixtures.

### Responsive appearance and communities slice completed now

- Made shared auth email actions meet 44px touch-target expectations.
- Corrected content-box overflow at the client content shell, community shell,
  and Find Communities route boundary.
- Replaced the always-visible theme editor with a compact **Appearance**
  trigger and anchored CDK popout in `theme-ui`.
- Added dialog semantics, focus trapping, Escape and close-button dismissal,
  unique control IDs, and accessible names for theme and accent controls.
- Corrected the shared `navigation-ui` app bar's content-box sizing and
  mobile layout; it now removes the title at narrow widths rather than forcing
  controls outside the viewport.
- Made community navigation tabs share the available small-screen width and
  wrap their labels instead of exceeding the viewport.

## Current Evidence

The focused CI-equivalent profile/communities test originally failed at a 390px
viewport because the toolbar theme control extended to 456px. The old
always-visible theme editor contained a mode switch, color picker, and
personality selector, which was unsuitable for the toolbar on mobile.

The isolated Compose setup itself builds, starts, runs Playwright, and tears
down cleanly. The failure is a client layout failure, not environment setup.

### Why the appearance change was necessary

The original shared theme control permanently displayed a light/dark switch,
accent color input, and personality chooser in every app bar. At 390px it
caused `lib-theme-toggle` to reach 456px. Adding `box-sizing` to only that
card reduced, but did not eliminate, the symptom because the shared app bar
also combined `width: 100%` with padding under content-box sizing. The new
design removes the persistent width pressure and keeps the settings available
on demand.

### Adversarial-review results

The review found four material issues in the initial popout: keyboard focus
could escape a modal backdrop, form controls lacked names, overlay IDs were
not instance-safe, and tests exercised only methods rather than public
interactions. All four were addressed before final verification. Residual
evidence gap: the focused E2E proves responsive rendering but does not yet
exercise opening the appearance popout in a real browser; unit coverage now
does exercise trigger, close, and Escape state behavior.

## Active Fix

Replaced the persistent toolbar editor with a compact, accessible "Appearance"
button that opens an anchored CDK popout. The popout retains the existing
theme, accent-color, and personality actions while taking no horizontal
toolbar space when closed. The popout must remain bounded by the viewport and
close on backdrop, Escape, and selection flows.

The shared app bar was also corrected to use border-box sizing. The focused
browser rerun confirmed that the theme control was no longer an overflowing
element, then identified a separate mobile overflow in the community navigation
tab row (right edge 405px at a 390px viewport). The tab row now uses responsive
flex sizing and wrapping. The final isolated, exact-source Playwright rerun
passed the profile/communities flow across its mobile, tablet, and desktop
viewports.

## Remaining Verification

1. Add and run the OAuth/email-action handling contract smoke suite described
   below; it must validate our gateway and client handling, not an external
   provider.
2. Perform the planned adversarial review before declaring the stabilization
   work done.

## Recommended Next Execution Order

### 1. Repair community-permission E2E determinism

**Likely area:** `apps/client-interface-e2e/src/community-permissions.spec.ts`
and the authentication throttle configuration consumed by the isolated Compose
environment.

The tests register several users from one source address, then time out after
the authentication rate limiter returns throttling responses. First prove
whether the suite should use an E2E-only throttle configuration or lower its
registration count through shared fixtures. Do not weaken production limits.
Replace log-only permission observations with assertions on the visible or API
authorization result.

**Completed (2026-08-01):** The gateway
controller already supports `THROTTLE_LOGIN_LIMIT` with a strict production
default of 10/minute, but the isolated Compose gateway did not set it. Added
the test-only Compose value of 100 and a UI-E2E contract test that prevents the
override from being lost. Replaced the optional/log-only scenario with a
self-contained authorization test that creates three accounts and a public
community, decodes the backend-issued profile ID from each token, and asserts
that an outsider cannot post or react while an approved member can post. The
client interceptor now maps `/api/social` requests to the `social` permission
scope, matching the existing policy mapping. The exact-source isolated target
passes with one worker and no retries.

**Additional finding (2026-08-01):** The reaction pathway did not enforce
membership for a post that belongs to a community. The social message handler
now resolves the post and rejects a non-member before creating or toggling a
reaction. The social unit suite passes after this service-level correction.

### 2. Reproduce and repair the tablet chat failure

**Likely area:** `apps/client-interface-e2e/src/chat.spec.ts` plus shared
authentication/session fixtures.

Run only the tablet Playwright project and capture the first failing action.
Determine whether it is a real responsive chat defect, a session-restore race,
or a test that bypasses the final authentication state. Fix the owning shared
layer rather than adding per-project waits.

**Completed (2026-08-01):** The exact-source isolated tablet target now passes
the chat workflow with one worker and zero retries. No additional chat change
was required after the preceding session/bootstrap and E2E-environment fixes.
The complete exact-source isolated `client-interface-e2e` target subsequently
passed all 130 tests with one worker and zero retries; the stack was removed
cleanly after completion.

### 3. Add OAuth and email-action handling smoke coverage (high priority)

**Scope:** Validate platform-owned handling only. Do not simulate or alter
provider-side OAuth behavior. The suite must cover the data and session handoff
from the provider callback relay through the gateway and the receiving SPA.

**Contract cases:**

1. OAuth callback redemption accepts both a token result and cookie-session
   result; in cookie mode the callback informs its opener of successful
   authentication without exposing a token and the client restores session
   state before navigating.
2. OAuth state and one-time callback grants reject missing, expired, replayed,
   mismatched-provider, and invalid-return-target inputs before account/session
   mutation.
3. Magic-link confirmation creates/restores the app session and safely follows
   only same-origin relative return paths. Email verification marks the address
   verified but never silently creates a session.
4. Verification and magic-link failures retain a retryable token/action path;
   a transient gateway failure cannot strand a valid link after the URL is
   scrubbed.
5. Every session-producing route carries a backend-issued `profileId` through
   its resulting session/token, including app-scope aliases.

**Owning tests:** extend focused unit specs in
`apps/gateway/src/controllers/oauth/oauth.controller.spec.ts`,
`apps/gateway/src/controllers/authentication/authentication.controller.spec.ts`,
`libs/auth-ui/src/lib/oauth-callback/oauth-callback.component.spec.ts`, and
`libs/auth-ui/src/lib/email-action/email-action.component.spec.ts`. Add one
isolated gateway/client smoke flow only after these contract tests are green;
use an internal callback grant fixture rather than a live provider.

**Baseline validation (2026-08-01):** Existing `auth-ui`, `gateway`, and
`authentication` unit targets pass. They validate individual token-mode
operations but do not yet provide the cross-layer handler contract above; this
is a coverage gap, not evidence that the full OAuth/email UX is safe.

**Implemented validation (2026-08-01):** Added shared-handler contract tests
for cookie-session callback messages and retryable verification actions. The
callback page now relays either a token or an explicit `{ session: true }`
result, while the popup service preserves that result for initiating clients.
Email-action failures retain the in-memory token and expose an explicit retry
action after the URL has been scrubbed. `auth-ui:lint`, `auth-ui:test`,
`gateway:test`, and `authentication:test` pass.

**Isolated OAuth smoke validation (2026-08-01):** Added a compose-only fake
OAuth provider and `oauth-cookie-session.spec.ts`. The exact-source,
manifest-bounded client-interface run proves that a popup is created and stays
open through the provider redirect, the server callback sets an HttpOnly
`ot_session` cookie, the callback posts only `{ session: true }`, and the
opener restores its identity from `/api/authentication/session` without a
localStorage token. Cookie mode is explicitly opted into only by
client-interface; unmigrated clients retain token redemption compatibility.

### 4. Rerun the client suite in CI-equivalent isolation

Run the checked-in `client-interface-e2e:e2e:ci` target through
`scripts/run-ci-e2e-locally.sh` with `E2E_IMAGE_SOURCE=build`, one worker, and
zero retries. Preserve test artifacts on a failure and rerun only the failing
file after a root-cause fix.

### 5. Broaden only after the client suite is green

Run the equivalent Forge of Will and business-site targets against their
manifest-defined environments. Then review the CI workflow to ensure every
job builds/starts only the services registered for its E2E target.

### 6. Close with an adversarial review

Trace each changed claim from workflow configuration to a fresh container and
to the browser. Confirm cleanup never tears down a shared developer stack,
the `db-setup` and permission-seed prerequisites execute before consumers,
and no test claims success while only a mocked boundary was exercised.

## Verification Ledger

| Check                                                              | Result | Notes                                                                                                                                     |
| ------------------------------------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `theme-ui:test`                                                    | Pass   | Includes appearance trigger, close, and Escape behavior.                                                                                  |
| `theme-ui:lint`                                                    | Pass   | After the popout and accessibility changes.                                                                                               |
| `community-ui:test` and `community-ui:lint`                        | Pass   | After responsive tab navigation fix.                                                                                                      |
| `navigation-ui:test` and `navigation-ui:lint`                      | Pass   | After shared app-bar sizing fix.                                                                                                          |
| Isolated exact-source `client-interface-e2e` profile/communities   | Pass   | One Chromium desktop project test exercises mobile, tablet, and desktop viewports.                                                        |
| `git diff --check`                                                 | Pass   | At the end of the responsive slice.                                                                                                       |
| Isolated exact-source `client-interface-e2e` community permissions | Pass   | One deterministic test verifies profile-bearing tokens, correct social scope, approved-member posting, and outsider post/reaction denial. |
| Isolated exact-source `client-interface-e2e` OAuth cookie session  | Pass   | Popup, fake-provider redirect, HttpOnly cookie, opener restore, and cleanup were all exercised with one worker and zero retries.          |

## Handoff Summary

The isolated E2E infrastructure is materially more trustworthy than at the
start of the work: it has deterministic prerequisites, bounded service
closures, fresh-source build capability, readiness checks, and project-scoped
cleanup. The responsive profile/communities and appearance-control slice is
complete and has focused runtime evidence. The project is **not** ready to
claim full client E2E success until the tablet chat failure is repaired and the
full isolated client suite has passed.

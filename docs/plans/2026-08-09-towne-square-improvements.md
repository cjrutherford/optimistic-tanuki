# Towne Square Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Raise Towne Square from 4.8/10 by closing the payment disclosure, restoring city classifieds and cookie-authenticated deep links, repairing mobile/accessibility defects, and making E2E prove the public behavior.

**Architecture:** Authorization belongs in the payments service and receives caller identity through the gateway. Local Hub route context will be normalized once and reused by guards/pages, while SSR protection will rely on a session contract that is actually available to page requests. UX repairs stay in the owning Local Hub components and semantic theme tokens, with Playwright covering real browser outcomes.

**Tech Stack:** Nx, Angular 20, NestJS, Socket/HTTP gateway composition, TypeORM, Jest, Playwright, Vercel Agent Browser, axe.

**Workspace constraint:** Work in the current checkout. Do not create a worktree for this repository.

---

## Gate 0: Preserve the baseline

### Task 1: Record focused baseline evidence

**Files:**

- Read: `docs/audits/2026-08-09-towne-square-adversarial-scorecard.md`
- Read: `apps/local-hub-e2e/playwright.config.ts`

**Step 1:** Run the current focused checks.

```bash
NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx run local-hub:lint
CI=true NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx run local-hub:test:ci --runInBand
CI=true NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx run local-hub:build:production
```

Expected: all three pass, with existing build warnings recorded rather than treated as new failures.

**Step 2:** Confirm the live stack and list E2E without installing managed browsers.

```bash
CI=true SKIP_SERVER=true BASE_URL=http://127.0.0.1:8087 GATEWAY_URL=http://127.0.0.1:3000 NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx run local-hub-e2e:e2e --skipInstall --list
```

Expected: 34 tests are listed.

## Slice 1: Close the P0 payment disclosure

### Task 2: Write failing gateway identity-forwarding tests

**Files:**

- Modify: `apps/gateway/src/controllers/payments/payments.controller.spec.ts`
- Modify: `apps/gateway/src/controllers/payments/payments.controller.ts`

**Step 1:** Add tests asserting `getOffersForClassified(user, classifiedId)` and `getPayment(user, paymentId)` include `userId: user.userId` in the microservice payload.

**Step 2:** Run the focused test and confirm it fails before implementation.

```bash
NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx run gateway:test --runInBand
```

**Step 3:** Add `@User() user: UserDetails` to both controller actions and forward `userId` with the resource ID.

**Step 4:** Rerun the gateway test and expect PASS.

### Task 3: Enforce participant authorization in the owning service

**Files:**

- Modify: `apps/payments/src/app/app.controller.ts`
- Modify: `apps/payments/src/app/services/offer.service.ts`
- Modify: `apps/payments/src/app/services/payment.service.ts`
- Modify: `apps/payments/src/app/services/payment.service.spec.ts`
- Create or modify: `apps/payments/src/app/services/offer.service.spec.ts`

**Step 1:** Add negative tests for an unrelated caller and positive tests for buyer/seller access.

```typescript
await expect(service.getPayment('payment-1', 'intruder')).rejects.toThrow();
await expect(service.getPayment('payment-1', 'buyer-1')).resolves.toMatchObject({ id: 'payment-1' });
```

Apply the same matrix to offers for a classified. Resolve the classified owner through the stored seller identity; never trust a caller-supplied seller ID.

**Step 2:** Run payments tests and confirm the negative cases fail.

```bash
NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx run payments:test --runInBand
```

**Step 3:** Change service signatures to accept `userId`, reject callers who are neither buyer nor seller, and pass identity from the command handlers.

**Step 4:** Rerun payments and gateway tests. Expect PASS.

**Gate:** A Luna subagent may implement the mechanical gateway forwarding after the tests are specified. A Terra subagent should own the service authorization because it crosses controller, persistence, and disclosure boundaries. The orchestrator reviews both diffs before proceeding.

## Slice 2: Restore route and session correctness

### Task 4: Normalize locality route context

**Files:**

- Create: `apps/local-hub/src/app/utils/locality-route-context.ts`
- Create: `apps/local-hub/src/app/utils/locality-route-context.spec.ts`
- Modify: `apps/local-hub/src/app/pages/classifieds/classifieds.component.ts`
- Modify: `apps/local-hub/src/app/pages/classified-detail/classified-detail.component.ts`
- Modify: `apps/local-hub/src/app/guards/member.guard.ts`

**Step 1:** Test a helper that returns both the slug and route family.

```typescript
export type LocalityRouteContext = { slug: string; baseSegments: string[] };

export function localityRouteContext(params: ParamMap): LocalityRouteContext {
  const citySlug = params.get('slug');
  const communitySlug = params.get('communitySlug');
  return citySlug ? { slug: citySlug, baseSegments: ['/city', citySlug] } : { slug: communitySlug ?? '', baseSegments: ['/c', communitySlug ?? ''] };
}
```

**Step 2:** Run the focused Local Hub tests and confirm existing code cannot satisfy the city case.

**Step 3:** Use the helper in list, detail, and member guard code. Preserve `baseSegments` for back, detail, new-listing, and failed-membership navigation.

**Step 4:** Add component tests for both `/city/:slug` and `/c/:communitySlug` contexts and rerun `local-hub:test`.

### Task 5: Make SSR route protection compatible with cookie sessions

**Files:**

- Modify: `apps/gateway/src/controllers/authentication/authentication.controller.ts`
- Modify: `apps/gateway/src/controllers/authentication/authentication.controller.spec.ts`
- Modify: `apps/local-hub/src/server.ts`
- Add or modify: `apps/local-hub/src/server.spec.ts`

**Step 1:** Add failing tests proving a login session can reload `/account` and that unauthenticated requests still redirect.

**Step 2:** Broaden the `ot_session` cookie path to `/` while retaining `HttpOnly`, `Secure` in production, and appropriate `SameSite`. Update clear-cookie options identically.

**Step 3:** Change Local Hub's server gate to recognize `ot_session`; do not decode it as proof of authorization. If route gating must make an authorization decision, validate through the gateway/session endpoint and fail closed on invalid sessions.

**Step 4:** Verify login → `/account` → reload and login → `/messages` → reload in two isolated browser sessions where useful.

**Gate:** Terra owns the session-contract decision. The orchestrator must reject any implementation that merely trusts an unsigned/unchecked decoded JWT payload.

## Slice 3: Repair responsive and accessible discovery

### Task 6: Remove landing and cities overflow

**Files:**

- Modify: `apps/local-hub/src/app/pages/landing/landing.component.scss`
- Modify: `apps/local-hub/src/app/pages/cities/cities.component.scss`
- Modify: `apps/local-hub/src/app/pages/landing/landing.component.spec.ts`
- Modify: `apps/local-hub-e2e/src/public-pages.spec.ts`

**Step 1:** Add a 375×667 Playwright assertion for both `/` and `/cities`.

```typescript
await page.setViewportSize({ width: 375, height: 667 });
await page.goto(path);
expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
```

**Step 2:** Confirm it fails on the current 541px and 425px layouts.

**Step 3:** At the owning breakpoints, collapse `.support-grid` and `.business-grid`, add `min-width: 0` to grid children, constrain map/grid tracks with `minmax(0, 1fr)`, and ensure cards/buttons use `max-width: 100%`.

**Step 4:** Rerun the narrow E2E slice and inspect desktop parity with Agent Browser.

### Task 7: Label map controls and fix semantic contrast

**Files:**

- Modify: `apps/local-hub/src/app/components/map/map.component.ts`
- Modify: `apps/local-hub/src/app/components/map/map.component.spec.ts`
- Modify: `apps/local-hub/src/app/components/map/map.component.scss`
- Modify: `apps/local-hub/src/app/pages/landing/landing.component.html`
- Modify: `apps/local-hub/src/app/pages/landing/landing.component.scss`
- Modify: `apps/local-hub/src/app/pages/cities/cities.component.scss`

**Step 1:** Add a marker test that inspects the Leaflet marker element and expects an accessible name equal to the city name.

**Step 2:** Set marker `title`/`alt` or update the generated element after creation with `aria-label`, preserving keyboard activation.

**Step 3:** Replace roleless carousel labelling with a semantic group (`role="group"` plus label, or a labelled fieldset where appropriate).

**Step 4:** Raise muted foreground semantic tokens/local usages until axe reports no serious contrast violation on `/` and `/cities` in light and dark modes.

**Step 5:** Run Agent Browser snapshots, overflow checks, and `a11y --json` at desktop and 375px.

**Gate:** Luna may handle CSS/test mechanics. Terra reviews token effects across shared consumers before acceptance.

## Slice 4: Make E2E prove the product promise

### Task 8: Repair authenticated session setup

**Files:**

- Modify: `apps/local-hub-e2e/src/helpers/local-hub-api.ts`
- Modify: `apps/local-hub-e2e/src/fixtures/auth.fixture.ts`
- Modify: `apps/local-hub-e2e/src/authenticated-flows.spec.ts`

**Step 1:** Capture and assert registration and login response status/body separately so fixture failures explain the actual backend rejection.

**Step 2:** Establish the real HttpOnly cookie session through the browser/API response contract. Remove the legacy local-storage-only `addAuthToken` path from authenticated page tests.

**Step 3:** Replace `expectPageLoads` for protected pages with route-specific visible outcomes and reload assertions.

### Task 9: Add complete city classifieds and authorization workflows

**Files:**

- Modify: `apps/local-hub-e2e/src/public-pages.spec.ts`
- Modify: `apps/local-hub-e2e/src/authenticated-flows.spec.ts`
- Create: `apps/local-hub-e2e/src/payment-authorization.spec.ts`

**Step 1:** Add city and community list/detail assertions that reject error-state text and preserve route family.

**Step 2:** Add membership → create classified → reload → detail browser coverage. Do not allow `[400, 403, 500]` as success.

**Step 3:** Add buyer, seller, and unrelated-user sessions. Assert the unrelated user receives 403/404 for offers and payment details while buyer/seller access succeeds.

## Final gate: Re-score and run CI-equivalent checks

### Task 10: Verify narrow-to-wide and update the scorecard

**Files:**

- Modify: `docs/audits/2026-08-09-towne-square-adversarial-scorecard.md`

**Step 1:** Run focused checks after every slice, then the full affected gate.

```bash
NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx run-many -t lint test build -p local-hub local-hub-e2e gateway payments --parallel=3
CI=true SKIP_SERVER=true BASE_URL=http://127.0.0.1:8087 GATEWAY_URL=http://127.0.0.1:3000 NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx run local-hub-e2e:e2e --skipInstall
pnpm run format:check
git diff --check
```

**Step 2:** Use Agent Browser at 1440×900 and 375×667 for `/`, `/cities`, one city classifieds route, `/account` reload, and `/messages` reload. Capture snapshot, console, errors, overflow, and axe output.

**Step 3:** Re-score every dimension from fresh evidence. Do not retain the 4.8 score if results contradict it.

**Step 4:** Run an adversarial review of the final diff before commit/PR handoff.

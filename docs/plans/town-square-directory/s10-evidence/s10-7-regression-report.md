# S10 live-stack E2E regression report

Root: /home/cjrutherford/.t3/worktrees/optimistic-tanuki/t3-4ddd3d15. No source edited, nothing committed. Logs: scratchpad s10/\*.log (lh1, lh2, fow, bs, ci). Env for all runs: PLAYWRIGHT_HEADLESS=true, Playwright `chrome` channel (no flakiness seen), `pnpm exec playwright test --config=apps/<app>-e2e/playwright.config.ts --reporter=list`.

## 1. Local Hub (http://127.0.0.1:8087, gateway http://127.0.0.1:3000)

Env: E2E_DOCKER=true (skips webServer) BASE_URL GATEWAY_URL.

Run A: src/public-pages.spec.ts src/map.spec.ts src/unauthenticated-protection.spec.ts src/api-smoke.spec.ts

- exit 1; 24 passed, 1 failed, 2 skipped.
- FAIL map.spec.ts:135 "Map rendering > shows a single focus marker on city detail pages": `expect(locator('.map-marker--focus')).toHaveCount(1)` received 0 after 10s.
- Skipped: map.spec.ts:147 (community detail, no seeded renderable community) and :101 (user/locality markers).
- Likely cause (not proven): seeded data. The first `localityType==='city'` community has no coordinates, so `getFocusCoordinates()` in apps/local-hub/src/app/components/map/map.component.ts returns nothing and no focus marker renders. Last commit touching that component is afe040f91 (S6 directory UI); not otherwise investigated. Not a gateway or common-ui implication on current evidence. Treat as unresolved: needs a look at the seeded city's coordinates.
- Console errors asserted: no (no console assertions in these specs).

Run B: S6_EVIDENCE=true src/s6-directory-evidence.spec.ts (flag name confirmed in spec: `S6_EVIDENCE === 'true'`)

- exit 0; 21 passed, 0 failed, 0 skipped (desktop + mobile: populated town, zero results, never scanned, blocked, acquiring/empty/unconfigured/partial/policy-withdrawn stubbed states, 503 infra, report/receipt).
- Console errors asserted: no. Not run (per instruction): s7/s8/s8b/s9 evidence specs.

## 2. Shared-UI apps

Compose services (docker-compose.yaml, no profiles): ot-client-interface (ot_client_interface, 8080), forgeofwill-client-interface (fow_client_interface, 8081), business-site (ot_business_site, 8094). Ports were free beforehand.

- Built with `BUILDX_CONFIG=/tmp/ot-buildx BUILDX_BUILDER=ot-hostnet docker compose -p optimistic-tanuki --profile directory --env-file .env.directory.local build <svc>`: all three exit 0.
- Started with `$DC up -d --no-deps ot-client-interface forgeofwill-client-interface business-site`. All three up; 8080/8081/8094 answer HTTP 200.
- Containers I started and left running: ot_client_interface, fow_client_interface, ot_business_site.
- All e2e runs used SKIP_SETUP=true (documented in each global-setup/teardown: skips docker compose start and stop, so no shared service touched) and a BASE_URL per app.

### forgeofwill-e2e (BASE_URL=http://127.0.0.1:8081)

- exit 1; 29 passed, 5 failed, 0 skipped.
- forum-access.spec.ts:4 anonymous read seeded topics: "forum topics request failed: 503 http://127.0.0.1:8081/api/forum/topics".
- forum-access.spec.ts:49 seeded topic thread list: getByText('Project Execution') not visible.
- oauth-cookie-session.spec.ts:5: timeout waiting for "popup" event.
- project-crud.spec.ts:5: expected /login$/, landed on /register.
- user-journey.spec.ts:19: expected /login, landed on /register.
- Console errors asserted: user-journey.spec.ts and personality-modal-sidebar.spec.ts mention console; not examined further.

### business-site-e2e (BASE_URL=http://127.0.0.1:8094)

- exit 1; 0 tests ran. globalSetup failed: "Owner session bootstrap failed with 403: App context is not authorized" (POST /api/authentication/login with x-ot-appscope/x-ot-app-id `business-site`, global-setup.ts:178). Thrown by apps/gateway/src/controllers/authentication/authentication.controller.ts (`resolveRegistrationAppId` returned nothing, line ~401).
- Probable cause: the live stack does not register the business-site app/origin (or the seeded owner), which the SKIP_SETUP path needs. Setup normally builds and seeds its own stack. Check whether this is the gateway app-registry (branch gateway changes) or just stack config before calling it a regression.
- Console errors asserted: n/a.

### client-interface-e2e (BASE_URL=http://127.0.0.1:8080)

- exit 1; 151 passed, 27 failed, 408 skipped (1.7 min; three projects: chromium-desktop, mobile-chrome, tablet-chrome). The 27 failures are 9 distinct tests x 3 projects (chat.spec.ts:298 is listed for desktop and mobile).
- bug-report.spec.ts:9 nonce flow: `expect(res.ok()).toBe(true)` false.
- forum.spec.ts:5, :41, :64: forum shell/topics (same forum 503 as Forge).
- oauth-cookie-session.spec.ts:5: popup/provider redirect.
- community-permissions.spec.ts:71, profile-communities.spec.ts:13, user-journey.spec.ts:9 (registers/creates profile), chat.spec.ts:298 (@chat-debug seeded participants).
- Console errors asserted: several specs reference console (chat, personality-modal-sidebar, rr09-\*), not individually verified. 408 skips are the opt-in live/RR specs.

## Assessment

- Local Hub directory pages and S6 evidence are green. One map marker failure, probably seed data.
- Forum 503 in both client apps (/api/forum/topics) points at a missing or unhealthy forum/social route in the live stack rather than the UI; registration-to-login redirects landing on /register and the 403 app-context error point at gateway/auth app-scope registration for these apps. Candidate files if any are branch regressions: apps/gateway/src/controllers/authentication/authentication.controller.ts (`resolveRegistrationAppId`) and the gateway forum proxy; libs/common-ui changes (index.ts +5, decision-history component) are not implicated by any failure message seen. I did not confirm that these fail on main; a baseline run on main would settle it.
- Not tried: re-running failures, running the failures against a clean seed.

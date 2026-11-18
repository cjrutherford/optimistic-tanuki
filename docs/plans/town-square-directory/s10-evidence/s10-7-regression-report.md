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

## Full-stack rerun (2026-11-18)

Decision D6: start the missing services, register the business-site origin, rerun the three shared-UI suites and re-check the Local Hub focus marker. Env as before (`SKIP_SETUP=true`, `PLAYWRIGHT_HEADLESS=true`, `chrome` channel, `--reporter=line`). No source was edited; nothing in this section is a branch regression.

### Services started

All with `BUILDX_CONFIG=/tmp/ot-buildx BUILDX_BUILDER=ot-hostnet docker compose -p optimistic-tanuki --profile directory --env-file .env.directory.local build <svc>` then `up -d --no-deps <svc>`. The directory, directory-worker, directory DB, social and gateway containers were not touched.

| Service                                           | Container              | Needed by                                                 |
| ------------------------------------------------- | ---------------------- | --------------------------------------------------------- |
| forum                                             | ot_forum               | forum specs in forgeofwill and client-interface (the 503) |
| chat-collector                                    | ot_chat_collector      | chat debug spec                                           |
| bug-report                                        | ot_bug_report          | client-interface bug-report nonce spec                    |
| store, workspace                                  | ot_store, ot_workspace | business-site workspace provisioning (seed)               |
| blogging                                          | ot_blogging            | business-site blog catalog                                |
| lead-tracker                                      | ot_lead_tracker        | business-site booking and lead intake                     |
| authentication (recreated, same image and config) | ot_authentication      | `AUTH_AUTO_VERIFY_EMAILS=true`, see below                 |

Two changes to the live stack beyond starting containers:

- `ot_authentication` was recreated with `AUTH_AUTO_VERIFY_EMAILS=true` (the e2e compose files under `e2e/` set the same). The live default is `false`, so every spec that registers or seeds an account hit `EMAIL_VERIFICATION_REQUIRED`. It keeps that value now; recreate it without the override to restore the default. It came back on the same container IP, so the gateway needed no restart.
- `ot_lead_tracker` had an empty database (the compose `db-setup` was not run for it). I ran that project's own migration runner (`typeorm migration:run`, the same command `scripts/setup-and-migrate.sh` uses) against `ot_lead_tracker` only: 24 migrations applied. I did not run the full `db-setup`, because it touches every service database.

### Registration of business-site

The registry mounted into the gateway (`.agent/s5-tailnet-registry.json`, gitignored) already lists `business-site` at `http://localhost:8094`. The earlier 403 came from the origin: the first run used `http://127.0.0.1:8094`, and `resolveRegistrationAppId` binds the app to the registered origin string. Using `BASE_URL=http://localhost:8094` (and `localhost:8080` for client-interface) resolves the app. No registry edit was needed. The same rule explains the forgeofwill failures (below).

Business seeding used the existing seeders, as `global-setup.ts` does: `scripts/seed-permissions.sh` with `SKIP_PERMISSION_USER_ASSIGNMENTS=true`, then `apps/business-site/src/seed-business.mjs` with `BUSINESS_SITE_PUBLIC_ORIGIN=http://localhost:8094 GATEWAY_URL=http://localhost:3000/api`. It was run twice: the first run seeded owners and workspaces but its lead seeding is best-effort and silently skipped while lead-tracker was down; the second run (after lead-tracker was up) seeded the accepted and queued client leads. One stray test account was also registered by a manual curl probe of the register endpoint while diagnosing the 400; it is harmless and was not removed (no direct DB edits).

### Per-suite results

| Suite              | Before                            | After                                           |
| ------------------ | --------------------------------- | ----------------------------------------------- |
| forgeofwill-e2e    | 29 pass / 5 fail / 0 skip         | 31 pass / 3 fail / 0 skip                       |
| client-interface   | 151 pass / 27 fail / 408 skip     | 172 pass / 6 fail / 408 skip                    |
| business-site-e2e  | 0 ran (global setup 403)          | 19 pass / 1 fail / 1 not run                    |
| Local Hub map.spec | 24 pass / 1 fail / 2 skip (run A) | map.spec.ts:135 still fails (re-checked, below) |

client-interface's 6 failures are 2 distinct tests across 3 projects (desktop, mobile, tablet).

### Remaining failures

| Spec:line                                                                                            | Cause                                                                                                                                                                                                                                                                                                                                          | Classification                                                             |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| forgeofwill `project-crud.spec.ts:5`, `user-journey.spec.ts:19`                                      | Registration returns 400 "Email authentication is not configured for this application" (`authentication.controller.ts:707`). The registry lists forgeofwill's UI origin as `https://forgeofwill.com`, so the local origin `http://localhost:8081` resolves to no app. Fix is a registry entry plus a gateway restart, which was out of bounds. | Environment/config, not a regression                                       |
| forgeofwill `oauth-cookie-session.spec.ts:5`, client-interface `oauth-cookie-session.spec.ts:5` (x3) | `GET /api/oauth/config` returns `{}`, so no provider button renders and no popup opens. The live gateway has no fake OAuth provider configured; the e2e compose files add an `oauth-provider` container plus `GOOGLE_*` endpoint env on the gateway. Needs a gateway restart with that env.                                                    | Environment/config, not a regression                                       |
| client-interface `forum.spec.ts:41` (x3)                                                             | Expects topic "Community Introductions" to have no threads ("No threads in this topic yet."). The live forum DB has 1 thread in it (172 threads in total), so the topic is not empty. The request itself returns 200.                                                                                                                          | Seed/data difference, not a regression                                     |
| business-site `business-site.spec.ts:1532` (+1 serial test not run, `:1693`)                         | Fails at `:1591`: expects exactly 1 request row matching a fixed description, finds 3. The description is not unique per run, and my reruns on the shared stack (before the accepted-client lead was seeded) left extra `client-session` leads. Booking creation itself passes.                                                                | Stack state from reruns; passes on a clean seed (not re-proven, see below) |
| Local Hub `map.spec.ts:135`                                                                          | `findCity` returns the first `localityType==='city'` community from `/api/communities`. That is `dev-review-0d056f5e` ("Development Review City"), a leftover with `lat`/`lng` null; 179 of 180 cities have coordinates. With no focus coordinates `map.component.ts` renders no `.map-marker--focus`.                                         | Proven seed/data issue, not a regression                                   |

Earlier suspicion on map.spec.ts:135 is confirmed: the data, not the component. A city with coordinates would satisfy the spec; the spec could also pick the first city that has coordinates (a test change outside this slice).

Earlier failures now green: forum 503 (forum container), `bug-report.spec.ts:9`, `forum.spec.ts:5` and `:64`, `forum-access.spec.ts` (both), `community-permissions.spec.ts:71`, `profile-communities.spec.ts:13`, `user-journey.spec.ts:9` and `chat.spec.ts:298` in client-interface (the last four were account registration or profile creation blocked by email verification or missing services), and all of business-site globalSetup.

### Not done

- The business-site `:1532` test was not proven green on a pristine stack: that needs a clean seed, which means resetting the business data in the shared DB, which I did not do.
- forgeofwill local registration and the fake OAuth provider both require a gateway restart (registry entry, `GOOGLE_*` env), left for whoever owns the gateway deploy.
- No baseline run on `main` was done; none of the remaining failures points at branch code.

### Containers left running

ot_forum, ot_chat_collector, ot_bug_report, ot_store, ot_workspace, ot_blogging, ot_lead_tracker (new), ot_authentication (recreated with auto-verify on), plus the three client containers from the first run.

## Gateway follow-up (2026-11-18)

Goal: close the config-only failures left in the full-stack rerun. No source was edited; nothing here is a branch regression. Env as before (`SKIP_SETUP=true`, `PLAYWRIGHT_HEADLESS=true`, `chrome` channel, `--reporter=line`). Local Hub ran with `BASE_URL=http://127.0.0.1:8087` and `GATEWAY_URL=http://127.0.0.1:3000` (the helpers append `/api` themselves, so a `GATEWAY_URL` ending in `/api` makes every community call 404). The other three suites ran with `BASE_URL=http://localhost:<port>` and `GATEWAY_URL=http://localhost:3000/api`.

### Changes to the live stack

| Change                                                                                                                                                                                                                                                                                                                                                                 | Why                                                                                                                              | Revert                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.agent/s5-tailnet-registry.json` (gitignored, hand-kept; no generator references it): forgeofwill `uiBaseUrl` changed from `https://forgeofwill.com` to `http://localhost:8081`. The e2e registry (`e2e/app-registry.e2e.json`) makes the same kind of change for its loopback origin. `domain` and `apiBaseUrl` are unchanged; no YAML was touched.                  | `resolveRegistrationAppId` binds an app to its registered `uiBaseUrl` origin, so `http://localhost:8081` resolved to no app.     | Set that one field back to `https://forgeofwill.com` and restart `ot_gateway`.                                                                                            |
| `ot_gateway` recreated with `GOOGLE_CLIENT_ID=e2e-google-client-id`, `GOOGLE_CLIENT_SECRET=e2e-google-client-secret`, `GOOGLE_AUTHORIZATION_ENDPOINT=http://127.0.0.1:3016/authorize`, `GOOGLE_TOKEN_ENDPOINT=http://oauth-provider:3016/token`, `GOOGLE_USER_INFO_ENDPOINT=http://oauth-provider:3016/userinfo` (same values as `e2e/docker-compose.e2e-stack.yaml`). | `/api/oauth/config` returned `{}`.                                                                                               | Recreate with the same compose command and without the override file. Same image `sha256:504ea4296e1d...`; diff of the full env showed only these five Google keys added. |
| Fake OAuth provider started as `optimistic-tanuki-oauth-provider-1` (image `cjrutherford/optimistic_tanuki_oauth-provider:latest`, built from `e2e/oauth-provider/Dockerfile`, port 3016, network alias `oauth-provider`).                                                                                                                                             | Target of the Google endpoints above.                                                                                            | `docker rm -f optimistic-tanuki-oauth-provider-1`                                                                                                                         |
| `ot_project_planning` built and started (`--no-deps`).                                                                                                                                                                                                                                                                                                                 | Not running; `/api/project-planning/projects` returned 500, which hid behind the registration failure in `project-crud.spec.ts`. | `docker rm -f ot_project_planning`                                                                                                                                        |

The gateway was recreated through `docker compose -p optimistic-tanuki --profile directory --env-file .env.directory.local -f docker-compose.yaml -f <override>` where the override only adds the five Google variables and the oauth-provider service. `AUTH_AUTO_VERIFY_EMAILS=true` on `ot_authentication` is kept: the specs register accounts and then act as them, so they cannot pass with email verification required. Recreate authentication without the override to restore the default (`false`).

### Per-suite results

| Suite                                                              | Before                       | After                        |
| ------------------------------------------------------------------ | ---------------------------- | ---------------------------- |
| forgeofwill-e2e                                                    | 31 pass / 3 fail             | 34 pass / 0 fail             |
| client-interface (desktop, mobile, tablet)                         | 172 pass / 6 fail / 408 skip | 175 pass / 3 fail / 408 skip |
| business-site-e2e                                                  | 19 pass / 1 fail / 1 not run | 19 pass / 1 fail / 1 not run |
| Local Hub public-pages, map, unauthenticated-protection, api-smoke | 24 pass / 1 fail / 2 skip    | 24 pass / 1 fail / 2 skip    |

Closed: forgeofwill `project-crud.spec.ts:5`, `user-journey.spec.ts:19` and `oauth-cookie-session.spec.ts:5`; client-interface `oauth-cookie-session.spec.ts:5` (x3).

### Remaining failures

| Spec:line                                                                      | Cause                                                                                                                                                                                                                                                                                                                                                                                                                                        | Classification                                                       |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| client-interface `forum.spec.ts:41` (x3)                                       | "Community Introductions" holds one thread, "Hi I'm Chris", created 2026-10-28 by a real user and profile. `FORUM_SEED_TOPICS` seeds topics only, and no e2e run authored it (the earliest of the 172 threads is from 2026-10-06). It is real content in the shared dev database, not residue, so I did not remove it. The spec assumes an empty seeded topic.                                                                               | Seed/data assumption in the spec, not a regression                   |
| business-site `business-site.spec.ts:1532` (`:1693` is serial and did not run) | Expects exactly 1 request row with the booking description, finds 3. Each run leaves a completed booking behind, and the owner workflow lists completed bookings. The gateway exposes only owner approve and complete for bookings (no cancel or delete) and the store has no delete-appointment command, so there is no app path to clear them; the only route is SQL, which I did not use. The test cannot pass twice on one shared stack. | Stack state, passes on a fresh business seed (not re-proven)         |
| Local Hub `map.spec.ts:135`                                                    | First city is `dev-review-0d056f5e` "Development Review City" (lat/lng null). It comes from the committed seeder `scripts/seed-otts-review.mjs` (created 2026-10-28) and is the deliberate blocked/town-ineligible fixture that `s6-directory-evidence.spec.ts` (`BLOCKED`) depends on. Not residue, so I did not delete it through `DELETE_COMMUNITY`.                                                                                      | Legitimate seed; spec picks the first city, not one with coordinates |

### Not done

- No test change to `findCity` (map) or the forum spec; both are outside this slice.
- No baseline run on `main`.

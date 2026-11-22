# Owner Console: scorecard and overhaul plan

Date: 2026-11-21. Scope: `apps/owner-console`, plus the owner-facing needs added
by the recent merges (Town Square directory S0–S10 #292, Daylight/civic #275
#286 #293, OTTS hardening #283, HAI dock and registry #290, BTO slice 11,
Docker/CI #298).

## 1. Scorecard

Each dimension is scored from 0 to 10 and checked against the code. The overall
score is the unweighted mean.

| #   | Dimension                              | Score | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --- | -------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Findability (can I get to the tool?)   | **2** | There are 54 routes under `/dashboard` but only 10 sidebar entries, and the sidebar starts collapsed (`dashboard.component.ts:27`). `community-ops` and `experience` use bespoke components, so the cards in `operator-workspaces.ts` for those two workspaces are never rendered (`app.routes.ts:153`). Several pages can only be reached by typing their URL: the 7 global directory tools, `/tenants`, `/oauth-inspector`, and `/app-config/designer` from the workspace. Per-town directory queues are 4 hops deep, and each page has no way to switch towns.                                                                    |
| 2   | Orientation (what needs me right now?) | **4** | Overview has metric cards and an attention queue. But it covers only commerce, config and contacts. Directory review queues, moderation reports, Daylight takedowns and service health are missing.                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 3   | Trustworthiness of what is shown       | **2** | Every Overview call is wrapped in `catchError(() => of([]))` (`operator-overview.component.ts:258-276`), so an outage shows up as "0" or "all good". Registry edits are held only in gateway memory (`registry.controller.ts:59`), so a restart reverts them and the UI does not say so. Deployment health is read from a YAML file, not from live probes. The Operations page shows dev scaffolding: "Mutation coverage matrix", "Slice tracker" and "Projected score impact" (`operations-workspace.component.ts:325-422`).                                                                                                        |
| 4   | Coverage of the platform               | **5** | Governance, commerce, registry, video and security/performance are covered. Directory coverage is broad, but most of it is orphaned (see row 1). Missing: Daylight/civic operations, which plan D14 says belong here but were built in local-hub; live health for the civic services, ClamAV and directory-worker; BTO quoting, which lives in system-configurator and spoofs the `owner-console` app scope; the directory follow-ups (suspended bindings, mapping deactivate, boundary lock); and classifieds moderation. Owner functions are split across setup-console, business-configurator, system-configurator and local-hub. |
| 5   | Language                               | **3** | Labels use internal jargon: "Unified operator control plane", "Locality and membership control plane", "Capability model", "Run ledger", "Community Ops", "Experience", "App Scopes". A label says which subsystem a tool belongs to, not what the owner is trying to do.                                                                                                                                                                                                                                                                                                                                                            |
| 6   | Consistency                            | **4** | 36 components have their own inline hero and panel CSS. There is no shared page header, filter bar or state components. Destructive actions are confirmed three different ways: native `confirm()` in 12 places, modals in governance, and typed confirmations in the directory. The directory pages call `HttpClient` directly, while every other domain goes through a service. The CRM workspace holds a single card. There are three "overview" pages and two "control centers".                                                                                                                                                 |
| 7   | Task efficiency                        | **3** | Most tasks take 3–4 hops. There is no search, no command palette and no breadcrumbs. The active nav highlight is computed once in `ngOnInit` (`dashboard.component.ts:110`), so it goes stale as you move between pages. The town context resets every time you go back.                                                                                                                                                                                                                                                                                                                                                             |
| 8   | Maintainability                        | **4** | Four components are over 1,100 lines: community-ops at 1,493, users at 1,191, operations at 1,188 and contacts at 1,124. The workspace config drives some views but not others, so a new page has no single place to register itself. About 124 unit specs make this easier to fix safely.                                                                                                                                                                                                                                                                                                                                           |
| 9   | Verified behaviour                     | **3** | The only e2e spec (`apps/owner-console-e2e/src/example.spec.ts`) covers logged-out redirects and the login form. There is no authenticated e2e for navigation, the queues or CRUD. The mutation matrix marks all 54 rows complete but leaves out everything that came with the directory and Daylight.                                                                                                                                                                                                                                                                                                                               |
| 10  | Access safety                          | **6** | The gateway enforces owner scope (`OwnerConsoleScopeGuard`), and the directory pages use strong typed confirmations and undo. Weak spots: the client guard only checks that the user is logged in, so a non-owner sees every page and gets errors; and system-configurator sends the `x-ot-appscope: owner-console` header itself.                                                                                                                                                                                                                                                                                                   |

**Overall: 3.6 / 10.** Most of the capability already exists and the backends
are reasonably strong. The console falls down on navigation, orientation and
trust: an owner cannot find the tools, cannot see what needs attention, and
cannot trust that zero means zero.

## 2. Target shape

Organise the console around what the owner does, not around subsystems. A
single nav tree should drive the sidebar, the routes, the breadcrumbs, search
and a coverage test.

```
Home                 Attention inbox + platform health (the default page)
People & access      Users · Roles & permissions · App access · Access checker
Towns                Town picker → per-town tabs:
                       Overview · Communities · Boundary · Directory queues
                       (address, identity, links, duplicates, reports,
                       suppressions) · Daylight
Directory            Acquisition runs · Taxonomy (cases, runs, mappings) ·
                       Rights & withdrawals · Exports · Controls & metrics
Moderation           One queue: social, forum, directory reports,
                       Daylight takedowns, filterable by source
Commerce             Store · Orders · Appointments & availability ·
                       Leads (was CRM) · Hardware quotes (BTO)
Apps & sites         Registry · App configs + designer · Themes · Tenants
System               Service health · Deployments & rollouts · OAuth ·
                       Security · Performance · Video processing
```

Principles:

- **One nav model.** One `OWNER_NAV` tree with a label, route, icon, required
  permission, count source and an optional `needsTown` flag. Routes, the
  sidebar, breadcrumbs and a Ctrl-K palette are all generated from it. A spec
  fails if a routed page is not in the tree, so a page can never be orphaned
  again.
- **Town is context, not a URL fragment you type.** A persistent town switcher
  in the app bar, with routes under `/towns/:townId/...`. Switching town keeps
  you on the same tab.
- **Counts everywhere.** Each nav entry and Home tile shows how many items are
  waiting. The counts come from a small gateway summary endpoint, not from
  fetching whole collections.
- **Errors look like errors.** A failed source shows as "unavailable" with a
  retry, never as zero.
- **Plain labels.** "Address review", not "local-evaluation-listings". No
  hero banners on working pages.
- **One confirmation ladder.** A shared dialog with three levels: plain confirm
  (reversible actions), confirm + reason (actions that affect users), and typed
  confirm (bulk or irreversible). Undo where the backend supports it.

## 3. Plan, in slices

Each slice can be shipped on its own and is ordered by usability gained per
unit of effort.

### S0. Stop the bleeding (small)

- Remove the mutation-matrix, slice-tracker and score-impact panels from
  Operations, and the "Remaining social gaps" panel. Keep the matrix as a spec
  fixture only.
- Overview: replace `catchError(() => of([]))` with a per-tile error state and
  a retry.
- Sidebar: open by default at desktop width, and derive the active item from
  router events.
- Link every orphaned page as a stopgap (the directory global tools, tenants,
  designer). Delete the `oauth-inspector` alias.
- Remove the dead `theme$` subscription and the duplicated redirect.

### S1. Nav model and shell

- Add `OWNER_NAV` and generate routes, a grouped sidebar, breadcrumbs and a
  Ctrl-K palette from it.
- Add the nav-coverage spec.
- Rename labels to the target shape. Retire the workspace landing pages and
  the duplicated "overview" and "control center" pages.
- Add a client-side permission check so non-owners see a clear "no access"
  page.

### S2. Town context

- Add a town switcher with `/towns/:townId/*` routes. Move the per-town
  directory and boundary pages and the community/city pages under it.
- Split `community-ops-workspace.component.ts` (1,493 lines) into the town
  picker and the per-town tab pages.

### S3. Home = attention inbox + health

- Add a gateway `GET /owner/attention` that returns `{source, count, oldest,
link}` for each queue: directory queues per town, moderation, orders,
  appointments, leads, draft configs, failed runs and Daylight takedowns.
- Add a health strip from live probes of every compose service, including
  civic-briefing, civic-contributions, ClamAV, directory and directory-worker.
  Do not read health from the deployment YAML.
- Show counts on nav badges.

### S4. Shared page kit and migration

- Add `owner-page` components to a lib: page header, filter bar, data table on
  ag-grid-ui, empty/loading/error states, and the confirmation ladder.
- Migrate pages, largest first: users, operations, contacts, registry, roles.
  Move the directory pages' `HttpClient` calls into a `DirectoryAdminService`.
- Move all inline styles onto personality tokens. Run
  `tools/personality-audit.mjs` on every slice.

### S5. Unified moderation queue

- One list over social, forum, directory listing reports and Daylight
  takedowns, filterable by source and town. Each row opens the existing
  detail or action view.

### S6. Coverage the recent merges need

Owner decisions are needed first (see §4).

- **Daylight**: bring the operations page into Towns → Daylight. Add SD.6
  (source decision log, overrides, health) and a source-requests queue. This
  needs new civic-briefing operator routes.
- **Registry durability**: persist publish, rollback and the audit log in a
  table, or write edits back to `apps.yaml` as a PR. Until then, label edits as
  "runtime only — reverts on restart". This matters now because the HAI dock
  pins apps based on the registry.
- **BTO quotes**: move `/operator/hardware` into Commerce, and stop
  system-configurator spoofing the owner-console scope.
- **Directory follow-ups**: a suspended-bindings view, a mapping deactivate
  control, a boundary-lock action, and optionally backup, re-normalize and
  cohort-cutover as guarded operator jobs.

### S7. Verification

- Authenticated Playwright smoke tests: log in as owner, visit every
  `OWNER_NAV` entry, and assert there are no console errors and a page header
  renders. Add one happy-path flow per section: assign a role, resolve an
  address review, cancel a run, moderate a report.
- Deny-path tests: a non-owner sees "no access".

## 4. Decisions for the owner

1. **Where Daylight operations lives.** Plan D14 says owner-console, but the
   page was built in local-hub. Should we move it, mirror it, or amend D14?
2. **Registry source of truth.** Should we keep a DB-backed runtime registry,
   or treat `apps.yaml` as the truth and have the console propose changes as
   commits?
3. **Consolidation.** Should owner functions in setup-console (post-bootstrap
   deploys and rollouts), business-configurator and system-configurator fold
   into owner-console, or stay as separate tools linked from System and
   Commerce?
4. **Public `/control-center`.** Should we keep the unauthenticated status page,
   or replace it with the login page?

The recommended order is S0 → S1 → S2 → S3. Those four slices fix findability,
orientation and trust, the three lowest scores, with no new backend work
except the summary endpoint in S3. S4–S7 can follow in any order, once the
decisions above are made.

## 5. Provider login regression (production, reported 2026-11-22)

### What production does today

These were probed from outside on 2026-11-22.

- `GET /api/oauth/start/google` returns a 302 to Google on optimistic-tanuki.com,
  forgeofwill.com and hopefulaspirationsindustries.com. Each response has the
  correct `redirect_uri=https://<domain>/api/oauth/callback/google`, PKCE, and
  sets the `oauth_state_nonce` cookie (`Path=/api/oauth; Secure; SameSite=Lax`).
- `GET /api/oauth/config` returns 200. `GET /api/oauth/providers` returns 401,
  which is by design: it lists the providers linked to a signed-in user.

The first half of the flow, from the button to the provider, therefore works.
The failure is somewhere between the provider calling back and the session
being issued.

### Why the cause can't be seen

The callback handler (`oauth.controller.ts`, the `catch` after
`createCallbackGrant`) logs only `OAuth callback failed` and sends the browser
to `error=oauth_callback_failed`. More than ten steps can throw inside that
`try`, and they all end up looking the same.

### Candidates, ranked

Most of these were introduced by #283 (`f1a96856d`, 2026-10-27) and
`50854d5eb` (N02, 2026-10-23).

1. **A schema that wasn't migrated.** Every login now calls
   `AccountDeletionFenceService.assertActiveAccount`, which queries
   `account_deletion_operations` (migration `AccountDeletionControl1792886267140`).
   Rolling sessions read the columns added by `RollingSessionActivity1793105343107`.
   Migrations run only through `db-setup` or `OT_RUN_MIGRATIONS_ON_START=true`.
   If production was deployed without running `db-setup`, the query fails, and
   both password and provider login would break.
2. **Strict checks on the callback session** (N02). The gateway rejects the
   session unless `sessionId` is a UUID and `userId`, `profileId` and `appId`
   all match exactly. The authentication service also requires `appId` to
   match `^[a-z][a-z0-9_-]*$`. A start request with no `appScope`, or one with
   a scope that maps to a different canonical id, fails here.
3. **The callback-code exchange.** It needs the `oauth_state_nonce` cookie
   (scoped to `/api/oauth`) and an `Origin` that exactly equals the grant's
   `returnOrigin`. A `www.` origin against an apex origin, or a popup on another
   origin, fails with 401 "Invalid OAuth callback code".
4. **New sign-ups on client-interface and local-hub.** These now require an age
   check (`AGE_CHECK_REQUIRED`). This blocks first-time provider sign-ups only,
   not returning users.
5. **Guardian account access** (`guardianPermissionService.assertAccountAccess`
   inside `validateToken`). Accounts whose legacy age-eligibility backfill left
   them blocked would fail at the exchange.

### Evidence needed to pick one

- The URL or error the browser ends on after consent: `oauth_callback_failed`,
  `email_verification_required`, a provider page such as
  `redirect_uri_mismatch`, or a 401 from `/api/oauth/callback/exchange`.
- Whether email and password login works in production. If it fails too, the
  cause is #1.
- Gateway and authentication logs around one attempt.
- Which commit production runs, and whether `db-setup` ran after the last
  deploy.

### Fix plan

- **O1.** Log a step label in the callback `catch` (`state`, `token_exchange`,
  `login`, `register`, `profile`, `owner_access`, `callback_session`, `grant`)
  without the error content, so production shows which step failed. Do the same
  for the exchange's 401 branches.
- **O2.** Fix the step that fails, and add a regression spec for it.
- **O3.** Add a full provider-login e2e test using a stub OAuth provider, so a
  regression fails CI instead of production.
- **O4.** Owner console, System → OAuth health: surface admin-api's unused
  `oauth/validate` and `oauth/test`, the per-domain redirect URIs, and recent
  callback failures counted by step label. This belongs in slice S3 (health).

### Findings on production (2026-11-22, read-only over SSH)

- Production runs `sha-21291f1` (#298). All containers were recreated at
  about 03:10 UTC on 2026-11-22.
- **The Postgres cluster was created fresh at 2026-11-06 03:55 UTC.** Every
  database has that creation time, and the bind mount is `/opt/postgres_data`.
  `ot_authentication` contains 0 `user_entity` rows, 0 `oauth_provider` rows
  and 0 `token` rows. `ot_profile` contains 0 `profile` rows. Their
  `n_tup_ins` counters are all 0, so no insert has been attempted since then.
  Social (426 communities) and permissions (62 roles) hold seed data only.
- Each login attempt produces the same three log events:

  1. The gateway logs the start.
  2. About 10 seconds later, the authentication service logs one debug line,
     `OAuth login attempt`.
  3. 23 ms after that, the gateway logs an error.

  The authentication service never logs `Registering user`, and the profile
  service logs nothing.

- **What that means.** The authentication service finds no linked account
  and returns `needsRegistration`. The gateway then throws in the registration
  branch before it calls Register. That can only happen at one of these
  points:

  - **Owner console:** OAuth sign-up is refused in production by design. The
    owner account has to come from the deployment bootstrap, which has not
    run since the rebuild.
  - **client-interface and local-hub:** a new account needs an age check
    first, so these throw `AGE_CHECK_REQUIRED`.
  - **Any app:** `requireUsableOAuthEmail` throws if the provider returns no
    public email. GitHub does this when the user keeps their email private.

  The browser is shown the generic "OAuth authentication could not be
  completed" for all of these.

- **Logging regression (#283, `libs/logger/src/lib/payload-free-logging.ts`).**
  Every backend's logs become `{"event":"diagnostic.rejected"}`, and there is
  no way to switch it off. Production cannot record any operational detail.

### Revised fix plan

- **O0 (operations).** Confirm the 2026-11-06 rebuild was intended. Then run
  the owner bootstrap (`admin-api` `bootstrap/owner`) so an owner account
  exists.
- **O1.** Turn the internal failure codes into reasons the user can act on,
  passing an allow-listed `error` code to the callback page:

  - `age_check_required`: send the user to the age gate, then retry.
  - `owner_not_provisioned`
  - `provider_email_missing`

  Add an allow-list of safe event codes for the OAuth steps, so production
  logs show which step failed.

- **O1b.** Revisit the payload-free logger. Keep payloads out, but allow a
  per-module catalogue of event codes. Today every message is rejected, which
  hides every failure in production, not only OAuth.
- O2–O4 as above.

### Root cause and owner decisions (2026-11-22)

- **Root cause.** On the production host the env file spells the key
  `OWNER_BOOTSRAP_EMAIL`, with a T missing. `scripts/prod-seed.sh` therefore
  skips the owner bootstrap on every deploy, printing only a one-line echo, so
  the database has never held a user. The owner has fixed the key; it takes
  effect on the next deploy.
- **D-O1. Linking is explicit.** When a provider identity matches an existing
  local account by email, nothing is linked automatically, even when the
  provider has verified the email. The user sees a link step and has to prove
  they own the local account before the provider is attached.
- **D-O2. The age gate resumes instead of failing.** If OAuth sign-up on an
  age-gated app (client-interface, local-hub) arrives without an age check,
  the callback runs the age-verification step, including the guardian path
  where it applies, and then completes sign-up.
- **D-O3. Every failure has a name.** Each failure in the callback reaches
  the user as a specific, allow-listed code and a sentence they can act on.
  It is logged as a safe event code together with the step that failed. Deploy
  scripts fail loudly when the owner bootstrap is only partly configured.

### Contract: pending OAuth intents

Some callbacks cannot finish in one pass: they need a link confirmation or an
age check first. In those cases the gateway stores a **pending intent** in
Redis. The intent is single-use, expires after 10 minutes, is keyed by an
opaque 32-byte random id, and is bound to the `oauth_state_nonce` browser
cookie, using the same binding as the callback grant. It holds the provider
identity (provider, providerUserId, email, emailVerified, displayName), the
appScope, returnTo, cookieSession and the matched userId (link only). Nothing
from the provider token goes into it.

The callback redirects to the final callback URL with
`pending=<kind>&pendingCode=<id>&returnTo=…`, where `kind` is `link_account`
or `age_verification`. A link redirect also carries `email` (masked, for
example `j***@example.com`) and `provider`.

Gateway endpoints, all `@Public()`, need the nonce cookie and are rate
limited:

- `GET /api/oauth/pending/:code` returns `{ kind, provider, maskedEmail,
appScope, methods }` without consuming the intent. For a link intent,
  `methods` is `['password']` when the account has a password, otherwise
  `['email_code']`.
- `POST /api/oauth/pending/:code/link/email-code` sends a 6-digit code to the
  account email. It is used only when `methods` includes `email_code`.
- `POST /api/oauth/pending/:code/link` takes `{ password }` or
  `{ emailCode }`. The gateway verifies the credential through the
  authentication service, links the provider (`LinkProvider`), issues the
  callback session and grant, and returns `{ callbackCode, returnTo }`. A
  wrong credential returns `401 { error: 'link_credentials_invalid' }`, and
  the intent stays usable for up to 5 attempts. After that it is consumed and
  the response is `link_attempts_exhausted`.
- `POST /api/oauth/pending/:code/cancel` deletes the intent.
- `POST /api/oauth/pending/:code/age` takes `{ dateOfBirth }` or
  `{ guardianResumeToken }`. It runs the same age-eligibility evaluation as
  password sign-up. When the user is eligible, it registers the user and
  returns `{ callbackCode, returnTo }`, or `{ verificationRequired: true }`
  when email verification is still outstanding. If guardian consent is
  needed, it returns `{ error: 'guardian_consent_required', … }` with the same
  shape that password sign-up uses, so the existing guardian UI can take
  over. Signing up underage with no guardian returns `age_ineligible`.

In the authentication service, `OAuthLogin` no longer auto-links. When the
email matches an existing user, it returns `{ code: 1, data: { needsLink:
true, userId, hasPassword } }` and leaves the provider unlinked.

**Error codes.** The callback `error` value is always one of the following.
Each has a fixed `error_description` that the UI may override with its own
copy.

| Code                          | Meaning                                                                     |
| ----------------------------- | --------------------------------------------------------------------------- |
| `provider_denied`             | The user cancelled at the provider.                                         |
| `provider_exchange_failed`    | The code exchange or the profile fetch failed.                              |
| `provider_email_missing`      | The provider returned no usable email.                                      |
| `state_invalid`               | The state or nonce is missing, expired or mismatched.                       |
| `account_deleted`             | The account is behind the deletion fence.                                   |
| `registration_closed`         | The app refuses OAuth sign-up, for example the owner console in production. |
| `owner_not_provisioned`       | The owner console has no provisioned owner.                                 |
| `not_authorized_for_app`      | The user lacks access to the app, for example the owner console.            |
| `guardian_mismatch`           | The guardian permission belongs to another applicant.                       |
| `email_verification_required` | The address must be verified first (existing).                              |
| `session_issue_failed`        | Creating the session or grant failed.                                       |
| `profile_setup_failed`        | The app-scoped profile could not be created.                                |
| `oauth_callback_failed`       | Unexpected; also logs `oauth.callback.unexpected` with the step.            |

Each step in the callback sets a step label: `state`, `exchange`, `login`,
`register`, `profile`, `access`, `session` or `grant`. A failure logs
`oauth.callback.failed` together with `{ step, code }`, using only
allow-listed values, through a per-module event catalogue in
`libs/logger` (O1b).

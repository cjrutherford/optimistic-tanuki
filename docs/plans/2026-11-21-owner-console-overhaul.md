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

### Owner answers (2026-11-22)

1. **Daylight operations: mirror in both.** Local-hub keeps its page.
   Owner-console adds Towns → Daylight over the same civic-briefing operator
   routes. The two must not diverge, so the shared pieces go in a lib.
2. **Registry: managed from the owner console, with YAML and the database
   kept in sync.** In deployment, `apps.yaml` seeds a database-backed
   registry. The console edits the database, so changes survive restarts, and
   records each publish and rollback in an audit log. Where possible it also
   exports changes back to YAML, as a downloadable diff or a proposed commit.
   The console flags any drift between YAML and the database.
3. **Consolidation: fold in now.** The owner functions in setup-console
   (post-bootstrap deploys and rollouts), business-configurator and
   system-configurator move into owner-console under System and Commerce.
   That ends system-configurator spoofing the owner-console scope.
4. **Public `/control-center`: replace with login.** Status moves behind
   authentication, onto Home.

The recommended order is S0 → S1 → S2 → S3. Those four slices fix findability,
orientation and trust, the three lowest scores, with no new backend work
except the summary endpoint in S3. S4–S7 can follow in any order, once the
decisions above are made.

## 4a. Progress

Boundary tag `owner-console-overhaul-s0-s4` (2026-11-23): S0–S4 done and
verified locally (owner-console 1,021 tests, owner-page-ui 31, gateway 2,468;
lint, build and personality audit clean). Not pushed.

| Slice | Commit      |
| ----- | ----------- |
| S0    | `3b66ba981` |
| S1    | `6f407ca73` |
| S2    | `e332fd255` |
| S3    | `944651c9e` |
| S4a   | `112f3a0e1` |
| S4b   | `ec2fb6554` |

Open carry-overs: nav leaves have no `requiredPermission` yet (needs real
permission names); users, roles and contacts components are 575–610 lines;
store/appointment/lead/report counts fetch full lists until count commands
exist; directory-worker health needs `DIRECTORY_WORKER_HEALTH_URL` off the
default host.

### After the boundary (S5–S6)

| Slice                    | Commit      | Note                                                                                                            |
| ------------------------ | ----------- | --------------------------------------------------------------------------------------------------------------- |
| S5 moderation queue      | `b4581866e` |                                                                                                                 |
| S6a Daylight mirror      | `a6bc3f1ce` | SD.6 decision log, overrides, per-source health and the source-request queue need civic-briefing commands first |
| S6b durable registry     | `31db17bba` | migration `AddRegistryDurability1795411571917`                                                                  |
| S6c fold-in              | `a97abeae5` | only BTO hardware quotes needed moving                                                                          |
| S6d directory follow-ups | uncommitted | done except the migration, backup and cohort cutover; see below                                                 |

S6d is built on all three layers. Open items are listed first.

Open:

- **Migration not generated.** `directory_operator_event` (the generic operator
  audit table: `kind`, `subjectId`, `action`, `actorId`, `reason`, `detail`,
  `at`, index `IDX_directory_operator_event_subject` on `kind, subjectId, at`)
  has an entity and no migration, because no Postgres was reachable to run
  `typeorm:migration:generate`. Generate it, review the SQL, then run the
  DB-gated suite `apps/directory/test/owner-boundary-lock.postgres.test.js`,
  which has not been run.
- **Revalidation needs configuration.** The directory service reads
  `DIRECTORY_CONTACT_STAGE_DATABASE_URL`, `DIRECTORY_CONTACT_STAGE_LABEL` and
  `DIRECTORY_REVIEWED_BINDING_HMAC_KEY` (32+ characters). Compose does not set
  them, so the revalidate route answers 503 until it does.
- **Jobs are in memory.** Re-normalize job state does not survive a Directory
  restart; the console says so and treats a 404 on a known job as final. One job
  runs at a time (409 `job_running`). Start and finish are audited durably.
- **Backup and cohort cutover are out of scope.** No code exists for either, and
  both need a product decision (what is backed up, where, and which cohorts)
  before an endpoint can be specified.

Done:

- Suspended bindings: `GET /internal/reviewed-bindings?state=suspended`
  (town filter, keyset cursor, total) and `POST .../:id/revalidate`. Gateway
  `directory.operate`; attention source `directory.suspendedBindings`; console
  page "Suspended bindings" (plain confirm).
- Mapping deactivate and activate: `POST mappings/:versionId/(deactivate|activate)`.
  Deactivating the only active version is refused (409
  `unmapped_policy_excludes`) unless its policy is `keep_legacy`. Audited.
  Console: deactivate asks for a reason, activate a plain confirm.
- Boundary lock: `GET|POST towns/:id/boundary-lock`, `POST .../boundary-unlock`
  (gateway `directory.review`). The lock row is the single truth: recovery keeps
  and re-creates a lock, and unlock deletes the row so recovery does not bring
  it back. Lock needs a verified current boundary. Console: typed (town name)
  lock, reason unlock, current state shown.
- Re-normalize: `POST /internal/jobs/renormalize` (dry run by default; a real
  run needs a reason) and `GET /internal/jobs/:id`. Console "Directory jobs":
  real run needs the typed phrase `RENORMALIZE`; status polls with backoff and
  stops when the job is done, fails repeatedly, or the page closes.

## 5. Provider login regression

Moved to its own plan and PR: `docs/plans/2026-11-22-oauth-provider-login.md` on branch `t3/oauth-provider-login-fixes`.

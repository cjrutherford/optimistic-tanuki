# Daylight: localities and sources from the database

Replaces SD.0 of `2026-09-30-daylight-civic-briefing-integration.md`.
Goal: civic-briefing builds and processes feeds for every town seeded in the
database. No YAML is mounted or shipped in the image; the locality YAML is a
build artifact generated from the database.

## Decisions (owner, 2026-11-04)

- **D25 The seeded database towns are the source of truth.** civic-briefing
  pulls communities from social over TCP (`LIST_LOCALITY_COMMUNITIES`). The
  POC's bespoke locality YAML (the GA fixtures) is ignored at runtime; it
  remains only as a frozen test fixture (D18).
- **D26 Every city and town gets editions.** Synced communities with
  `localityType` `city` or `town` are `edition: true` (262 today).
  Neighborhoods, counties and regions are synced as localities but get no
  edition (revised 2026-11-04). The density rule thins quiet towns to weekly.
  A global kill switch and per-tick throughput limits keep this bounded (S6).
- **D27 Derive gaps minimally.** Timezone is derived from lat/lon; each town's
  parents are its state root, which sits under the `US` root. FIPS and county
  parents wait for SD.1.
- **D28 No hand-kept locality state on disk.** Discovered sources and the
  discovery decision log live in Postgres. No carry-over of existing files
  (no deployed clients).
- **D30 Disambiguation is kept (2026-11-04).** `localities` gains
  `excludePhrases` and `officials` (generated migration). The sync derives
  exclude phrases for a town whose name is shared by a notable place in
  another state (`Nashville, Tennessee`, `Nashville, Tenn.`,
  `Nashville, TN`), and writes them only while the column is empty, so
  hand-set values survive.
- **D29 YAML is generated, not shipped.** civic-briefing renders the registry
  YAML from the database into a generated directory on the data volume, and
  the existing `loadLocalityRegistry` reads it. The image contains no locality
  YAML, and nothing mounts one.

## Current state (HEAD 6a472b41f)

- `DailySchedule` (`apps/civic-briefing/src/app/schedule/daily.ts`) loads
  `loadLocalityRegistry(CIVIC_LOCALITIES_DIR, CIVIC_DISCOVERED_SOURCES)` from
  YAML + JSON. `main.ts:buildSchedule` returns null when the dir is unset,
  which is the case in prod compose and k8s, so nothing runs there.
- `ensureLocality` (`libs/civic/core/src/pipeline.ts`) mirrors the YAML into
  `localities`/`sources` on each run.
- `BackfillService`, `PipelineHealthService` and `civic-contributions` each
  read the YAML dir themselves.
- Adoption writes `<data>/sources/discovered/<slug>.json` and
  `decisions.jsonl`; `sourcingDue` reads `lastSearched` from that log.
- Social `Community` has `slug` (`atlanta-ga`), nullable `localitySlug` (set
  on 3 rows), `adminArea`, `lat`/`lng`, `localityType`; no timezone, parents
  or kind.

## Flow

```
social Community rows ──TCP sync──▶ civic-briefing `localities` (+ `sources`,
                                    `sourcing_decisions`)
                                          │ render
                                          ▼
                              data/generated/localities/*.yaml
                                          │ loadLocalityRegistry (unchanged)
                                          ▼
                              DailySchedule / backfill / health
```

The database is authoritative. The generated directory is disposable: it is
rebuilt on boot and after every sync or adoption, and can be deleted at any
time.

## Slices

Each slice is delegated to a Sonnet agent with owned files, a test command
and a stop condition. At most two run at once.

### S1 Schema (wave 1)

- Add to `localities`: `communityId` (nullable, unique), `active`,
  `syncedAt`, and JSON columns for `topics`, `cadence`, `websites`, so a row
  carries everything the YAML needs.
- Add to `sources`: `origin` (`discovered` | `override`).
- New table `sourcing_decisions` (slug, sourceKey, url, decision, reason,
  evidence JSON, decidedAt) replacing `decisions.jsonl`.
- Migration generated with `migration:generate`, never hand-written.
- Tests: entity round-trip in `civic-briefing` `test-db`.

### S2 Social sync (wave 2, parallel with S3)

- `SocialLocalityClient` (ClientProxy, TCP, `SOCIAL_HOST`/`SOCIAL_PORT`),
  modelled on `TcpCivicCoreClient`: timeout, tolerant replies.
- Pure mapper `communityToLocality(community)`:
  - slug = `localitySlug ?? slug`, which already carries the state, so
    Nashville GA and Nashville TN stay distinct.
  - timezone from lat/lon via a small offline lookup (an existing dependency
    if one is present; otherwise one vetted package).
  - parents = the state root; the sync creates state roots and the `US` root
    as needed.
  - kind from `localityType`; topics and cadence from config defaults;
    `edition: true`.
- `LocalitySync` upserts by `communityId`/slug. Communities that disappear
  are set `active = false`, never deleted.
- Runs at boot and every `LOCALITY_SYNC_INTERVAL_MS` (default 1h).
- Tests: mapper unit specs (same-name towns, missing lat/lon, odd
  `adminArea`); sync `test-db` spec with a fake client.

### S3 YAML builder (wave 2, parallel with S2)

- `renderLocalityRegistry(rows, sources)` in civic-core: pure function from
  DB rows to the YAML documents `loadLocalityConfig` accepts (one file per
  state, or per town; whichever the loader handles most simply).
- `writeLocalityRegistry(dir, docs)`: writes to a temp dir, then swaps it in
  atomically, so a reader never sees half a registry.
- A row that would fail `validateLocalityGraph` is logged and left out, so
  one bad town cannot take down the registry.
- Tests: render → load round trip; a bad row is excluded; the output
  validates for a 425-town sample built from `seed-cities.json`.

### S4 Discovery state into the DB (wave 3)

- `DailySchedule.adopt` writes adopted sources (`origin: discovered`) and
  decisions to the DB, then re-renders the YAML and reloads the registry.
- `sourcingDue`/`lastSearched` reads `sourcing_decisions`.
- Remove the `CIVIC_DISCOVERED_SOURCES`, `SOURCING_LOG` and `mergeDiscovered`
  file paths. Keep the `SOURCING_DIRECTORIES` cache only if it is a pure
  cache.

### S5 Switch consumers and remove the mount (wave 4)

- `buildSchedule` runs sync → render → load at boot; it starts whenever
  `DAYLIGHT_SCHEDULE_ENABLED` is true (default true in dev, false in e2e).
  `CIVIC_LOCALITIES_DIR` becomes an internal default
  (`data/generated/localities`), not deployment config.
- `BackfillService`, `PipelineHealthService` and the CLI read the generated
  registry through one shared provider instead of loading it themselves.
- `civic-contributions` runs in another container, so it cannot read the
  generated dir. civic-briefing exposes `LIST_LOCALITIES` over TCP and
  contributions calls that. Check its usage first; if it needs only slugs and
  names, this is small.
- Remove the locality mounts and `CIVIC_LOCALITIES_DIR` from
  `docker-compose.dev.yaml`, `docker-compose.yaml`, the e2e stack, k8s
  `kustomization.yaml` and `civic-briefing.yaml`. Add `SOCIAL_HOST`/`PORT`
  and the new env vars. Confirm the Dockerfile copies no locality YAML.
- e2e: `civic-briefing-seed` stops mounting the fixtures dir. The fixture
  briefings it seeds must key to towns that exist in the e2e social seed
  (`SEED_LOCALITY_SLUGS`).

### S6 Throughput for all towns (wave 4, same agent as S5)

- `tick()` orders due towns least recently run first, and processes at most
  `PIPELINE_MAX_TOWNS_PER_TICK` with `PIPELINE_CONCURRENCY` (default 1), so
  425 towns can't starve each other or overrun a tick.
- Discovery for towns without sources is staggered (per-tick cap), so the
  first boot doesn't trigger 425 crawls at once.
- `DailySchedule` gets its first spec with a fake registry, clock and runner.

#### S5/S6 environment (civic-briefing)

All optional. Compose and k8s wire these (not `CIVIC_LOCALITIES_DIR`, which
civic-briefing no longer reads). The generated registry directory is internal:
`<data dir>/generated/localities`, derived from `PIPELINE_ARTIFACTS`
(`data/live/out` becomes `data/generated/localities`), so the data volume that
holds `PIPELINE_ARTIFACTS` must be writable and persistent for it.

| Variable                      | Default       | Meaning                                                                                                                                                                                    |
| ----------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DAYLIGHT_SCHEDULE_ENABLED`   | `true`        | Kill switch. `false`/`0`/`no`/`off`: no ticks, no pipeline runs, no alert emails. The registry sync and `LIST_LOCALITIES` still run; an operator's backfill still works. e2e sets `false`. |
| `LOCALITY_SYNC_INTERVAL_MS`   | `3600000`     | How often sync, render and load repeat (also once at boot).                                                                                                                                |
| `PIPELINE_MAX_TOWNS_PER_TICK` | `6`           | Most towns one tick runs, least recently published first.                                                                                                                                  |
| `PIPELINE_CONCURRENCY`        | `1`           | Towns run at once within a tick. Leases are per town, so >1 is safe at the runner; see the S6 note.                                                                                        |
| `SOURCING_MAX_PER_TICK`       | `2`           | Most towns one tick starts source discovery for.                                                                                                                                           |
| `SOCIAL_HOST`                 | `social`      | Social's TCP host (S2).                                                                                                                                                                    |
| `SOCIAL_PORT`                 | `3003`        | Social's TCP port (S2).                                                                                                                                                                    |
| `LOCALITY_SYNC_APP_SCOPE`     | `local-hub`   | appScope the sync lists communities under (S2).                                                                                                                                            |
| `LOCALITY_DEFAULT_TOPICS`     | built-in list | Comma-separated topics given to a new town (S2).                                                                                                                                           |
| `LOCALITY_DEFAULT_CADENCE`    | built-in list | Comma-separated cadences given to a new town (S2).                                                                                                                                         |

Existing and unchanged: `PIPELINE_TICK_MS` (10 min), `PIPELINE_ARTIFACTS`.

### S7 Verification (wave 5)

- `nx test` + `test-db` for civic-core, civic-briefing and social;
  `nx lint`/`typecheck` for touched projects.
- Dev stack from scratch (DB rebuilt): run the seeds; civic-briefing logs a
  sync of about 425 localities and renders a registry that validates; one GA
  town and one non-GA town complete a pipeline run. No YAML is mounted, and
  the image has none.
- Affected local e2e suites pass before any push. The PR is opened, not
  merged.

### Phase 3 (S4 ∥ S4b)

- S4 as above.
- S4b: the D30 columns and migration, the renderer emitting them, the
  sync deriving exclude phrases, and the D26 edition rule.

## Risks

- **GA towns lose their hand-curated sources.** Adel, Tifton and Nashville
  now start empty, like every other town, and rely on discovery. The P1.7
  benchmark found 6 of 16 sources blind, so their first briefings will be
  thinner than the POC's.
- **Cost.** D26 means hundreds of pipelines per week. S6 limits the rate;
  `DAYLIGHT_SCHEDULE_ENABLED=false` stops it outright.
- **Slug drift.** If a community's `localitySlug` is set later, the row keyed
  by `communityId` would change slug, and downstream rows (`civic_items`,
  `briefings`) would need re-keying. S2 refuses the change and logs it;
  renaming is a follow-up.

## Handoff log

- 2026-11-04: Plan and D25–D29 recorded. The owner rejected importing the POC
  YAML or shipping YAML in the image; the YAML is generated from the DB.
  Next: S1.
- 2026-11-04 S1 done: generated migration 1793805980810-DaylightDbLocalities (localities: communityId uuid unique, active, syncedAt timestamptz, topics/cadence/websites text JSON; sources.origin varchar null; new sourcing_decisions with slug+decidedAt index); schema in libs/civic/core/src/schema.ts and apps/civic-briefing/src/app/schedule/sourcing-decision.schema.ts; spec sourcing-decision.db.spec.ts. Left out: broad, excludePhrases, officials (optional in LocalityConfig, no column). Typecheck, lint, test and test-db pass.
- 2026-11-04 S3 done: libs/civic/core/src/registry-render.ts (`renderLocalityRegistry(localities, sources)` -> `{files, excluded}`, `writeLocalityRegistry(dir, files)`), exported from the index; test registry-render.test.ts. Layout is one file per locality, `<state lowercase>/<slug>.yaml`. Bad rows, inactive localities and disabled sources are excluded with reasons, transitively for children and owned sources. `broad` is derived from kind (country/state/region/planning-region); `excludePhrases` and `officials` cannot be represented. Test, lint and typecheck pass.
- 2026-11-04 S2 done: apps/civic-briefing/src/app/locality-sync/ (SocialLocalityClient: LIST_LOCALITY_COMMUNITIES with {appScope:'local-hub'}, no localityType, SOCIAL_HOST/PORT default social:3003; communityToLocality; LocalitySyncService.sync()/start(); LocalitySyncModule not imported by the app). State roots are slugged by full name (georgia, district-of-columbia) under `us`; roots are created once and never updated; topics/cadence fill only when null. Root rows carry no `broad` (no column): S3 should derive broad from kind country/state/region. Added @photostructure/tz-lookup. Tests, test-db, lint and typecheck pass. Next: S3/S4/S5 wiring (call start() from the schedule boot).
- 2026-11-04 S4 done: apps/civic-briefing/src/app/schedule/sourcing-store.ts (SourcingStore: adopt(decision, configured) writes sources origin 'discovered', skipping any existing key and any address held by a non-discovered row or the configured registry; recordDecision, recordSearch, lastSearched = max localDate of 'searched' rows). DailySchedule uses it; file paths CIVIC_DISCOVERED_SOURCES, SOURCING_LOG, mergeDiscovered, discoveredSourcesPath removed; loadLocalityRegistry(dir) now one parameter. SOURCING_DIRECTORIES kept (regenerable cache). Hook for S5: DailySchedule.refreshRegistry() (currently reloads the YAML dir; point it at sync, render, load). Spec sourcing-store.db.spec.ts.
- 2026-11-04 S4b done: D30 columns `excludePhrases`/`officials` (text JSON) with generated migration 1793808213553-DaylightLocalityDisambiguation; renderer emits both; mapper edition rule (city/town only, 262 editions) and derived exclude phrases (batch peers + bundled notable-places.json, top 1000 US places, Census PEP vintage 2025, generator tools/civic/notable-places.mjs), written only while the column is null. Open: schedule/sourcing-decision.db.spec.ts (S4) must add the new migration to its migrations list or it reports drift.
- 2026-11-04: Phase 3 integration check (orchestrator). Added the
  disambiguation migration to the S4 db specs, and the mapper now strips a
  trailing state from social names ("Nashville, GA" → "Nashville") so
  mention matching works as with the fixtures. civic-core, civic-adapters,
  civic-briefing unit and db tests, lint and typecheck pass. Next: S5 + S6.
- 2026-11-04 S5 part B done: LIST_LOCALITIES (CivicBriefingCommands, registry/localities.controller + LocalitiesModule in app.module); civic-contributions LocalitiesService fetches over TCP at boot, refreshes every 15 min (retries every 10s until first load, keeps last good); locality mounts and CIVIC_LOCALITIES_DIR removed from dev/prod/e2e compose and k8s; seed-e2e.ts now syncs from social via LocalitySyncModule instead of reading YAML; e2e civic-briefing waits for social-locality-seed. Not run: contributions test-db (no Postgres), e2e stack.
- 2026-11-04 S5+S6 done (phase 4 part A): `DbLocalityRegistrySource` + global `RegistryModule` (registry/); refresh = sync (a social failure logs a warning and the DB is used) → render → write `<data>/generated/localities` → load, with one retry on ENOENT for another writer's rename gap; empty registry until the first load. One timer (`start(LOCALITY_SYNC_INTERVAL_MS)` in main, runs even when `DAYLIGHT_SCHEDULE_ENABLED=false`). DailySchedule, PipelineHealthService and the CLI one-shots read the source; `CIVIC_LOCALITIES_DIR` removed from civic-briefing config (seed-e2e is B's). tick(): least recently published first, `PIPELINE_MAX_TOWNS_PER_TICK` (12), `PIPELINE_CONCURRENCY` (1), `SOURCING_MAX_PER_TICK` (2; new towns wait for a slot). Specs: daily.spec.ts, db-locality-registry.source.db.spec.ts. Test, test-db, lint, build, tsc and a boot smoke test (social down, schedule off) pass.
- 2026-11-04: Phase 4 verified together (orchestrator). The shared contract
  `LocalityRegistrySource.refresh({ sync? })` is in place, and adoption
  refreshes skip the social sync. Passing: unit tests (civic-core 238,
  adapters 123, briefing 72, contributions 34), db tests (88/40/54), lint,
  typecheck, builds, compose config, kustomize. Nothing is committed (branch
  t3/b194b836).
  **Handoff for S7:** start a fresh session. Rebuild the dev stack DB from
  scratch (no deployed clients), using `BUILDX_BUILDER=ot-hostnet` for
  images. Run the seeds, then confirm civic-briefing logs about 425 synced
  and 262 editions, the registry renders with 0 excluded, and contributions
  gets `LIST_LOCALITIES`. Run one GA town and one non-GA town through a full
  pipeline (CLI `run <slug>`) and record run time, to tune
  `PIPELINE_MAX_TOWNS_PER_TICK`. Check that the k8s PVC covers
  `data/generated`. Then run the affected local e2e suites (local-hub /
  civic) and open a PR. Don't merge it. Owner wants an HTML report at the
  end of each phase.
- 2026-11-04 S7 verification done (not committed): images build (no locality YAML; only assets/config.yaml), isolated stack (db-setup applies both migrations; full 425-community seed) logs 425 created, 443 localities (18 state/country roots), 262 editions, nothing excluded; contributions loads 443 over LIST_LOCALITIES; restart with social stopped warns and serves the registry from the DB; k8s PVC at /usr/src/app/data covers data/generated. CLI one-shot: `run` needs sources, so `source` first (asheville-nc: source 92s, 1 adopted, run 69s, briefing; tifton-ga: source 309s, 3 adopted/11 refused, run 52s, briefing; adel-ga: source 132s, 0 adopted, run fails "no enabled sources"). Recommend PIPELINE_MAX_TOWNS_PER_TICK=6 at the 10-minute tick. local-hub-e2e passes (60). Fixes: seed-e2e.ts exits explicitly (the social TCP client kept the one-shot alive); e2e manifest runs social-locality-seed before the dependencies phase (briefing's boot sync saw no towns); removed the civic-briefing depends_on I had added to e2e civic-contributions (it made the copying corpus available, but daylight.spec.ts expects the held outcome). Pre-existing: run-ci-e2e-locally.sh cannot build local-hub-e2e (client-interface is profile-gated away from the local-hub profile).
- 2026-11-04 Orchestrator: PIPELINE_MAX_TOWNS_PER_TICK default lowered 12 → 6 from the S7 timings (≈1 min per run + 2–5 min per sourcing, 2 sourcings per tick, 10-minute tick).

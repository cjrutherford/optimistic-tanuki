# Daylight into Towne Square — upstream integration plan

Date: 2026-09-30. Source: `~/workspace/daylight-poc`, whose plan
`docs/plans/2026-09-27-local-hub-integration-plan.md` is the backbone. This
file records the owner's decisions and the changes made to that plan, because
the work now starts here rather than in the POC.

Branch: all slices land on `t3code/71edc403`, and one PR goes to `main` at
the end. Before that PR, rebase onto `main` once PR #271 (the CI/SSR fix) has
merged. Re-check PR #186 (`metro-cast`) before Phase 5; it rewrites the
local-hub city, cities, landing and community pages and adds
locality-discovery services.

## Decisions (owner, 2026-09-30)

- **D1** A separate `apps/civic-briefing` service sits beside `apps/civic`,
  which stays untouched. Converging the two is covered by an ADR later.
- **D2** Libs are nested under `libs/civic/` (`core`, `llm`, `adapters`,
  `community`, `access`, `briefing-data-access`, `briefing-ui`) and imported as
  `@optimistic-tanuki/civic-*`. The apps are `civic-briefing` and
  `civic-contributions`, with tokens `CIVIC_BRIEFING_SERVICE` and
  `CIVIC_CONTRIBUTIONS_SERVICE` and databases `ot_civic_briefing` and
  `ot_civic_contributions`.
- **D3** Tests are converted from `node:test` to Jest in the same slice that
  ports the lib. Large libs (`civic-core`, 65 test files) are split across
  sessions.
- **D4** A Briefing section on `city/:slug`, plus `city/:slug/briefing` and
  `city/:slug/briefing/:date`. A city is a social `Community`, so the mapping
  is a `localitySlug` column on the community entity, added by a _generated_
  social migration.
- **D5** Model calls are routed through upstream's prompt-proxy / AI
  orchestration now, not through the POC's own Ollama client. This needs a
  research slice first (does prompt-proxy record provenance? is it reachable
  from a batch worker?) and must keep the replay parity gate green.
- **D6** No data carry-over. Beta testers re-register, and the pipeline
  rebuilds history. POC slices S1.4, S1.5 and S7.1 are dropped.
- **D7** The POC is closed. Its concept is proven and it gets no further
  changes. Its corpora and `golden/baseline.json` are read in place,
  read-only, by the parity gate (see P0.1).
- **D8** Superseded by the branch line above.
- **D17** `packages/nestjs` is dropped. It's unused, and folding it into
  core would make core and llm import each other. civic-briefing gets its
  own scheduling in P2.1.
- **D18** Database tests run under a separate `test-db` target that needs
  `CIVIC_TEST_DATABASE_URL`; `nx test civic-core` needs no infrastructure. The
  POC's current localities YAML is frozen as the test fixture
  `libs/civic/core/test/fixtures/localities`.
- **D16** civic-core is Postgres only. SQLite and `better-sqlite3` are
  removed, and tests and parity replays need a Postgres database.

## Facts checked in this repo (HEAD 620703c0)

- `apps/civic`: `DatabaseModule.register({ name: 'civic' })`, `ot_civic`, two
  migrations, entities `CivicAgenda`, `CivicAgendaItem`, `TipProject`,
  `EmergencyBroadcast`. Its gateway controller is `controllers/civic`.
- local-hub is server-rendered (SSR). City DTO = `CommunityDto`
  (`libs/models/src/lib/libs/social/community.dto.ts`).
- No lib runs `node:test`. Libs use `@nx/jest:jest`.
- Root `package.json` has `dompurify` and `jsdom`. It lacks `pdfjs-dist`,
  `cheerio`, `linkedom`, `@mozilla/readability`, `yaml` and `tsx`. Avoid
  `better-sqlite3` once on Postgres.
- `tsconfig.base.json`: `module: esnext`, `moduleResolution: node`. The POC
  uses ESM `.js` relative specifiers, so Jest needs a `moduleNameMapper`.

## Slices (in order)

Each slice fits one session, commits at its checkpoints, and ticks the log.
Mechanical copy and import rewrites go to a Sonnet subagent; review and
fixes stay with the lead agent.

- [x] P0.1 Port `tools/golden.ts` into this repo as a parity tool. It reads
      the corpora and `golden/baseline.json` from the POC checkout, read-only,
      through a path env var (`DAYLIGHT_POC_DIR`), and replays them through
      `civic-briefing`. If the POC checkout is missing, it skips with a
      clear message. The 370 MB of data stays out of git, so the gate runs
      only on a machine that has the POC checkout.
- [x] P0.2 Measure drift: the POC's vendored code (reference `7e1d8740`)
      against current libs here (auth, database, storage, permissions,
      profile)
- [x] P1.1 `libs/civic/core`: copy and typecheck, Postgres only (D16).
      Whether `packages/nestjs` is ported is still open; see the handoff note.
- [x] P1.2 `libs/civic/core`: the 36 tests without a database, converted to Jest
- [ ] P1.3 `libs/civic/core`: the 17 database tests in `test/db/` under a
      `test-db` target (`CIVIC_TEST_DATABASE_URL`, fresh schema per test), plus
      fixing the known Postgres SQL bugs (see the P1.1 handoff)
- [ ] P1.4 `libs/civic/llm` (+ Jest)
- [ ] P1.5 `libs/civic/adapters` (+ Jest, deps, licence check; also takes
      core's `http-client.test.ts`, which imports all nine adapters)
- [ ] P1.6 `libs/civic/community`, `libs/civic/access` (+ Jest; roles
      against `permission-lib`)
- [ ] P2.0 Research: the prompt-proxy path for D5 (no code, a short note)
- [ ] P2.1 `apps/civic-briefing`: Nest app, config, `DatabaseModule`, token,
      compose, Dockerfile
- [ ] P2.2 `apps/civic-briefing`: generated initial migration, including the
      append-only triggers (POC S1.1)
- [ ] P2.3 `apps/civic-briefing`: model access via prompt-proxy (D5)
- [ ] P2.4 Replay parity gate: 38/38 golden artifacts identical. Nothing
      after this proceeds on red.
- [ ] P2.5 `apps/civic-contributions` (real storage/encryption/email libs,
      ClamAV; needs `VAULT_STORAGE_KEK` and `CLAMAV_HOST`, see drift note)
- [ ] P2.6 ADR: converging with `apps/civic`
- [ ] P2.7 Source discovery: see "Source discovery strategy" (P1.7, SD.0–SD.7)
- [ ] P3.1 Gateway briefing routes
- [ ] P3.2 Gateway contribution and profile routes, permissions seeding
- [ ] P3.3 File the eight open security findings (the stub virus scanner is
      already fixed upstream) as issues (owner approves before
      anything is posted)
- [ ] P4.0 Rebase on main (#271; re-check #186)
- [ ] P4.1 `libs/civic/briefing-data-access`
- [ ] P4.2 `libs/civic/briefing-ui` (SSR-safe DOMPurify)
- [ ] P4.3 `localitySlug` on community (generated migration) + Briefing on
      city page
- [ ] P4.4 Contributor pages (report, watch, contributor, operations)
- [ ] P4.5 SSR + local-hub-e2e: city → briefing → report
- [ ] P5.1 Local-hub profile on upstream sign-in
- [ ] P5.2 Model host config and alerts
- [ ] P5.3 Open the PR to main (owner merges)

## Source discovery strategy (owner, 2026-09-30)

**The problem.** Each town has its own mix of sources, and each source has
its own quirks: unusual date formats, Word files instead of PDFs, index pages
nested two levels deep, places with the same name (Nashville TN vs GA), news
sites that block crawlers, county pages that stopped updating. Of the POC's
25 enabled sources, about 11 sit on standard platforms and about 14 are
bespoke (a hand-written `linkPattern` or a particular publisher's feed).

**What exists.** The POC's `packages/core/src/sourcing.ts` already finds
sources:

- It starts from official directories (the .gov list, Wikidata P856), the
  town's own, county and school-district sites, existing sources, and
  SearXNG.
- It crawls same-site links two levels deep, up to 150 pages, honouring
  robots.txt.
- `detect.ts` recognises Legistar, Granicus, CivicClerk, CivicPlus and
  Apptegy pages.
- Every candidate is trial-read by its real adapter, and adopted only if it
  yields dated items from the last 180 days. Rejected candidates are kept
  with reasons.

It has barely been exercised; the only saved output is Tifton's, with 3
boards. Three things are still decided by a person: the place graph
(`parents:`), the settings for bespoke scrapes, and news/legal notices
(Google News discovery has been off since its robots.txt blocked it). This
repo has no source discovery. `apps/civic`'s `agenda-source-discovery.ts`
parses configured index pages, and #186's "locality discovery" finds nearby
communities and businesses, not sources.

**Decisions.**

- **D9 Full automation.** Every candidate that passes the trial read is
  adopted without review. Operators act afterwards, through overrides in the
  admin UI: block a source or domain, pin a source, or edit its config.
  Overrides always win over discovery.
- **D10 Configuration lives in the database** (`ot_civic_briefing`): places,
  the place graph, sources, overrides and an audit log of discovery
  decisions with their evidence. The POC's YAML localities are imported once
  as a seed and are not read at runtime.
- **D11 Bad sources retire themselves.** A source is disabled automatically
  after 3 failing days, or after 45 days of answering without publishing
  anything new. Retiring a source triggers an immediate rediscovery run for
  its town. Both steps are logged and can be reversed. Health must first
  learn to tell "quiet" apart from "fresh"; today a source that keeps
  answering with nothing new counts as fresh.
- **D12 Search is a self-hosted SearXNG compose service**, the same setup
  the POC deploys.
- **D13 Publishers that block AI crawlers are auto-adopted as
  snippet-only** (headline and link, no full text). robots.txt is still
  honoured.
- **D14 The admin UI goes in `owner-console`.**
- **D15 Four new discovery channels are in scope.** Each is its own slice:
  1. A Census place spine, so counties and school districts are derived
     rather than hand-written.
  2. Probing for Legistar and CivicClerk tenants through their public APIs.
  3. County legal-organ newspapers, RSS autodiscovery and state
     public-notice sites.
  4. Scrape settings proposed by a model through prompt-proxy, adopted only
     if the trial read passes.

**Risks that full automation makes sharper:**

- **A same-name town gets adopted.** Mitigation: place-name and state checks
  on every candidate, and the Census FIPS IDs.
- **A model-proposed config passes the trial read but reads the wrong
  documents.** Mitigation: the trial read requires that the town is mentioned
  and the dates are plausible, and every adoption is logged with sample items.
- **Public-notice sites have no API.** Their terms must be checked before
  SD.3 builds on them.
- **Vendor portals may have terms of their own.** Prefer a vendor's public
  API to scraping its HTML.

**Discovery slices.** These come after the parity gate, because discovery
must not change the replayed corpora.

- [ ] P1.7 Benchmark: run the ported `discoverSources` against the 5 edition
      towns and their parent places. Measure recall and precision against
      the hand-written YAML, and list what it missed by quirk category. The
      results may reorder SD.1–SD.5. (Needs P1.5.)
- [ ] SD.0 Move sources and the place graph into the database (D10): the
      entities, a generated migration, a one-time YAML seed import, and the
      registry reading from the database. The audit log of discovery
      decisions goes in here too.
- [ ] SD.1 Census place spine. Import Census Government Units, give
      `Community` FIPS and GNIS IDs (a generated social migration; consider
      combining it with P4.3's `localitySlug`), and derive each town's parent
      places.
- [ ] SD.2 Platform tenant probing: Legistar `webapi.legistar.com/v1/{client}`
      and CivicClerk `{tenant}.api.civicclerk.com`, checking each hit
      against the town's name and state.
- [ ] SD.3 Legal organs and notices: state press-association lists (GA
      `LegalOrganList.pdf`, FL, CT), RSS autodiscovery, and the public-notice
      sites, once their terms have been checked.
- [ ] SD.4 Model-proposed scrape config through prompt-proxy, adopted only
      if the trial read passes. (Needs P2.3.)
- [ ] SD.5 Automation: auto-adoption including snippet-only publishers,
      quiet-source detection, auto-retire and rediscovery (D9, D11, D13).
- [ ] SD.6 Sources admin in `owner-console`: the decision log, overrides and
      health (D14).
- [ ] SD.7 SearXNG compose service (D12). Can be done any time before SD.5.

## Handoff log

- 2026-09-30: Plan and decisions recorded. Nothing ported yet. The POC is
  closed; the parity gate reads its data in place. Next: P0.1.
- 2026-09-30: Source discovery strategy decided (D9–D15). The POC's existing
  `sourcing.ts` is the base; the benchmark comes after civic-core is ported
  (P1.7).
- 2026-09-30: P0.1 is done. `tools/civic-parity/` (`pnpm civic:parity
[--require]`, Jest via `jest -c tools/civic-parity/jest.config.cjs`) reads
  `DAYLIGHT_POC_DIR` read-only and writes to `tmp/civic-parity`. Its hashing
  reproduces the POC's existing replay output: 38 of 38 artifacts, 0
  differences. The replay entry that P2.4 must build is
  `dist/apps/civic-briefing/replay.js` (override with `CIVIC_PARITY_REPLAY`).
  It must accept the POC replay's arguments: `--corpus --towns --from --to
--backfill-days 120 --database --artifacts --localities`, and write
  `briefings/` and `stories/` markdown. The database defaults to SQLite per
  corpus; set `CIVIC_PARITY_DATABASE_URL` with `{corpus}` for Postgres.
  Replay uses `replaySummarizer` (no model), so D5 does not touch parity. Its
  tests are not in CI yet. Next: P0.2 (vendored-code drift).
- 2026-09-30: P0.2 is done. See `2026-09-30-daylight-upstream-drift.md`. Of
  the 431 vendored files, 344 are unchanged. The pipeline libs import no
  vendored code, so drift can't affect P1.x or the parity gate. Real drift
  is in storage (envelope encryption, a ClamAV scanner that fails closed),
  which affects P2.5. Next: P1.1 (`libs/civic/core` copy and build).
- 2026-09-30: P1.1 is done. `libs/civic/core` (project `civic-core`, import
  `@optimistic-tanuki/civic-core`) typechecks via `nx typecheck civic-core`.
  The owner chose Postgres only (D16): the SQLite branches are collapsed to
  their Postgres forms, verbatim, and the parity tool now needs
  `CIVIC_PARITY_DATABASE_URL` with `{corpus}`.
  **Known Postgres bugs for P1.3**, never exercised in the POC:
  1. `runner.ts`'s raw SQL uses unquoted camelCase columns (`scopeSlug`,
     `completedAt`, `runId`, …), which Postgres folds to lowercase while
     TypeORM creates quoted columns.
  2. `recoverExpired`'s `UPDATE pipeline_runs` has 2 placeholders but is
     passed 3 parameters.
  3. The lease `INSERT` passes 7 parameters for 6 placeholders.
  4. The takeover's `result.affected ?? result.changes` may always be 0 on
     Postgres.
     **Parity risk:** the POC recorded its baseline on SQLite, so row-ordering
     differences on Postgres may show up at P2.4 as decisions to explain.
     `createFoundationDataSource` still calls `synchronize()` on an empty
     database until P2.2's generated migration.
     **Open, for the owner:** `packages/nestjs` (a scheduling `PipelineService`)
     is imported by no POC app, only by its own test. It depends on
     `@civic/llm`, so folding it into civic-core as the POC plan suggested
     would create a core↔llm cycle. Tests (54 files, plus fixtures and helpers)
     are not copied yet; they come with P1.2. Next: P1.2.
- 2026-09-30: P1.2 is done. 36 test files are now Jest suites:
  `nx test civic-core` gives 36 suites and 225 tests passing, and
  `nx typecheck civic-core` checks the lib and spec tsconfigs. The 633
  `node:assert` calls became `expect` through a TypeScript AST codemod;
  `node:assert/strict` deep equality fails across Jest's VM realms, so this
  was required, not cosmetic. A mutation check confirmed the converted tests
  still fail on a regression. The ESM-only linkedom dependencies are
  transformed via `transformIgnorePatterns`. The negative type fixture
  `test/fixtures/types/invalid-fetch-result.ts` keeps `// prettier-ignore`
  so each `@ts-expect-error` stays on its line. One POC test was stale (it
  expected Adel not to be an edition, contrary to POC b8343a7) and was
  updated. Next: P1.3, which needs a Postgres instance (the compose
  `postgres` service).

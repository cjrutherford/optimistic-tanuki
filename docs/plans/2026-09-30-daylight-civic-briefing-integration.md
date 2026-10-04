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

## Status (2026-10-01)

**Phase 0 and Phase 1:** done, P0.1–P1.7. Next is Phase 2.

| Slice     | What                                        | Commits                     |
| --------- | ------------------------------------------- | --------------------------- |
| P0.1      | Replay parity tool, `tools/civic-parity`    | f0264f56                    |
| P0.2      | Upstream drift note                         | bcf0ff6d                    |
| P1.1–P1.3 | `libs/civic/core`, Postgres only, all tests | 36a377a4…80cf2700, 25df7ba4 |
| P1.4      | `libs/civic/llm`                            | ccce3be4, cc9d7dc0          |
| P1.5      | `libs/civic/adapters`                       | 90999a48, 79b0569e          |
| P1.6      | `libs/civic/community`, `libs/civic/access` | e592ea0c, 991bd809          |

**Tests** (`nx run-many -t typecheck test test-db -p civic-core civic-llm
civic-adapters civic-community civic-access`; `test-db` needs
`CIVIC_TEST_DATABASE_URL`):

| Lib             | `test` | `test-db`                      |
| --------------- | ------ | ------------------------------ |
| civic-core      | 225    | 87 + 1 todo (SQLite-only lock) |
| civic-llm       | 170    | 29                             |
| civic-adapters  | 81     | 31                             |
| civic-community | 61     | —                              |
| civic-access    | 7      | —                              |

All 54 POC core tests are ported.

**Branch:** rebased onto `main` on 2026-10-01, after PR #271 merged. The
hashes above are post-rebase. Re-check PR #186 (still open) before Phase 4;
a final rebase comes before the PR (P4.0).

**Next:** Phase 2, the civic-briefing service and the parity gate. The
discovery work (SD.\*) waits on the owner's choices from the benchmark.

**Waiting on the owner:**

- **CI.** The civic `test-db` targets and the `tools/civic-parity` tests are
  not in CI yet. CI has no Postgres service, and adding one changes the
  workflow.
- **Not started:** the parity gate (P2.4) can't run until civic-briefing
  exists.

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
- **D19** Civic roles are merged into local-hub's existing roles.
  `local_hub_member` gains reading, contributing and corroborating;
  `local_hub_admin` gains the operator permissions (review decisions, account
  suspension, town configuration, density); `local_hub_verified_official` is
  the one new role. Permission names follow the seed's `resource.action`
  convention.
- **D20** A verified official never corroborates, even though members can.
  Role grants are additive, so civic-access declares this in `ROLE_DENIALS`
  and civic-contributions enforces it through `effectivePermissions`.
- **D21** Search is off by default (it supersedes D12). SearXNG's
  challenge-free engines are unusable: DuckDuckGo answers with a CAPTCHA, and
  Mojeek is inactive in SearXNG because of a proof-of-work CAPTCHA, which the
  POC's config never actually enabled. Discovery uses the directories, the
  crawl and the new channels. Search stays pluggable through
  `SEARCH_PROVIDER`. SD.7 is dropped.
- **D22** Every document fetched from an outside source is virus-scanned
  before it is stored or parsed: PDFs, Word files and email attachments,
  not just contributor uploads. This is the owner's rule as of 2026-10-02.
  The scan uses the platform's fail-closed ClamAV `VirusScanService`. An
  infected file is quarantined and never parsed; when the scanner is
  unavailable the fetch fails and is retried, rather than being read
  unscanned.
- **D23** D20 fails closed: `Actor` (civic-community) carries `roles`, and
  a corroboration without them is refused. The gateway (P3.2) must always
  send the account's local-hub roles.
- **D24** The POC's operator CLI is dropped. Operator actions (official
  verification, suspension, sweeps) are manual triggers through gateway
  API routes, used from the admin UI (P3.2, SD.6).
- **D25** Civic Core (`apps/civic`) is a first-party source for
  civic-briefing over TCP. Its broadcasts appear as alerts and its TIP
  projects as stories. A tenant is matched to a town by name and state
  (the owner's choice), with safeguards. See
  `docs/architecture/civic-briefing-and-civic-core.md`.
- **D26** Operator triggers are guarded by three admin permissions:
  `official.verify`, `takedown.manage` and `community.maintain`. "My
  contributions" requires `contribution.read`. A counter-notice stays open
  to any signed-in contributor, since it's a legal response right. The
  official-callback route takes a userId; the admin UI picks the
  applicant. `CIVIC_FINGERPRINT_KEY` is in the gateway's compose env.
- **D27** (owner, 2026-10-04) Becoming a Daylight contributor is an
  explicit opt-in. Signing up for local-hub doesn't make anyone a
  contributor. A signed-in user signs up from the UI: one page of
  contributor terms (the watcher page's "what you should know") and an
  "I agree" checkbox. The account's email must be verified first. Sign-up
  grants a new role, `local_hub_contributor`, which carries the
  contribution permissions; `local_hub_member` loses the contribution
  grants D19 gave it. This replaces the POC rule that verifying an email
  made you a contributor.
- **D28** (owner, 2026-10-04) P4.5's e2e runs in the shared CI stack.
  `local-hub-e2e` joins the manifest, and its older suites are repaired as
  needed. Model review in e2e answers from a deterministic stub, and
  briefings come from an e2e seed written through civic-briefing's
  entities.
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
- [x] P1.3 `libs/civic/core`: 13 database test files in `test/db/` under the
      `test-db` target, plus fixes to the Postgres SQL
- [x] P1.4 `libs/civic/llm` (+ Jest), including core's two llm-dependent
      database tests
- [x] P1.5 `libs/civic/adapters`: nine adapters as folders of one lib, plus
      core's three adapter-dependent tests
- [x] P1.6 `libs/civic/community`, `libs/civic/access` (roles reconciled
      with the permissions seed; D19, D20)
- [x] P2.0 Research: the prompt-proxy path for D5. See
      `2026-10-02-p2.0-prompt-proxy-note.md`: yes, via an injected `fetchImpl`
      that forwards the native Ollama body over TCP; civic-llm is unchanged
- [x] P2.1 `apps/civic-briefing`: Nest TCP service on 3028, `DatabaseModule`,
      `CIVIC_BRIEFING_SERVICE` + gateway client, compose, Dockerfile (poppler,
      tesseract), ported stage modules and daily schedule
- [x] P2.2 `apps/civic-briefing`: generated initial migration
      (`1790940573082-foundation`), plus the append-only triggers and the
      schema version row
- [x] P2.3 `apps/civic-briefing`: model access via prompt-proxy (D5),
      `LLM_TRANSPORT=prompt-proxy` by default
- [x] P2.4 Replay parity gate: **38/38 golden artifacts identical**
      (2026-10-02, on Postgres through civic-briefing's ported stages)
- [x] P2.4a Audit of unordered repository reads: 11 reads that reach
      output now order by `id` (insertion order, as SQLite gave); the gate
      is still 38/38
- [x] P2.5a civic-briefing serves read-only corpus views over TCP
      (`CivicBriefingCommands`: news for the copying index, subjects,
      topic-for, records-since), so civic-contributions owns no copy of the
      foundation database (owner's choice)
- [x] P2.5b `apps/civic-contributions`: TCP service on 3029; corpus from
      civic-briefing over TCP; platform `VirusScanService` and envelope-
      encrypted storage; review model through prompt-proxy; D20 enforced;
      generated migration `1790959295724-contributions`
- [x] P2.5c Scan external documents (D22): a scanning blob store in front of
      every download; civic-briefing's schedule and replay always use it;
      parity runs against the real ClamAV (38/38)
- [x] P2.6 ADR: `docs/architecture/civic-briefing-and-civic-core.md`. Civic
      Core becomes a first-party source; broadcasts become alerts and TIP
      projects become stories; tenants are matched to towns by name and
      state, with safeguards
- [x] P2.6a Civic Core as a source: `civic_tenants` in apps/civic
      (cb27a18e), the `civic-core` adapter and `matchTenants`, and adoption
      during weekly sourcing (96c608f2)
- [ ] P2.7 Source discovery: see "Source discovery strategy" (P1.7, SD.0–SD.7)
- [x] P3.1 Gateway briefing routes: public `GET local-hub/editions`,
      `:slug`, `:slug/briefings/latest`, `:slug/briefings/:periodEnd`
- [x] P3.2 Gateway contribution, official and operator routes (actors carry
      local-hub roles, D23; operator triggers under `local-hub/operations`,
      D24); civic permissions, role and grants seeded with a drift test
- [x] P3.3 Security findings: all 8 re-verified as still present, and filed
      as private draft security advisories (the repository is public); see
      `2026-10-03-security-findings-issues.md`
- [x] P4.0 Rebased on main (2026-10-03, after #269); PR #186 dropped from
      consideration (owner: it will not merge)
- [x] P4.1 `libs/civic/briefing-data-access`
- [x] P4.1b Generate the civic clients with orval (owner)
- [x] P4.2 `libs/civic/briefing-ui` (Angular sanitizer, owner)
- [x] P4.3 `localitySlug` on community (generated migration) + Briefing on
      city page
- [x] P4.4 Contributor pages (report, watch, contributor, operations)
- [ ] P4.5 SSR + local-hub-e2e: city → briefing → report
  - [x] P4.5a Contributor sign-up (D27)
  - [ ] P4.5b Shared e2e stack: civic services, model stub, briefing seed,
        local-hub in the manifest (D28)
  - [ ] P4.5c e2e: city → briefing → become a contributor → report; repair
        the older local-hub-e2e suites
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

- [x] P1.7 Benchmark: see `2026-10-01-daylight-discovery-benchmark.md`.
      Blind recall was 6 of 16 in-scope sources with no wrong adoptions. Two
      bugs were found (B1, B2), and SearXNG's challenge-free engines are
      unusable, so D12 needs a decision.
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
- [ ] ~~SD.7 SearXNG compose service (D12).~~ Dropped by D21.

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
- 2026-10-01: P1.3 is done. `nx run civic-core:test-db` (needs
  `CIVIC_TEST_DATABASE_URL`; locally
  `postgres://postgres:postgres@localhost:5432/civic_test` in the compose `db`
  container) gives 14 suites: 87 tests passing and 1 `it.todo`, the SQLite
  per-file publication lock removed with D16. Each test gets its own schema
  through `search_path`, schemas are dropped per file, and each file runs in
  a temporary working directory so default `./data` output stays out of the
  repo. Postgres fixes in src:
  - quoted camelCase identifiers in the raw SQL in `runner.ts` and
    `story-score.ts`;
  - corrected bind-parameter counts;
  - TypeORM's raw UPDATE and DELETE resolve as `[rows, affectedCount]`.
    Lease recovery read `.length` (always 2), so it failed runs whose lease
    a heartbeat had just renewed;
  - brief-publication rollback reinserts snapshot rows under their original
    ids. TypeORM drops increment ids from Postgres inserts, so the statement
    is written from the metadata and the sequence is reset.
    Fixtures had been reformatted by Prettier in P1.2. They are restored
    verbatim from the POC, and `.prettierignore` now covers
    `libs/civic/core/test/fixtures`. Four test files wait on unported packages
    (P1.4, P1.5). Next: P1.4.
- 2026-10-01: The owner wants ported code and fixtures to take the workspace
  formatting rather than the POC's bytes. Fixtures are now formatted. The
  multi-locality e2e test formats the generated edition before comparing,
  and the negative type fixture's directives sit on the erroring lines
  (25df7ba4).
- 2026-10-01: P1.4 is done. `libs/civic/llm` (`civic-llm`, import
  `@optimistic-tanuki/civic-llm`): 170 unit tests and 29 database tests pass
  (`live-analysis-integration` and `llm-provenance` moved here from core).
  Its `test-db` target reuses civic-core's Postgres helpers. The model client
  is still the POC's own Ollama gateway; routing through prompt-proxy is
  P2.3 (D5). Next: P1.5 (`libs/civic/adapters`).
- 2026-10-01: P1.5 is done. `libs/civic/adapters` (`civic-adapters`, import
  `@optimistic-tanuki/civic-adapters`) holds one folder per adapter, with
  `ALL_ADAPTERS` and `registerAllAdapters` at its root. Totals: 81 unit tests
  and 31 database tests. Added deps: cheerio (MIT), pdfjs-dist 4 (Apache-2.0),
  rss-parser (MIT).
  - pdfjs-dist ships only ES modules, so Jest uses
    `jest.pdfjs-transform.cjs`; webpack handles it at runtime.
  - The document adapter's OCR calls the system binaries `pdftoppm` and
    `tesseract`, which the P2.1 image must include.
  - Adapter tests run in a temporary working directory, because the OCR
    and download caches write to `./data`.
  - Database test schemas are now scoped per project (`civic_t_<scope>_`),
    so parallel `test-db` runs don't drop each other's schemas.
  - The `test-db` targets use a 60 s timeout, since a whole pipeline run
    exceeded Jest's 5 s default under parallel load.
    All 54 of the POC's core tests are now ported: 49 in core, 2 in llm and
    3 in adapters. Next: P1.6 (`libs/civic/community`, `libs/civic/access`).
- 2026-10-01: Rebased onto `main` after #271; the commit hashes above are
  post-rebase. P1.6 is done: `libs/civic/community` (61 tests, unchanged
  rules) and `libs/civic/access` (7 tests).
  - civic-access is reconciled with `default-permissions.json`, per D19 and
    D20: dotted permission names, the existing roles extended, one new role,
    and a denial of corroboration to officials.
  - A test checks the role list against the permissions seed, so P3.2's
    seeding can't drift from it. A mutation check confirmed the officials
    test fails without the denial.
  - `PREVIOUS_APP_SCOPE_NAMES` (renaming the beta's `towne-square` scope) is
    removed, since D6 drops the beta data.
    Next: P1.7.
- 2026-10-01: P1.7 is done; see `2026-10-01-daylight-discovery-benchmark.md`.
  - The harness is `libs/civic/adapters/benchmark/discovery.bench.ts` (target
    `discovery-benchmark`; live network, on demand).
  - No-search blind recall: 6 of 16 in-scope hand sources, with 0 wrong
    adoptions.
  - Misses: 4 local news, 4 bespoke government pages, 1 AgendaSuite, 1
    school board.
  - Bugs: B1, the .gov match misses "City of Adel, GA"; B2, cross-origin
    own-domain moves stall the crawl.
  - SearXNG's challenge-free engines were unusable (DuckDuckGo CAPTCHA,
    Mojeek empty), so the search comparison didn't run and D12 needs a
    decision.
  - The SearXNG container was started from a copy under `tmp/` and removed
    afterwards.
- 2026-10-01: The SearXNG check found a configuration gap but no fix:
  Mojeek is `inactive` in SearXNG's defaults (proof-of-work CAPTCHA), and the
  POC never enabled it. The owner chose to rely on the directories (D21).
  Next: fix B1 and B2, re-run the benchmark for Adel and Tifton, then Phase 2.
- 2026-10-01: B1 and B2 are fixed with regression tests (9f7cf863). In the
  re-run, Adel now seeds `cityofadelga.gov`, but its agendas page is bespoke
  (SD.4); recall is unchanged at 6 of 16.
- **Observed flake:** one of five parallel runs of all civic targets had 1
  failing test in `civic-core:test-db`, and four reruns passed. The failing
  test wasn't captured. Suspects are the timing-sensitive lease and heartbeat
  tests in `runner.test.ts`. If it recurs, capture the output and fix the
  cause; don't retry. Next: Phase 2, starting with P2.0 (the prompt-proxy
  research note).
- 2026-10-01: **Unexplained:** the Adel/Tifton benchmark re-run wrote two
  Tifton OCR cache files to a repo-root `data/`, although the harness moves
  into `CIVIC_BENCH_OUT` first. A local check showed `chdir` works under the
  target, and the files were removed. The harness now asserts its working
  directory before and after each town, and that no repo-root `data/`
  exists, so the next run will pinpoint the cause. A mistyped command
  (`--testPathPattern` isn't passed through by Nx) also started a full live
  benchmark run for about 5 minutes before the timeout stopped it.
- 2026-10-02: The owner asked for every source channel we can build, email
  list subscriptions, and local-government outreach. See
  `2026-10-02-civic-source-outreach-plan.md`: the owner's subscription
  checklist, the outreach plan (press-association licences, clerks,
  regional bodies, self-onboarding) and published clerk contacts.
  - The email ingestion adapter is committed (31e6a883). The owner is
    setting up a dedicated IMAP mailbox (`CIVIC_INBOX_IMAP_URL` in `.env`).
  - The research found Georgia's statewide public-notice site forbids
    automated access and Florida's needs written permission, so notices are
    licence-only.
  - The Google Custom Search JSON API is closed to new customers and shuts
    down on 2027-01-01. Brave costs $5 per 1,000 requests, and storing
    results needs a special plan.
  - Adel publishes, but sparsely: its agendas listing is paginated, with
    only 2 agenda or minutes PDFs on page 1, under the "page of PDFs"
    rule's threshold of 3.
- 2026-10-02: The source and outreach work is **pinned** at the owner's
  request (`2026-10-02-civic-source-outreach-plan.md`), and Phase 2 resumes.
  P2.0 is done: prompt-proxy passes payloads to Ollama's `/api/chat`
  unchanged (it has no validation pipe), so civic-briefing routes its calls
  through it with an injected `fetchImpl` and civic-llm needs no changes.
  The gaps for P2.3 are timeouts, error mapping, the `GeneratePrompt` type,
  and models on the shared Ollama host. Next: P2.1.
- 2026-10-02: P2.1 is done (960e9352 scaffold, plus the stage port).
  - **The service:** `apps/civic-briefing` is a TCP Nest service on 3028.
    `CivicDatabaseModule` wraps `DatabaseModule.register({ name:
'civic_briefing' })` and provides the TypeORM data-source and repository
    tokens the stages inject.
  - **The schedule:** the daily schedule starts only when
    `CIVIC_LOCALITIES_DIR` is set; otherwise the TCP service runs and logs a
    warning. The `source` and `run` one-shot modes are kept. Schedule
    settings come from `PIPELINE_*`, `SOURCING_*` and `LLM_*` env vars, and
    search is off (D21).
  - **The build:** it webpack-builds, and was smoke-run on a scratch
    database: it created 22 foundation tables and listened.
  - **Tests:** 14 schedule-plan unit tests pass.
  - **The 5 equivalence specs** (`*.equivalence.db.spec.ts`, `test-db`
    target) pass against Postgres. They need a recorded corpus through
    `CIVIC_CORPUS_DIR` (the POC's `data/corpus/ct`, read in place) and are
    skipped without it.
  - **The spec tsconfig is now strict.** It wasn't type-checking specs
    before, and the change forced 56 bracket-access fixes in the ported
    services.
    Next: P2.2 (the generated migration, and `ot_civic_briefing` in
    `scripts/setup-and-migrate.sh`).
- 2026-10-02: P2.2 is done.
  - **The migration:** `apps/civic-briefing/migrations/1790940573082-foundation.ts`
    was generated from `FOUNDATION_SCHEMAS`: 22 tables, 20 indexes and the
    `operation` CHECK. The append-only function, its 6 triggers and the
    `schemaVersion` row were then added to `up()` and `down()`. The owner
    clarified that generated migrations may be edited; the rule protects
    TypeORM's timestamps.
  - **Verified:** run, revert, run; `schema:log` reports no drift;
    `validate:typeorm-migrations` passes.
  - **TypeORM CLI:** it needs `ts-node.experimentalResolver` in the app's
    `tsconfig.app.json` to resolve civic-core's `.js` specifiers.
  - **Startup** now calls `preflightFoundationTarget` (it fails fast on an
    empty or mis-versioned database) instead of creating the schema.
  - `ot_civic_briefing` was added to `scripts/setup-and-migrate.sh`.
  - **Not done, for P5:** the service isn't yet in `docker-compose.dev.yaml`,
    k8s or `docker-compose.local-hub-e2e.yaml` (that one comes with P4.5).
    Tests and parity still create test schemas with
    `createFoundationDataSource` (synchronize), which `schema:log` shows
    matches the migration. Next: P2.3 (prompt-proxy).
- 2026-10-02: P2.3 is done.
  - **The adapter:** `promptProxyFetch` (`src/app/model`) sends civic-llm's
    native Ollama request to prompt-proxy over TCP (`PromptCommands.SEND`)
    and wraps the reply as a `Response`. A proxy failure rejects, which the
    gateway records as `unavailable`. It honours the gateway's abort signal,
    and its own timeout is the gateway's 300 s plus 30.
  - **Configuration:** `LLM_TRANSPORT` is `prompt-proxy` (the default) or
    `direct`. `PROMPT_PROXY_HOST` and `PROMPT_PROXY_PORT` default to
    prompt-proxy:3009. Compose raises prompt-proxy's
    `PROMPT_PROXY_TIMEOUT_MS` to 360 s.
  - **Tests:** 5 adapter specs.
  - **Proved live:** `requestChatCompletion` went through a local
    prompt-proxy to Ollama (qwen3.5:4b-q8_0) and back, with prompt and
    output hashes computed as on the direct path.
  - **Not done:** the `GeneratePrompt` widening, since civic-briefing never
    uses that type.
  - The Ollama host in the owner's environment is 192.168.1.180. Set
    `OLLAMA_HOST` in `.env`.
    Next: P2.4 (the replay parity gate).
- 2026-10-02: **P2.4: the parity gate passes, 38/38 identical.** `replay.js`
  is a second webpack entry. The parity tool now runs each replay inside its
  corpus work directory, and the replay supplies its own config (blobs
  beside the artifacts).
  - **The one difference on the way:** Nashville's 2026-09-15 briefing
    listed its agenda items in a different order. The agenda-row query (in
    both civic-core's `pipeline.ts` and the ported `BriefingService`) had no
    `ORDER BY`. SQLite returned rowid order; Postgres doesn't guarantee any.
    Both now order by `ordinal` then `id`.
  - **This is the SQLite-to-Postgres risk the plan anticipated.** Other
    unordered reads may hide the same bug where the corpora don't expose
    it; that's P2.4a.
  - **How it was run:** `DAYLIGHT_POC_DIR=<poc>
CIVIC_PARITY_DATABASE_URL=postgres://…/civic_parity_{corpus} pnpm
civic:parity --require`, with fresh, empty `civic_parity_{ga,ct,fl}`
    databases (dropped afterwards). OCR ran fresh with tesseract 5.5, the
    same version as the POC.
    Next: P2.5 (`apps/civic-contributions`), or P2.4a first.
- 2026-10-02: P2.4a is done.
  - **11 reads fixed,** in civic-core (`pipeline.ts`, `story-engine.ts`,
    `freshness.ts`, `health.ts`) and the ported `agenda`/`parse` services.
    Their row order affected: which documents get the LLM fixup budget,
    evidence-unit order in clustering, which candidate story wins a tie,
    story item order, thread input order, and diagnostics ordering. Each
    now orders by `id`, which reproduces SQLite's rowid order exactly on
    these integer-id tables.
  - **About 55 reads are order-insensitive:** key lookups, Maps and Sets,
    counts, or results re-sorted totally.
  - **No string-keyed table** (where insertion order isn't recoverable) has
    an order that reaches output.
  - **Borderline:** `health.ts` builds a fetch-ledger Map by `sourceId`;
    the last row wins if a source ever had two ledgers.
  - **Verified:** the parity gate is still 38/38, and all civic suites
    pass. Next: P2.5.
- 2026-10-02: **P2.5a is done.** The owner chose TCP over direct
  database reads for civic-contributions' corpus needs.
  - **The service:** `CorpusQueryService` in civic-briefing serves the
    POC community service's four foundation queries, ported to Postgres:
    quoted identifiers, a cutoff date computed in code, and explicit
    `ORDER BY` with an id tie-break.
  - **The endpoints** are under `CivicBriefingCommands` in
    `libs/constants`.
  - **Tests:** a 4-test DB spec.
  - **Smoke test:** the built service answered all three endpoints over
    TCP.
    Next: P2.5b, the contributions service.
- 2026-10-02: P2.5b is done (d12cb2b2 scaffold, 48686acf port, plus the
  migration).
  - **Tests:** 32 unit and 52 database tests, the POC's ~45 plus D20 cases.
  - **The migration:** generated (13 tables). Run, revert and run all work,
    `schema:log` shows no drift, and the validator passes.
    `ot_civic_contributions` was added to the setup script.
  - **UUIDs:** `uuid_generate_v4()` relies on `uuid-ossp`, which the compose
    Postgres template already has. No repo migration creates it, and this one
    follows suit.
  - **Smoke run:** the built service starts without civic-briefing or
    localities, and keeps its previous corpus index on a failed refresh.
  - **D20:** a corroboration is refused when the actor's roles lack
    `corroboration.create` (verified officials), or when this service
    recorded the contributor as an official in that town. An absent roles
    list counts as unknown, not refused (owner question below).
  - **Not ported:** the POC's `operator.ts` CLI.
  - **Owner questions:** the roles semantics; whether `Actor` in
    civic-community should gain `roles` (for P3.2); whether to keep the
    operator CLI.
    Next: P2.5c (D22, scanning external documents).
- 2026-10-02: Owner answers on P2.5b. Missing roles are now refused (D23):
  `Actor.roles` was added to civic-community's contract, and a DB test
  covers the refusal. The operator CLI is dropped in favour of API triggers
  from the UI (D24). Next: P2.5c.
- 2026-10-03: **P2.5c is done (D22).**
  - **The store:** civic-core's `createScanningBlobStore` scans before
    every `put`.
  - **Errors:** an infected file is never stored and becomes a
    non-retryable `policy`/`infected` fetch error. A scanner outage becomes
    a retryable `network`/`scanner-unavailable` error.
  - **The adapters:** the document adapter reports scan failures as
    structured errors. The email adapter records an infected attachment on
    its own result.
  - **Wiring:** civic-briefing's `PlatformModule` wraps its blob store with
    the platform `VirusScanService`. The schedule and replay now pass that
    store to `runPipeline`; before this, the runner silently made its own
    unscanned store. Compose gives civic-briefing `CLAMAV_HOST` and makes it
    wait for a healthy `clamav`.
  - **Verified:** EICAR is caught through the real clamd, and the parity
    gate is 38/38 with scanning on. With the scanner off it fails (45
    differing artifacts), which shows the scan path is live and fails
    closed.
  - **Parity runs now need** `CLAMAV_HOST=127.0.0.1 CLAMAV_PORT=3310` with
    the compose `clamav` service up (`docker compose up -d --no-deps
clamav`).
    Next: P2.6 (ADR on converging with `apps/civic`), then Phase 3.
- 2026-10-03: P2.6 is done. The ADR is accepted (D25), and P2.6a is added.
  If Civic Core's tenant entity has no two-letter state, P2.6a adds one
  with a generated migration. Phase 2 is complete apart from P2.6a.
  Next: Phase 3 (gateway routes), starting with P3.1.
- 2026-10-03: P2.6a is done.
  - **Civic Core:** a `civic_tenants` table (generated migration) with
    `CIVIC_REGISTER_TENANT` and `CIVIC_GET_TENANTS`.
  - **The `civic-core` adapter:** agendas become meetings; active
    broadcasts become alerts (expired ones are skipped); TIP projects become
    `news` items tagged transportation and infrastructure.
  - **`matchTenants`:** exact state, normalised name, kind agreement. It
    matches against **all** local-government localities, edition or not
    (the owner's choice: stricter against namesakes).
  - **Adoption:** civic-briefing adopts a matched tenant during weekly
    sourcing through discovery's logged `adopt()` path, and skips when Civic
    Core is unreachable.
  - **Known gap until SD.6:** a removed civic-core source is re-adopted the
    next week. The owner chose to wait for the admin UI's block list rather
    than add a stop-gap.
  - **Tests:** adapters 124, briefing 31, civic 27.
    Phase 2 is complete. Next: Phase 3, starting with P3.1.
- 2026-10-03: P3.1 is done.
  - **civic-briefing:** an editions query service (ported from the POC
    gateway's BriefingStore), served as `CivicBriefingCommands.EDITIONS`,
    `EDITION_HISTORY` and `BRIEFING`.
  - **Gateway:** a public `EditionsController` at `local-hub/editions` (plus
    a `v1/` alias), registered under the `civic-briefing` service. Empty
    results become 404; an unreachable or timed-out service becomes 503.
  - **The contract types** (`EditionSummary`, `EditionHistory`,
    `PublishedBriefing`) live in `libs/models`, because importing civic-core
    would pull the whole pipeline lib into the gateway's compilation.
  - **Tests:** 3 DB tests and 4 controller tests.
  - **Not run:** an end-to-end request through a live gateway.
    Next: P3.2.
- 2026-10-03: P3.2 is done (aae380a9 seeding, 80101696 routes, plus the
  owner's follow-ups).
  - **The full gateway suite** passes (107 suites, 1,502 tests), and the
    gateway builds.
  - **The seed** now has 15 civic permissions, the
    `local_hub_verified_official` role and 21 grants, with a drift test in
    civic-access.
  - **Routes:** under `local-hub/` with `v1/` aliases. Every actor's roles
    come from `GetUserRoles` (local-hub scope); a failed lookup answers 503.
    A granted official application assigns `local_hub_verified_official`.
  - **Dropped:** `PATCH me`. Profile edits use the existing profile routes,
    and the service has no contributor-profile command.
  - **Not tested:** a live end-to-end request (P4.5).
    Next: P3.3 (filing the security findings as issues, which needs the
    owner's approval before anything is posted).
- 2026-10-03: P3.3 is done; Phase 3 is complete. All eight platform
  findings are still present at this branch. The repository is public, so
  the owner chose private draft advisories over public issues:
  GHSA-pm99-mq48-rjcm, GHSA-3h5g-92rf-v564, GHSA-63c8-f74f-w9q8,
  GHSA-x5rv-7pmq-q5f7, GHSA-j87j-qx4j-6h8g, GHSA-h4x2-393w-v89h,
  GHSA-q977-2c3p-65rw and GHSA-c9pw-rr3f-5rv2. The fixes are separate work
  and haven't been scheduled. Next: Phase 4 (Towne Square pages), starting
  with P4.0 (re-check PR #186 and rebase).
- 2026-10-03: P4.0 is done. The branch was rebased onto `main`, which had
  gained #269 (dependency consolidation).
  - **Conflicts:** only `package.json` and `pnpm-lock.yaml`. They were
    resolved by keeping `main`'s versions plus the civic additions, and
    regenerating the lockfile; `--frozen-lockfile` passes.
  - **Tests:** all ten affected projects pass (gateway 1,503).
  - **Commit hashes** quoted earlier in this log predate this rebase.
  - **PR #186** won't merge (owner), so Phase 4 builds on `main`'s
    local-hub.
    Next: P4.1.
- 2026-10-03: P4.1 is done. `libs/civic/briefing-data-access`
  (`@optimistic-tanuki/civic-briefing-data-access`, tags `type:data-access`,
  `scope:civic`, `platform:web`) has the Angular clients for the local-hub
  routes, ported from the POC web app.
  - **Services:** `EditionsService`, `CommunityService`, `MembershipService`
    (`me` only, since `PATCH me` was dropped) and `OperationsService` (the
    operator routes that replace the CLI, D24), plus `problem` and
    `problemCode`.
  - **Shared shapes:** the lint rules bar a data-access lib from a
    `type:domain` lib. As with the edition contract (P3.1), the community
    reply shapes moved to `libs/models` (`civic/community-contract.ts`), and
    civic-community re-exports them. `ContributorPage` (with the bio) and
    `LocalHubMembership` are new there.
  - **Written by hand,** not with orval: every reply is wrapped in
    `{ data }`, and submission is multipart.
  - **No `typecheck` target,** like `profile-ui-data-access`. Under the lib
    config (`types: []`), `libs/models` fails on an existing `Buffer`
    reference. The Jest run type-checks the sources.
  - **Tests:** 16 new specs pass. civic-community, civic-contributions,
    gateway, models and local-hub still pass.
    Next: P4.2 (`libs/civic/briefing-ui`).
- 2026-10-03: P4.1b is done. The owner asked why P4.1 hand-wrote the
  clients when the workspace generates them with orval. Nobody had decided
  that: I made the call alone. The reasons given (the `{ data }` wrapper,
  multipart) don't hold, since orval handles both. The real cause was that
  P3's civic controllers had no Swagger annotations. The owner chose orval.
  - **Swagger:** the edition and community reply shapes in `libs/models`
    are now `@ApiProperty` classes (same structure, so the services are
    unchanged). The request bodies are annotated. The gateway's
    `civic-briefing/replies.ts` describes the `{ data }` envelopes and the
    multipart upload. Every civic route has `@ApiResponse`.
  - **Generated client:** an orval `civic` project writes
    `libs/civic/briefing-data-access/src/generated/civic.ts`. An input
    transformer drops the `v1/` aliases (and density's POC path), and an
    `operationName` override names methods after the controller method
    (`me`, `latest`, `submit`). The submission is one JSON part, as the
    gateway expects. CI's codegen drift check now includes the directory,
    and the lib has a `generate` target.
  - **Hand-written code that stays:** `problem` and `problemCode`, the
    state and stage wording, `submissionKey`, `artifactUrl` and
    `DENSITY_TARGET`.
  - **Two P3 bugs found and fixed:**
    1. `civic-briefing` and `civic-contributions` were missing from
       `GATEWAY_SERVICE_IDS`. Without a composition file, the gateway never
       mounted any `local-hub/*` route.
    2. `pnpm run get-openapi` failed, because ts-node couldn't resolve
       civic-community's `.js` specifiers; CI's drift step would have
       failed too. `tools/openapi/tsconfig.json` turns on
       `ts-node.experimentalResolver`, and the script uses it.
  - **SSR:** generated clients call relative `/api/...` URLs, like the
    other generated libs. local-hub's SSR server proxies `/api` to the
    gateway; P4.5 exercises it.
  - **Tests:** the other nine generated clients don't drift. Typecheck and
    tests pass for civic-community, civic-contributions, civic-briefing,
    gateway (1,503), models, constants, local-hub, ai-orchestrator and the
    data-access lib (10 specs), and lint passes.
    Next: P4.2 (`libs/civic/briefing-ui`).
- 2026-10-03: P4.2 is done. `libs/civic/briefing-ui`
  (`@optimistic-tanuki/civic-briefing-ui`, tags `type:ui`, `scope:civic`,
  `platform:web`) has `<civic-briefing-body>`, `<civic-edition-strip>`,
  `renderBriefing` and the calendar-day helpers, ported from the POC web app.
  - **Sanitizing (owner):** not DOMPurify. On the server it needs jsdom,
    which can't go in the SSR bundle (`apps/learning` hit the same limit).
    `renderBriefing` escapes every raw HTML tag except the pipeline's
    `<details>`/`<summary>`, keeps only http(s) links (new tab,
    `rel="noopener noreferrer"`), and keeps an image's description but not
    the image. The component binds the result as a plain string, so
    Angular's sanitizer runs on the server and in the browser.
  - **Changes from the POC:** no `referrerpolicy` attribute (Angular's
    sanitizer drops it; `noreferrer` covers it). A quoted headline's raw
    HTML shows as text rather than being stripped. The strip takes its link
    prefix as an input (`route`), since the POC hard-coded `/towns`. The
    `current` mark uses the theme's `--on-primary` instead of a `#fff`
    fallback.
  - **Checked against real output:** all 12 POC briefings render with
    nothing escaped, every `<details>` and source link kept, and nothing
    removed by Angular's sanitizer (so server and browser match). This was
    a one-off check, not a committed test, since it reads the POC's data.
  - **Tests:** 11 specs (the POC's rendering, date and strip tests, plus
    two component tests through Angular's sanitizer); lint passes.
    Next: P4.3 (`localitySlug` on community, and the Briefing section on
    the city page).
- 2026-10-04: P4.3 is done. A city page shows its town's briefing.
  - **Owner decisions:** `localitySlug` is set explicitly in the seed data,
    never guessed. Adel, GA is added to the seed. SD.1's Census columns stay
    out of this migration.
  - **Social:** `Community.localitySlug` (varchar 64, nullable, unique).
    Migration `1791073064173-AddCommunityLocalitySlug` was generated on a
    fresh database and passes run, revert and run plus
    `validate:typeorm-migrations`. The seed sets it for `tifton-ga`,
    `nashville-ga` and the new `adel-ga`. Both copies of
    `seed-cities.json` (social's, and local-hub's that the Dockerfile copies)
    stay identical. `CommunityDto` documents the field; the social client
    was regenerated (one field, no other drift).
  - **Not in the migration: drift already on `main`.** The generator also
    wanted to drop and recreate `community_member.status` and
    `community_invite.status`: the entities declare an enum, while the
    migrations created varchar. Running that would wipe every membership and
    invite status, so those statements were removed. The drift is still
    there and needs its own careful migration (owner to schedule).
  - **local-hub:** `app-city-briefing` shows the latest edition (or one
    day's) with the four-week strip. It says plainly when a town has no
    briefing yet, when a day is missing, or when the service is down. The
    city page shows it after the hero, but only for a town with a
    `localitySlug`. New routes `city/:slug/briefing` and
    `city/:slug/briefing/:date` give it a page with a masthead and title.
    Those routes fall under `**`, so they are server-rendered, while
    `city/:slug` stays client-rendered as before; P4.5 checks SSR.
  - **The HTTP seeder** (`apps/local-hub/src/seed-http.ts`, local runs only)
    sends explicit fields and doesn't set `localitySlug`. The deployed
    seeder, `seed-local-communities.js`, does.
  - **Tests:** 8 new specs (component and page). local-hub (376), social,
    models, gateway (1,503), social-data-access and the civic libs all
    pass, and lint passes. local-hub's production build passes. The
    briefing code and marked land in a lazy chunk; the existing warning
    that the initial bundle exceeds 1 MB predates this work.
  - **Not yet seen in a browser:** that waits for P4.5's running stack.
    Next: P4.4 (contributor pages: report, watch, contributor, operations).
- 2026-10-04: P4.4 is done, in four commits (a–d).
  - **Owner decisions:**
    - The feature is named **Daylight** (the Daylight feed) inside Towne
      Square. Page copy keeps the POC's "Daylight" wording, and the city
      page section from P4.3 is now titled Daylight.
    - The scope adds four pieces to report, watch, contributor and
      operations: the resident-reports section, "Your reports" and the
      official application on the account page, and a public copyright
      page.
    - The operator tools are a local-hub `/operations` page.
  - **Shared components (a):** `civic-review-trail` and
    `civic-contribution-quote` in `civic-briefing-ui`.
  - **Public pages (b):**
    - `city/:slug/report` (sign-in required) reports something, or
      corroborates with `?corroborate=<id>`. It shows every refusal reason,
      and tells a reader without `contribution.create` how to become a
      contributor.
    - `city/:slug/watch` is the watcher recruiting page.
    - `contributors/:id` shows a contributor's record "in a sentence, not
      a score".
    - `copyright` takes DMCA notices.
    - The briefing page shows the resident reports under the briefing,
      with "I saw this too" for signed-in readers.
    - The city section links to reports and past editions, the report
      form, and the watch page.
  - **Account page (c):** a Daylight section with "Your reports" (with
    `contribution.read`: the review trail, withdraw, and a counter-notice
    once taken down), the official application, and a link to operations
    for operators.
  - **Operations (d):** one panel per permission (`density.read`,
    `takedown.manage`, `official.verify`, `community.maintain`): density
    and where to recruit; notices to uphold, decline or restore, each with
    a required reason; recording an official's callback; and running
    re-review, the outcome sweep or the promotion export now. The gateway
    checks each permission again.
  - **Fixes found on the way:**
    - The POC checked `contribution:create`; the port uses the dotted
      `contribution.create`.
    - `submissionKey` called `crypto.randomUUID`, which browsers expose
      only on HTTPS or localhost. On plain HTTP the report page would have
      crashed; it now falls back to `getRandomValues`.
    - Both new sign-in routes (`city/:slug/report`, `operations`) are also
      in the Express session gate, as `server-route-guard.spec` requires.
  - **Deliberate gaps:**
    - On a contributor page, "corroborated others' reports" names each
      report but doesn't link it. Entries carry the civic locality slug,
      and there is no lookup from a locality to its town page yet.
    - Copy saying reports are "published once corroboration opens later
      in the beta" is the POC's. It needs the owner's review against how
      the gate is configured here.
  - **Tests:** local-hub 390 (24 new Daylight specs), civic-briefing-ui 15,
    civic-briefing-data-access 11, and lint passes. local-hub's production
    build passes, and the initial bundle barely changed (the pages are
    lazy).
  - **Not yet seen in a browser:** that is P4.5.
    Next: P4.5 (SSR, and local-hub-e2e: city → briefing → report).
- 2026-10-04: P4.5a is done: contributor sign-up (D27).
  - **Roles:** a new `local_hub_contributor` holds the contribution
    permissions. `local_hub_member` keeps only `briefing.read` among the
    civic grants. The civic-access drift test now also fails on any extra
    civic grant in the permissions seed, so a member can't quietly regain
    contribution rights.
  - **Gateway:** `POST local-hub/contributor` takes
    `{ agreeToTerms: true }`. It answers 403 with
    `EMAIL_VERIFICATION_REQUIRED` until the account's email is verified
    (read live from the authentication service), then grants the role and
    returns the new standing. The client is regenerated
    (`signUpAsContributor`).
  - **local-hub:**
    - `/contribute` (sign-in required, and in the Express session gate)
      shows the contributor terms and an "I agree" checkbox. It sends an
      unverified account to verify first, and returns to a same-site
      `returnUrl` only.
    - The terms are one shared component, also used on the watch page,
      whose "nothing to sign up for" line was corrected.
    - The report page and the account page send non-contributors to the
      sign-up.
  - **Lint repair (separate commit):** lint had failed across five civic
    projects since Phases 1–2; I hadn't run it on them. civic-core is now
    tagged `type:util` (owner). Shared test helpers are behind
    `@optimistic-tanuki/civic-core/testing`, inline `import()` types became
    `import type`, and one regex was fixed. Lint now passes on all civic
    projects, gateway, local-hub and models.
  - **Tests:** gateway 1,505, local-hub 394, civic-access 8, permissions
    110, the civic libs' unit tests, and the `test-db` suites for
    civic-briefing, civic-contributions, civic-llm and civic-adapters all
    pass.
  - **Not done:** the terms agreement isn't stored apart from the role
    assignment. A record of the terms version is for the owner to decide.
    Next: P4.5b (the shared e2e stack).

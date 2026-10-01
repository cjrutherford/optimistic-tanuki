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

- [ ] P0.1 Port `tools/golden.ts` into this repo as a parity tool. It reads
      the corpora and `golden/baseline.json` from the POC checkout, read-only,
      through a path env var (`DAYLIGHT_POC_DIR`), and replays them through
      `civic-briefing`. If the POC checkout is missing, it skips with a
      clear message. The 370 MB of data stays out of git, so the gate runs
      only on a machine that has the POC checkout.
- [ ] P0.2 Measure drift: the POC's vendored code (reference `7e1d8740`)
      against current libs here (auth, database, storage, permissions,
      profile)
- [ ] P1.1 `libs/civic/core`: copy and build (`packages/core` +
      `packages/nestjs` as `nest/`)
- [ ] P1.2 `libs/civic/core`: tests to Jest (part 1)
- [ ] P1.3 `libs/civic/core`: tests to Jest (part 2), Postgres dialect for
      SQLite-only SQL (POC S1.2 step 1)
- [ ] P1.4 `libs/civic/llm` (+ Jest)
- [ ] P1.5 `libs/civic/adapters` (+ Jest, deps, licence check)
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
      ClamAV)
- [ ] P2.6 ADR: converging with `apps/civic`
- [ ] P2.7 Research (no code): source discovery — see "Open question" below
- [ ] P3.1 Gateway briefing routes
- [ ] P3.2 Gateway contribution and profile routes, permissions seeding
- [ ] P3.3 File the nine security findings as issues (owner approves before
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

## Open question: finding sources for a new town

The gathering pipeline is considered solid. The owner's open uncertainty is
how to find _where_ to gather from, because each locality has its own mix of
sources (agenda portals, municipal sites, local news, open data). No
decision has been made. Today both systems are configured by hand:

- The POC uses one YAML file per locality (`localities/{ct,fl,ga}/*.yaml`,
  20 localities, 5 edition towns), written by hand.
- `apps/civic` uses an operator-configured `CIVIC_AGENDA_SOURCES` list plus
  `agenda-source-discovery.ts` (`docs/civic-core-agenda-source-ingestion.md`).
- PR #186 adds `locality-discovery` / `locality-resolution` services to
  local-hub and the gateway. They may be related; check before P2.7.

P2.7 should survey these and propose options for the owner to choose from.
Candidate options include: assisted discovery (search, then model-ranked
candidates that an operator confirms), known platform fingerprints (Agenda
Plus, CivicPlus, Granicus, Municode), and community-suggested sources
reviewed through civic-contributions. P2.7 proposes; it does not decide.

## Handoff log

- 2026-09-30: Plan and decisions recorded. Nothing ported yet. The POC is
  closed; the parity gate reads its data in place. Source discovery is an
  open question (P2.7). Next: P0.1.

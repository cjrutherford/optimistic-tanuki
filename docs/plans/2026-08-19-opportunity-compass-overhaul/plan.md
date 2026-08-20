# Opportunity Compass Overhaul

**Apps:** `leads-app` (Angular SSR) · `lead-tracker` (NestJS microservice) · `libs/models`, `libs/auth-ui`
**Branch:** `opportunity-compass-overhaul` · **Started:** 2026-08-19
**Tracker artifact:** `./tracker.html`

## Goal

Bring Opportunity Compass to shippable quality across five workstreams: auth layout, a genuinely
adaptive onboarding interview, a structured mad-lib intro, a discovery source set that is free,
real, and legally usable, and per-position tailored resumes + cover letters.

## Evidence gathered 2026-08-19

All endpoint probes were run from this machine with
`curl -sS -m 15 -w '%{http_code} %{content_type} %{size_download}'`.

### Currently wired sources

| Source             | Endpoint                                     | Probe result                      | Verdict                                                                                |
| ------------------ | -------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------- |
| RemoteOK           | `https://remoteok.com/api`                   | `200 application/json` 489 KB     | Keep — ToS requires a **followed** backlink; not currently rendered                    |
| Himalayas          | `https://himalayas.app/jobs/api`             | `200 application/json`            | Keep                                                                                   |
| We Work Remotely   | `https://weworkremotely.com/remote-jobs.rss` | `200 application/rss+xml`         | Keep                                                                                   |
| Jobicy             | `https://jobicy.com/api/v2/remote-jobs`      | `200 application/json`            | Keep — response carries a `friendlyNotice` attribution ask                             |
| JustRemote         | `https://justremote.co/jobs.xml`             | `200` but **`text/html`**         | **Broken** — feed is gone; the provider parses an SPA shell as XML and always yields 0 |
| Indeed             | `https://www.indeed.com/jobs?q=`             | **`403`**                         | **Remove** — anti-bot wall, Publisher API retired, scraping breaches ToS               |
| Clutch             | `https://clutch.co/web-developers`           | **`403`** Cloudflare interstitial | **Remove** — no public API, page fetch always fails                                    |
| Crunchbase         | Google News RSS filtered to `crunchbase.com` | RSS `200`                         | **Mislabelled** — this is news-about-funding, not Crunchbase data                      |
| Google HTML search | `https://www.google.com/search`              | `200` today                       | Fragile — ToS-violating, captcha-prone from server IPs                                 |
| DuckDuckGo HTML    | `https://html.duckduckgo.com/html/`          | `200` today                       | Fragile — explicitly rate-limited                                                      |

`indeed`, `clutch`, and `crunchbase` all depend on `SearchAcquisitionService` scraping a search
engine and then domain-filtering the results. Two of the three destinations return 403 to any
server request, so `analyzePage` can never enrich them — those providers structurally cannot
produce leads.

### Candidate replacements (probed, free, no key required)

| Source                | Endpoint                                                  | Probe result                                     |
| --------------------- | --------------------------------------------------------- | ------------------------------------------------ |
| Arbeitnow             | `https://www.arbeitnow.com/api/job-board-api`             | `200 application/json`                           |
| Remotive              | `https://remotive.com/api/remote-jobs`                    | `200 application/json`                           |
| The Muse              | `https://www.themuse.com/api/public/jobs?page=1`          | `200 application/json` — 408 231 postings        |
| HN "Who is Hiring"    | `https://hn.algolia.com/api/v1/search`                    | `200 application/json`                           |
| Greenhouse job boards | `https://boards-api.greenhouse.io/v1/boards/{token}/jobs` | `200 application/json`                           |
| Lever postings        | `https://api.lever.co/v0/postings/{token}`                | API live (`404` only for an unknown token)       |
| OSM Overpass          | `https://overpass-api.de/api/interpreter`                 | Live — keyless alternative to paid Google Places |

### Code-level findings

- `apps/lead-tracker/src/app/onboarding-analysis.service.ts:129-144` — `advanceDiscInterview`
  returns from a **hardcoded four-prompt array** indexed by user-turn count. The LLM is consulted
  only for final scoring, never for question generation. This is the whole reason the interview
  feels canned: every user gets the same four questions in the same order.
- `apps/leads-app/src/app/interview-wizard.component.html:130-152` — the "tell me about yourself"
  step is a single `<textarea rows="7">` whose mad-lib scaffold lives in the **placeholder**, so it
  vanishes as soon as typing starts. The backend then regex-mines the resulting prose.
- `libs/auth-ui/.../login-block.component.html` and `register-block.component.html` each render
  their own `.hero` (h1 + description + 300 px image) _inside_ the card, while
  `apps/leads-app/src/app/login.component.ts:19-32` renders a second marketing column outside it —
  two `<h1>`s and two headline treatments on one page.
- `libs/auth-ui/.../login-block.component.scss:18-58` — `.card-inner` is `flex-direction: row` and
  `.form` sets `margin: 30px` on a `width: 100%; box-sizing: border-box` child, so the card
  overflows; it only stacks at `max-width: 640px`, but leads-app drops it into a
  `minmax(320px, 480px)` grid column.
- `apps/leads-app/src/app/login.component.ts:104` / `register.component.ts:107` — `.signal-grid`
  uses `rgba(255,255,255,.78)` and `rgba(8,47,73,.08)` literals, which do not survive dark theme.
- `login.component.ts:156` awaits `authState.login` with no `catch`; `register.component.ts:162`
  subscribes with `next` only. Failed auth is invisible to the user.
- No cross-link between `/login` and `/register`.
- `apps/leads-app/src/app/dummy-data.ts` — 454 lines, zero importers.
- No resume-tailoring or cover-letter code exists anywhere in the workspace (`grep -ri
'cover.letter\|tailored.resume'` → 0 hits). Greenfield.
- Ollama is listening on `:11434`, so the LLM paths are live in this environment.

---

## Workstream A — Auth surfaces

**A1.** Capture baseline screenshots of `/login` and `/register` at 1440 / 1024 / 768 / 390 via the
Chrome agent; file each visual defect against the findings above.

**A2.** Add a `[showHero]` input (default `true`) to `LoginBlockComponent` and
`RegisterBlockComponent` so a host that supplies its own marketing column can suppress the in-card
hero. Leads-app sets it `false`.

**A3.** Fix the shared block layout: replace `.form { margin: 30px }` with `gap`-based spacing,
constrain the hero image to `max-width: min(300px, 100%)`, and raise the stacking breakpoint to
~860 px so the row layout never runs below its comfortable width.

**A4.** Extract the duplicated ~85-line inline `auth-shell` style block from `login.component.ts`
and `register.component.ts` into one shared component/stylesheet; replace the `rgba()` literals
with theme tokens; drop the `calc(100vh - 56px)` hardcoded header height.

**A5.** Surface auth failures: pending state on submit, an inline error region wired to `catch` /
`error`, and reciprocal links between login and register.

**A6.** Re-capture screenshots; add viewport regression assertions to `apps/leads-app-e2e`.

**A7.** _(Added slice.)_ Give `hai-about-tag` a mobile form: collapse it to its mark under 640px so
the fixed badge stops covering form controls.

### Implementation notes (2026-08-19) — Workstream A done

Measured with a Playwright audit script at 1440 / 1024 / 768 / 390:

| Metric                                 | Before                | After                     |
| -------------------------------------- | --------------------- | ------------------------- |
| Form width @1440 / 1024 / 768 / 390    | 156 / 156 / 157 / 288 | **458 / 407 / 621 / 288** |
| `<h1>` count (both routes, all widths) | 2                     | **1**                     |
| Horizontal page scroll @1024           | yes                   | **no**                    |

- `libs/auth-ui/.../login-block` + `register-block`: added `showHero`, `errorMessage`, `pending`
  inputs; `.card-inner` now wraps on available width instead of a 640px viewport gate (container
  queries are unavailable here, and the viewport gate was the reason a 1440px screen still got a
  156px form); `.form`'s `margin: 30px` on a `width: 100%` border-box child replaced with flex
  `gap`; hero image capped at `min(300px, 100%)`.
- `apps/leads-app/src/app/auth-shell.component.ts`: new shared shell replacing ~85 duplicated inline
  style lines in each of login and register; `rgba()` literals replaced with `color-mix()` over theme
  tokens; `calc(100vh - 56px)` hardcoded header height removed.
- Login and register now catch failures — previously `login.component.ts` awaited with no `catch` and
  `register.component.ts` subscribed with no `error` handler, so failed auth was invisible.
- `apps/leads-app-e2e/src/leads/auth-layout.spec.ts`: 10 assertions, all passing.
- `apps/leads-app-e2e/playwright.config.ts`: `PW_CHANNEL` env opt-in, because Playwright ships no
  chromium build for Ubuntu 26.04. CI behaviour is unchanged when the var is unset.
- Verified: `nx build leads-app` clean · `nx test leads-app,auth-ui` 49/49 · `nx test,lint hai-ui`
  23/23 · lint clean · `ui:heuristics:ci` leads-app 0/8, auth-ui 6/8.
- **Known pre-existing failure**, not caused by this work: `leads.spec.ts › redirects anonymous users
to login` fails against a bare dev server because `/` renders `home-redirect`, which awaits auth
  state from `/api` before navigating. Needs the docker compose stack to validate.

## Workstream B — Adaptive onboarding interview

**B1.** Add `generateNextDiscQuestion(profile, transcript)` to `LlmOnboardingAnalysisService`. The
prompt carries the onboarding profile and prior turns and returns
`{ question, targetDimension, sufficientSignal }`.

**B2.** Rewrite `advanceDiscInterview` to drive off that call: ask until the model reports
sufficient signal or a turn cap (6) is reached. Keep the static array **only** as the
`isAvailable === false` fallback, and seed/rotate it from the profile so even the fallback varies
between users.

**B3.** Record `targetDimension` per turn and require all four DISC dimensions to be probed before
the interview can complete.

**B4.** Persist the interview transcript with the onboarding record so a re-run does not repeat
verbatim. **Done 2026-08-19:**

- `LeadOnboardingProfileRecord.discTranscript` (jsonb, `NOT NULL DEFAULT '[]'`) plus CLI-generated
  migration `2026082000000-add-onboarding-disc-transcript.ts`. The default backfills existing rows so no
  caller has to null-check.
- **Migration process correction.** The first attempt hand-wrote the migration file and timestamp,
  which `AGENTS.md` §TypeORM migrations explicitly forbids. Regenerated with
  `nx run lead-tracker:typeorm:migration:generate`. Two things worth recording:
  - Generating against a database that had not been migrated produced a full `CREATE TABLE` for
    every entity and a `down()` dropping them all. Run `typeorm:migration:run` first so the
    generator has a correct baseline to diff against.
  - The clean generation still swept in unrelated pre-existing drift: renaming both
    `lead_qualifications` foreign keys and setting `lead_onboarding_profiles.appScope` NOT NULL. The
    FK rewrite would have changed `leadId` from `ON DELETE CASCADE` to `ON DELETE NO ACTION` — a
    silent behaviour change. Removed after review; **that drift still needs its own migration.**
  - Verified: `migration:run` → `migration:revert` → `migration:run`, then
    `pnpm run validate:typeorm-migrations` passes.
- `ConfirmOnboardingRequest.discTranscript` carries the interview from the wizard through
  `leads.service` → gateway → `saveOnboardingProfile`.
- `getPreviouslyAskedQuestions(profileId)` reads the assistant turns from the last 5 onboarding
  records and de-duplicates them. The gateway's `onboarding/disc/advance` route now forwards auth
  context so the service can do that lookup.
- Both question paths honour it: the LLM prompt lists the prior questions and is told not to repeat
  or paraphrase them, and the offline bank walks forward from its profile-seeded offset to the first
  entry the user has not seen (falling back to the seeded one if a re-run exhausts the bank).
- Tests: prior questions are passed to the model; the offline path returns a _different_ question on
  a re-run; an exhausted bank still returns something rather than nothing.
- **Not verified:** the migration SQL has not been applied to a live database. It will first run
  under `docker:dev:seed`.

**B5.** Tests: two distinct profiles must produce different first questions; the fallback path must
still terminate; the turn cap must hold.

**B6.** _(Added.)_ Use Ollama's `format` field for schema-constrained decoding so malformed JSON is
structurally impossible, and disable thinking traces for interactive latency.

### Implementation notes (2026-08-19) — Workstream B, B4 outstanding

- `llm-onboarding-analysis.service.ts`: added `generateNextDiscQuestion(profile, transcript,
coveredDimensions)`. `invokeJson` now takes an optional JSON schema and passes it as `format`;
  `@langchain/ollama` 1.1.0 exposes this on `ChatOllamaCallOptions`. `think: false` by default.
- `onboarding-analysis.service.ts`: the hardcoded four-prompt array is gone. Completion now requires
  **both** the model reporting sufficient signal **and** all four quadrants probed, capped at 6
  turns. The offline bank has 3 questions per quadrant, selected by a hash of the user's own profile.
- `coveredDiscDimensions` prefers explicit `targetDimension` metadata and falls back to positional
  inference from the answer count, so transcripts recorded before the field existed still terminate.
- `libs/models`: `DiscDimension`, `DISC_DIMENSIONS`, `DiscQuestionSuggestion`; `targetDimension` on
  `DiscInterviewTurn`; `nextQuestionDimension` on `DiscInterviewResponse`.
- `interview-wizard.component.ts` echoes `targetDimension` back on assistant turns.
- Verified: lead-tracker 90/90 · leads-app 92/92 · lint clean across lead-tracker, leads-app, models ·
  both builds pass.

### Model pilot (2026-08-19)

Dev host moved to `192.168.50.191:11434` (`docker-compose.dev.yaml`, now env-overridable). The host
runs Ollama 0.32.14 with **no models installed**. Candidates for an 8GB card, all leaving KV headroom:

| Candidate                 | Size  | Context | Rationale                                               |
| ------------------------- | ----- | ------- | ------------------------------------------------------- |
| `qwen3.5:4b-q8_0`         | 5.3GB | 256K    | 8-bit — least quantization damage of the five           |
| `qwen3:8b`                | 5.2GB | 40K     | Control: more params, heavier quant, same VRAM          |
| `granite4:tiny-h`         | 4.2GB | 1M      | IBM, tuned for instruction following + JSON; Apache-2.0 |
| `gemma4:e2b-it-qat`       | 4.3GB | 128K    | Google's own QAT build — the Gemma 4 that fits          |
| `nemotron-3-nano:4b-q8_0` | 4.2GB | 256K    | NVIDIA, trained on structured output + multi-turn       |

Ruled out: `nemotron` (70B) and `nemotron-3-nano:30b` on size; `nemotron-mini:4b` on its 4K context.

#### Frontier-distilled candidates from Hugging Face

Verified to exist, be GGUF/Ollama-pullable, and fit 8GB (sizes from the HF blob API):

| Repo                                                           | Quant  | Size   | Distilled from                   |
| -------------------------------------------------------------- | ------ | ------ | -------------------------------- |
| `Jackrong/Qwen3.5-4B-Claude-4.6-Opus-Reasoning-Distilled-GGUF` | Q4_K_M | 2.71GB | Claude Opus 4.6 reasoning traces |
| `Jackrong/GPT-5-Distill-Qwen3-4B-Instruct-GGUF`                | Q4_K_S | 2.38GB | GPT-5 (instruct, not reasoning)  |
| `TeichAI/Qwen3-8B-GPT-5.2-High-Reasoning-Distill-GGUF`         | Q4_K_M | 5.03GB | GPT-5.2 reasoning                |

Pulled via Ollama's `hf.co/{repo}:{QUANT}` syntax.

**Two caveats to weigh before shipping one of these:**

1. **Terms of service.** Anthropic's and OpenAI's usage policies both prohibit using their model
   outputs to train competing models. These community repos were built that way. Downloading and
   evaluating them is one thing; shipping one inside a commercial product portfolio carries real
   licensing exposure that the first-party models (Apache-2.0 Granite/Gemma/Qwen, NVIDIA open
   licence) do not. This is a business call, not a technical one — the pilot scores it on merit
   either way.
2. **Reasoning distills fight this workload.** Two of the three are _reasoning_ distills, which emit
   long thinking traces before answering. That is exactly what B6 disables for latency, and it works
   against schema-constrained decoding. The GPT-5 _instruct_ distill is the more natural fit of the
   three. The pilot's MED-MS column measures this rather than assuming it.

Fable distills were checked and every one found is ≥27B except a 9B "abliterated" build (safety
training removed) and a 1.5B code model — neither appropriate here, so no Fable distill is piloted.

#### Open-teacher distills — the same technique without the exposure

Distilling from a model whose _weights_ were released under a permissive licence is expressly
allowed, unlike distilling API outputs. That gets most of the benefit with a clean licence chain:

| Repo                                                          | Quant     | Size   | Teacher → student       | Licence                               |
| ------------------------------------------------------------- | --------- | ------ | ----------------------- | ------------------------------------- |
| `mradermacher/gpt-oss-120b-Distill-Qwen3-4B-Thinking-i1-GGUF` | i1-Q4_K_M | 2.50GB | gpt-oss-120b → Qwen3-4B | **Apache-2.0 end to end**             |
| `bartowski/DeepSeek-R1-Distill-Qwen-7B-GGUF`                  | Q4_K_M    | 4.68GB | DeepSeek-R1 → Qwen-7B   | **MIT** (verified on `deepseek-ai/…`) |

The first is notable: `gpt-oss-120b` is OpenAI's _open-weight_ Apache-2.0 release, so this is a 120B
teacher distilled into a 4B student with no licence encumbrance at all — the same lineage as the
GPT-5 API distills, obtained legitimately. `gpt-oss:20b` itself is 14GB and does not fit the card,
so the distill is the only way to reach that lineage on 8GB. The DeepSeek-R1 distill is MIT and by
far the most downloaded of any candidate here (~75k on the bartowski quant alone), so it is the best
validated.

Also surveyed and rejected: `Qwen3-235B-Distill` (no ≤9B GGUF exists),
`Nemotron-Orchestrator-8B-DeepSeek-v3.2-Speciale-Distill` (5.03GB and a clean MIT teacher, but the
repo publishes no licence, so the chain cannot be established), and the several
`Nemotron-Cascade-8B-…-Claude-4.5-Opus-Distill` builds, which are back in the api-distill category.

Both open-teacher entries are reasoning/thinking models, so the same latency caveat applies and the
pilot measures it.

`tools/scripts/pilot-onboarding-models.mjs` scores each candidate on the real onboarding prompts:
schema conformance, question distinctness across five different people, grounding in the user's own
work, self-report avoidance, quadrant-coverage obedience, assessment sanity, and median latency.
Run with `--pull` to fetch missing models first.

## Workstream C — Mad-lib intro composer

**C1.** Define `MadLibTemplate` in `libs/models`: an ordered list of segments, each either literal
text or a slot `{ field, slotType: 'inline' | 'choice' | 'list', options?, placeholder? }`, with
every slot mapped 1:1 to an `OnboardingProfileSuggestions` field.

**C2.** Build `MadLibComposerComponent` that renders the sentence as real prose with inline editable
slots. List slots (industries, problems solved, outcomes, skills, outreach methods) render as chip
editors with an explicit "add" affordance so users can enumerate bullets. Choice slots render as
inline selects seeded from the existing question options.

**C3.** Emit both the composed sentence (for `madLibSummary`) **and** a structured field patch.

**C4.** Teach `analyzeMadLib` to take the structured patch: explicit slots merge directly with
source `mad-lib`, and the LLM is asked to infer only the fields the user left blank. This retires
the fragile regex extraction for anything the user actually filled in.

**C5.** Keep a "write it as a paragraph instead" escape hatch onto the current textarea path.

**C6.** Tests: composer emits the correct field patch; backend prefers explicit slots over inferred
values.

**C7.** _(Caught in review.)_ Keep frontend imports from `@optimistic-tanuki/models` type-only.

### Implementation notes (2026-08-19) — Workstream C done

- `libs/models/.../mad-lib-template.interface.ts`: `MadLibTemplate`, `MadLibSegment`,
  `MadLibComposition`, `MadLibAnalysisRequest`. Slot `field` is typed as
  `keyof OnboardingProfileSuggestions`, so a slot cannot bind to a field that does not exist.
- `apps/leads-app/src/app/mad-lib-composer.component.ts`: renders the scaffold as always-visible
  prose. Inline slots are auto-sized inputs, choice slots are selects, and the five list slots
  (industries, problems, outcomes, skills, outreach) are chip editors with Enter/comma to add,
  Backspace to remove the last, and a `datalist` of suggestions where the template supplies options.
- Emits `{ sentence, values, unfilledFields }`. Blank slots are omitted from `values` entirely and
  render as `[label]` in the sentence so the scaffold stays readable while incomplete.
- `analyzeMadLib` now takes `string | MadLibAnalysisRequest`. Explicit slot values overwrite anything
  inferred for the same field; `pruneEmpty` drops blank slots first so an empty slot can never wipe
  out a value the inference did find. The freeform textarea path sends no composition and stays on
  the original inference-only route.
- **C7 — the interesting bug.** `DEFAULT_MAD_LIB_TEMPLATE` is a runtime value, and every previous
  leads-app import from `@optimistic-tanuki/models` was type-only, so TypeScript erased it and the
  barrel never loaded at runtime. Importing one const pulled the whole barrel in — TypeORM entities
  included — and four unrelated suites died with `ColumnTypeUndefinedError`, `app.component.spec`
  among them. Fixed by moving the const to `apps/leads-app/src/app/mad-lib-template.ts` and making
  the frontend's model imports `import type`. Worth remembering: the models barrel is not safe to
  import as a value from browser code.
- Verified: leads-app 101/101 (15 suites) · lead-tracker 94/94 (22 suites) · lint clean across
  leads-app, lead-tracker, models, leads-feature-onboarding, gateway · all three builds pass.

## Running the stack

```bash
pnpm run build:dev        # build all dev artifacts
pnpm run docker:dev       # bring the stack up
pnpm run docker:dev:seed  # seed it
```

Local `nx serve leads-app` is fine for design work on unauthenticated routes only; anything
exercising a real auth round-trip needs the docker stack.

## Workstream D — Discovery sources

**D1.** Introduce a declarative **source registry** — one descriptor per source carrying id, display
name, legal basis (public API / published feed / keyed API), auth requirement, rate limit,
attribution requirement, supported discovery intents, and a health-probe URL. Both the backend
provider wiring and the topics UI read from it.

**D2.** Retire the `indeed` and `clutch` providers (403 walls, ToS breach). Ship a migration that
moves existing topics off them and a UI notice explaining the change.

**D3.** Rename the existing `crunchbase` provider to `funding-news` so the label matches what it
actually fetches (Google News RSS). Keep the signal, fix the name.

**D3b.** Add a _real_ Crunchbase provider if a usable free tier exists. Crunchbase's Basic API is
commercial; verify before building, and if no free tier applies, record the finding and stop there
rather than shipping another provider that cannot deliver what its name promises.

**D4.** Fix or retire `justremote`; its XML feed no longer exists.

**D5.** Implement the probed replacements: Arbeitnow, Remotive, The Muse, HN Who-is-Hiring, and the
Greenhouse/Lever per-company ATS boards, reusing the existing `provider-http.util` and
`provider-query.util` shapes.

**D5b.** Keep Google Places as a keyed source and give it an explicit job: **find local businesses
with gaps**. Score each result on absent or weak web presence — no `website` field, no reviews, low
review count, no hours — and surface the specific gap on the lead so the pitch writes itself. Add
keyless OSM Overpass alongside it for coverage where no key is configured.

**D6.** Render source attribution in the lead detail view for RemoteOK and Jobicy, whose terms
require it.

**D7.** Add a `probe-sources` target that hits every descriptor's health probe and reports status,
so a dead feed surfaces as a failing check instead of silent zero results.

**D8.** Streamline results: dedupe across sources on normalised (company, title, url host) and
collapse the per-provider warning noise into a single discovery report.

**D9.** Delete `apps/leads-app/src/app/dummy-data.ts`.

## Workstream E — Tailored resume + cover letter

**E1.** Add `LeadApplicationCommands` message patterns to `lead-tracker`: `GENERATE_RESUME`,
`GENERATE_COVER_LETTER`, `REGENERATE_SECTION`.

**E2.** Inputs are the stored onboarding profile (skills, `roleSummaries`, outcomes,
certifications — the resume parser already produces these) plus the target lead (title, company,
description, matched terms).

**E3.** The LLM returns **structured JSON** — summary, per-role highlights, skills ordered by
relevance to the posting, and an explicit gap list — never free-form prose, so each section can be
rendered and regenerated independently.

**E4.** Hard anti-fabrication rule: generation may only reorder and re-emphasise facts present in
the parsed resume. Employers, dates, and credentials are never invented. Requirements with no
supporting evidence go into a visible "not evidenced in your resume" list rather than being papered
over.

**E5.** Persist generated documents per (profile, lead) with version history — entity + migration.

**E6.** UI: a new tab in `lead-detail-modal.component.ts` showing posting requirements beside your
evidence, the generated draft, and per-section regenerate.

**E6b.** Export the generated resume and cover letter as **OpenDocument Text (`.odt`)** and **Word
(`.docx`)**. Both are ZIP-plus-XML containers that can be written server-side without a headless
office runtime — pick one library per format and generate from the structured JSON of E3, so the
document keeps real heading/paragraph styles rather than a flattened text dump.

**E7.** The cover letter takes tone from `communicationStyle` and the DISC assessment.

**E8.** Tests: assert generated skills ⊆ (profile skills ∪ resume-derived skills); assert a
deterministic fallback when Ollama is unavailable.

---

## Verification

```bash
pnpm exec nx lint leads-app lead-tracker
pnpm exec nx test leads-app
pnpm exec nx test lead-tracker
pnpm exec nx build leads-app
pnpm run ui:heuristics:ci      # leads-app must stay pinned at 0 findings
```

Plus Chrome-agent screenshots at 1440 / 1024 / 768 / 390 for Workstream A, and the new
`probe-sources` target for Workstream D.

## Risks

- **Local model quality.** Every adaptive path (B, C, E) depends on Ollama returning valid JSON.
  `parseJsonObject` already tolerates code fences and prose padding, but B and E need retry plus a
  deterministic fallback or the flows stall.
- **Anti-fabrication is the load-bearing requirement in E.** A resume generator that invents
  employment is worse than no generator. The subset assertion in E8 is the gate.
- **Per-company ATS sources (Greenhouse, Lever) need a company list**, which the onboarding profile
  does not collect today. Either derive it from `targetCompanies` or add a step.
- **Removing sources changes existing users' topics.** D2 needs the migration and the notice, not
  just a code deletion.

## Decisions (2026-08-19)

1. **Crunchbase** — rename the existing provider to `funding-news`, and add a genuine Crunchbase
   provider if a free tier exists (D3 / D3b).
2. **Google Places** — keep it, keyed, with an explicit purpose: surface local businesses whose web
   presence has gaps (D5b).
3. **Export formats** — OpenDocument Text (`.odt`) and Word (`.docx`) for generated documents
   (E6b).

## Why `LeadDiscoverySource` exists twice (2026-08-20)

`libs/models` and `libs/leads/contracts` both define `LeadSource`,
`LeadDiscoverySource`, `LeadStatus`, `LeadFlagReason`, and
`LeadTopicDiscoveryIntent`. This is structural, not an oversight:

|         | `libs/models`         | `libs/leads/contracts`                                      |
| ------- | --------------------- | ----------------------------------------------------------- |
| tags    | `visibility:internal` | `visibility:publishable`                                    |
| package | not published         | `@optimistic-tanuki/leads-contracts`, `private: false`, MIT |
| holds   | TypeORM entities      | pure DTOs and enums                                         |

`leads-contracts` is a real publishable package. It cannot import from `models`
without either breaking on publish or exposing TypeORM entities to external
consumers, and the workspace's `type:contracts → type:util` boundary rule
enforces that. The same constraint is why `AspirationalCompany` is declared in
both libs rather than shared.

**The gap that did need fixing:** nothing guarded the copies against drift, and
drift is silent _and_ dangerous here — these values are persisted as a Postgres
enum, so a member present in one lib and missing from the other fails at the
database boundary at runtime rather than at compile time.
`apps/lead-tracker/src/app/leads-contract-parity.spec.ts` now asserts the two
sets are identical. It lives in lead-tracker because that is one of the few
projects permitted to import both libs. Verified by deliberately removing a
member from one copy and confirming the spec fails.

## Stack verification findings (2026-08-20)

Running the full docker stack surfaced four defects that unit tests, lint, and
UI inspection all missed. Each was only reachable with a real gateway round-trip.

**Sessions did not survive a reload.** The session lives in an httpOnly cookie,
so the only way to know whether a user is signed in is to ask the gateway —
and nothing did that at bootstrap. A hard load, a deep link, or a refresh all
came up anonymous. Fixed in `apps/leads-app/src/app/app.config.ts` with
`provideAppInitializer` (not the `APP_INITIALIZER` deprecated in Angular 19)
calling `restoreSession()` before the first guard runs, browser-platform only.

**Eight migrations had never been applied.** `GET /api/leads/topics` returned
500 on `column LeadTopic.aspirationalCompanies does not exist`, while
`migration:run` reported "No migrations are pending". `migration:show`
contradicted it, listing eight unapplied migrations, and was correct — applying
them fixed the endpoint and created the missing `lead_applications` table.
Prefer `migration:show` when diagnosing: it prints `[X]`/`[ ]` per migration.

**Every topic creation was rejected by validation.** In
`libs/models/src/lib/libs/leads/create-lead-topic.dto.ts`,
`aspirationalCompanies` had been inserted between a `@ValidateIf` and the
property it guarded. `googleMapsCities` therefore lost its condition and became
unconditionally required with `@ArrayMinSize(1)`, so no topic could be created
without Google Maps cities. The stray guard was wrong on its own terms too: it
tied dream-company targets to `GOOGLE_MAPS` rather than the ATS boards.
`aspirationalCompanies` is now `@IsOptional()` and `googleMapsCities` has its
guard back.

**The e2e suite depended on a developer's own login.** The signed-in tests read
`E2E_EMAIL`/`E2E_PASSWORD` and skipped silently without them — and the account
they expected does not exist on a seeded stack. They now register a throwaway
account per test through the API, matching the `authe2e_*` pattern used
elsewhere in the repo, and seed a topic to satisfy the onboarding gate (which
is just `leads === 0 && topics === 0`). No credentials, no out-of-band setup.

Result: 19/19 e2e (was 16/19), 152/152 lead-tracker unit tests across 27
suites, 101/101 leads-app, lint clean across 7 projects.

### Migration ordering — fixed 2026-08-20

`apps/lead-tracker/` numbers migrations by date (`YYYYMMDD#####`, e.g.
`2026060300000`) rather than by `Date.now()` epoch milliseconds. It is the only
service in the monorepo that does. A dated number is numerically larger than a
present-day epoch one, so every migration `typeorm migration:generate` produced
sorted _ahead_ of the dated migrations it depended on.

This was a hard blocker, not a style inconsistency: a fresh database could not
be built at all. `AddOnboardingDiscTranscript` ran before the migration that
creates `lead_onboarding_profiles` and failed with
`relation "lead_onboarding_profiles" does not exist`. Every existing database
already had the old migrations applied, so nothing failed locally and no test
caught it — only CI and a new developer build from nothing.

Fix: the eight generated migrations were renumbered onto the dated convention
(`2026082000000`–`2026082007000`), filenames and class-name suffixes together.
The seven committed `2026033000000`–`2026060300000` migrations were deliberately
left alone — renaming those orphans the ledger row in every database that has
already applied them, whereas the eight were still uncommitted and existed only
in this working tree.

Verified against a throwaway database: all 20 migrations apply in order, a
second run is a clean no-op, and `migration:generate` reports no drift against
the entities.

`scripts/validate-typeorm-migrations.mjs` now rejects any lead-tracker
migration numbered in the epoch-ms range and prints renaming instructions, so
the next `migration:generate` cannot reintroduce this silently. That validator
already runs in CI (`.github/workflows/ci-cd.yml`) and in
`scripts/setup-and-migrate.sh`, which is why the rule lives there rather than in
a separate spec.

Note this is a documented deviation from "do not hand-create migration
timestamps" in AGENTS.md: the migrations themselves are all CLI-generated, but
their timestamps must be renamed afterwards to fit this service's dated
convention. The validator is what keeps that from being an ad-hoc habit.

### Dev database ledger — reconciled 2026-08-20

The rename left the dev database holding eight ledger rows under the pre-rename
names. It was reconciled by tearing the stack down with its volumes removed
(`docker compose ... down -v`) and rebuilding end to end.

Note that `pnpm run docker:dev:reset` alone does _not_ do this: the database
lives in the named volume `optimistic-tanuki_postgres_data`, and the script only
passes `--renew-anon-volumes`. Clearing it requires `down -v` explicitly.

Confirmed afterwards: all 20 lead-tracker migrations applied in order against an
empty database, `migration:show` reads 20 applied / 0 pending,
`migration:generate` finds no drift against the entities, seeding completed, and
the full e2e suite passed 19/19 against the rebuilt stack. The schema is
reproducible from migrations alone.

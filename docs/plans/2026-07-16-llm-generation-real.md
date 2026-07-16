---
title: Make the LLM Claims Real — Signal Foundry / marketing-generator
date: 2026-07-16
status: implemented (2026-07-16 — all three phases, verified end-to-end against a mock Ollama)
summary: Turn the marketing generator's template-only "concept generation" into genuine LLM authorship with schema-validated responses, token/cost usage tracking, a sane prompt-proxy timeout, and docs that describe what actually ships (audit Domain 5).
---

# Make the LLM Claims Real — Signal Foundry / marketing-generator

## Context

The 2026-07-14 audit scored AI & Marketing Generation 6/10: "'LLM-powered' concepts are
actually 6 hardcoded templates; no cost tracking." Concept generation maps over six
`CONCEPT_ANGLES` templates client-side; the LLM only _polishes_ that output through an
optional enrichment pass. A previous remediation already added honest provenance labels
(`template-only` / `ai-enriched` / `ai-fallback`), so the UI no longer overclaims — but the
audit's real ask stands: **make generation actually LLM-driven**, validate LLM responses,
and track token usage/cost.

## Verified state (2026-07-16)

1. **Template engine (client)** — `apps/marketing-generator/src/app/services/marketing-generator.service.ts`:
   six `CONCEPT_ANGLES`, fully deterministic concepts, `generationMode: 'template'`.
2. **Enrichment layer (SSR)** — `marketing-enrichment.server.ts`: posts Ollama-protocol
   `/api/chat` (default host `prompt-proxy:11434`, model `gemma3`, 120s timeout from
   `assets/config.yaml`), `format: 'json'`; extracts JSON by regex and `JSON.parse`s it with
   **no schema validation**; any failure is a silent `catch { return concepts }`. The
   configured `temperature` is loaded but **never sent** (no `options` in the request body).
   Deterministic merge by preserved ids into the template concepts, mode → `'hybrid'`.
3. **SSR endpoint** — `src/server.ts` `POST /api/marketing-generator/enrich`; the client
   (`marketing-enrichment-api.service.ts`) falls back to raw concepts on any HTTP error.
4. **Flow & honesty** — `create-page.component.ts`: `includeAiPolish` toggle → enrich →
   `applyProvenance` (`template-only` / `ai-enriched` / `ai-fallback`); results page shows a
   provenance pill. `GenerationMode = 'template' | 'hybrid'`.
5. **No usage tracking anywhere** — nothing reads Ollama's `prompt_eval_count` /
   `eval_count`; no counters, no logs, no UI surface. `marketing-insights.service.ts` is a
   localStorage event log that could carry usage metadata.
6. **prompt-proxy** — `apps/prompt-proxy/src/app/app.service.ts` hardcodes a 3,600,000 ms
   (1-hour) HTTP timeout and logs raw responses; no usage capture.
7. `zod@4.3.5` is a workspace dependency, unused in this app.

## Design

### A. LLM authorship (server)

Keep the template engine as the **scaffold and fallback** — it defines structure (ids,
sections, channel blocks, material surfaces) that exports and previews depend on. Add a
generation pass where the LLM **authors the creative copy** into that scaffold from the
brief: headline, subheadline, section bodies, channel output blocks, material text blocks,
and image prompts. Same deterministic id-preserving merge as enrichment (proven pattern),
but the system prompt directs authorship from the brief rather than light polish, and the
merged mode is `'llm'`.

- `marketing-llm.schemas.ts`: zod schemas for the enrichment payload and the generation
  payload; parse → validate → merge. Invalid or unparseable responses are structured
  failures that trigger fallback (no more regex + blind `JSON.parse`).
- Send `options: { temperature }` from config (fixes the dead config value).
- Capture usage per call from the Ollama response (`model`, `prompt_eval_count`,
  `eval_count`, `total_duration`) and return it to the caller.
- Prompt-injection guard: cap length and strip control characters on brief-derived
  free-text fields before they are embedded in prompts.
- `server.ts`: new `POST /api/marketing-generator/generate`; `/enrich` response gains
  `usage`; cumulative in-process counters exposed at `GET /api/marketing-generator/usage`.

### B. Honest UI wiring (client)

- `GenerationMode` gains `'llm'`; provenance gains `'ai-generated'`.
- API service gains `generateConcepts()` (calls `/generate`, graceful fallback), both calls
  surface `usage`.
- `create-page`: the AI toggle now attempts LLM authorship first; provenance becomes
  `ai-generated` when applied, `ai-fallback` when the LLM was unreachable/invalid,
  `template-only` when the toggle is off. Token usage recorded on the generation insight
  event and shown in the results/insights UI.
- Results page: label + description for `ai-generated`; usage display.

### C. Boundary hygiene + docs

- prompt-proxy: timeout from `PROMPT_PROXY_TIMEOUT_MS` (default 120,000 ms — replaces the
  hard-coded hour); structured usage log line (model, prompt/eval token counts, duration)
  for every successful response.
- Docs (`docs/marketing/signal-foundry.md`, `docs/getting-started/mvp-overview.md`):
  describe the real modes — template scaffold, optional LLM authorship, provenance labels,
  token usage visibility.

## Sequencing & ownership

| Phase               | Scope                                                    | Files                                                                                                                                              | Agent  |
| ------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| A                   | LLM authorship, zod validation, usage capture, endpoints | `marketing-enrichment.server.ts`, new `marketing-llm.schemas.ts` (+ generation server file if split), `server.ts`, server specs                    | Opus   |
| C (parallel with A) | prompt-proxy timeout + usage log; docs alignment         | `apps/prompt-proxy/*`, 2 docs files                                                                                                                | Sonnet |
| B (after A)         | Types, API service, create/results pages, insights usage | `types.ts`, `marketing-enrichment-api.service.ts`, `create-page.component.ts`, `results-page.component.ts`, `marketing-insights.service.ts`, specs | Sonnet |

Out of scope (deliberately): swapping Ollama for a hosted provider (config/env already
selects host/model; the platform is self-hosted-first), ai-orchestrator model-per-task
tuning, and billing integration for token costs (no tenant context in this SSR server —
usage is surfaced, not billed).

## Success criteria

- With the LLM reachable: concepts carry `generationMode: 'llm'` / provenance
  `ai-generated`, the creative copy differs from the template scaffold, and the response
  reports non-zero token usage that the UI displays.
- With the LLM down or returning invalid JSON: schema validation rejects, generation falls
  back to templates, and provenance honestly reads `ai-fallback` (test-enforced).
- No code path merges LLM output without zod validation.
- prompt-proxy timeout is configurable with a 120s default, and every LLM round-trip
  through it logs token usage.
- Docs describe exactly this behavior.

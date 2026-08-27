# Signal Foundry

![category](https://img.shields.io/badge/category-marketing-a855f7?style=flat-square)
![personality](https://img.shields.io/badge/personality-electric-f59e0b?style=flat-square)
![project](https://img.shields.io/badge/project-marketing--generator-6c7ce0?style=flat-square)
![maturity](https://img.shields.io/badge/maturity-active-3b82f6?style=flat-square)

Signal Foundry is the public-facing positioning for `marketing-generator`: a campaign workbench that turns product context into repeatable marketing output.

## Visual Identity

| Attribute           | Value                                                                               |
| ------------------- | ----------------------------------------------------------------------------------- |
| Default personality | `electric` — vibrant, kinetic, warm, conversational                                 |
| Why                 | A marketing workbench should feel as energetic as the campaigns it produces.        |
| Typography          | DM Serif Display headings, Work Sans body                                           |
| Borders & shadows   | Medium (2px) borders, neon glow shadows                                             |
| Animation           | Pulsing, normal speed                                                               |
| Catalog reference   | [`docs/design-system/personalities.md`](../design-system/personalities.md#electric) |

## Audience

- operators packaging a product or service for market
- platform or product teams that need consistent launch materials
- marketers who want a reusable workbench instead of one-off prompt sessions
- founders or agencies turning technical product context into buyer-ready materials

## Promise

Turn a structured brief into strategy directions, coordinated channel drafts, material assets, and export-ready campaign output that can be refined over time.

## Workflow

1. Capture the offer, audience, strategy, outputs, brand, and review needs in a structured brief.
2. Generate multiple campaign directions and compare the strongest concepts.
3. Refine the winning direction across web, email, social, and material formats.
4. Export the campaign package and preserve history for future iteration.

## Generation Modes

Every concept starts from a deterministic six-angle template scaffold — the structure (ids,
sections, channel blocks, material surfaces) that previews and exports depend on. An optional
AI pass can then operate at one of two levels:

- **AI authorship** — an LLM writes the creative copy (headline, subheadline, section bodies,
  channel output blocks, material text, image prompts) directly from the brief into the
  scaffold. Labeled `AI-generated` in the UI.
- **AI enrichment** — a lighter LLM pass polishes the template output without full authorship.
  Labeled `AI-enriched`.

Every LLM response is schema-validated (zod) before it is merged into a concept. If the model
is unreachable or returns an invalid payload, generation falls back to the template scaffold
and is labeled honestly as `AI-fallback` rather than silently pretending the AI pass ran.
Token usage (prompt and completion counts) is captured for every LLM call, aggregated per
process, and surfaced in the UI and at `GET /api/marketing-generator/usage`.

## Proof

- six-step brief covering offer, audience, strategy, outputs, brand, and review
- concept gallery with shortlist, compare, and winner-selection workflow
- coordinated bundles across web, email, and social channels
- editable flyer, brochure, business-card, and web-ad materials with export support
- workspace history, restore points, and local-first refinement telemetry
- schema-validated AI authorship and enrichment passes with honest fallback labeling and
  visible token-usage reporting

## Deployment Posture

Signal Foundry runs as the `marketing-generator` app in the same Nx workspace, SSR delivery model, shared gateway posture, and container workflow used elsewhere in the portfolio.

## Proof Of Platform Case Study

Signal Foundry is also the clearest proof-of-platform story in the repo: it is a full marketing campaign workbench built on the same stack being offered to developers and operators.

That matters because it shows the platform can already carry:

- a structured, multi-step operator workflow
- export-heavy frontend behavior with editable outputs
- shared gateway and service integration patterns
- real product delivery in the same Nx monorepo and deployment workflow used elsewhere in the portfolio

For external conversations, frame Signal Foundry as evidence that the platform is already supporting a real, opinionated application instead of a speculative developer platform pitch.

## Call To Action

Bring one launch brief into Signal Foundry, choose a direction from the generated concept set, refine the winning campaign, and export the package your team can actually ship.

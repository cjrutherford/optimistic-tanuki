---
description: Generate a platform pitch narrative for operators, platform teams, or technical evaluators. USE WHEN a user asks to write a pitch deck narrative, an operator overview, a sales brief, a capabilities overview, or a "why this platform" document aimed at teams evaluating the Optimistic Tanuki platform as infrastructure for their own products or deployments.
argument-hint: '[--audience operators|platform-teams|technical-evaluators|agencies] [--format pitch-deck|one-pager|capabilities-brief|demo-script] [--focus products|services|deployment|packages|all]'
---

# Generate Platform Pitch Narrative

You are a platform evangelist and technical writer for Optimistic Tanuki. Your job is to produce a compelling, technically credible platform narrative for teams and operators evaluating whether to adopt this stack.

## Context

- **Audience and format:** ${input:args}

## Ground Truth Files

Read these files before generating any content. All claims must be traceable to them.

- `docs/marketing/messaging-pillars.md` — positioning, 5 pillars, pitch flow, FAQ
- `docs/marketing/repo-story.md` — full portfolio-platform-proof narrative
- `PRODUCT.md` — product table, platform proof table, positioning, visual story
- `docs/marketing/platform-product-matrix.md` — product comparison and deployment posture
- `docs/marketing/service-offerings.md` — hosted vs. self-hosted framing
- `docs/marketing/pricing-models.md` — pricing vocabulary
- `tools/admin-env-wizard/README.md` — deployment compiler details
- `docs/marketing/admin-env-demo-script.md` — operator walkthrough from catalog to running gateway
- `docs/architecture/README.md` — full service architecture and technology stack

## Audience Calibration

| Audience | Lead with | Depth |
|---|---|---|
| `operators` | Deployment automation, catalog-driven environments, self-hosted posture | Technical, operational |
| `platform-teams` | Composable services, gateway composition, shared auth/billing | Technical, architectural |
| `technical-evaluators` | Proof points: Signal Foundry as working platform case study, AI service, design system | Technical, breadth-first |
| `agencies` | Five named products as deployable client-facing outcomes, personality system | Business + technical |

## Format Guidance

### `pitch-deck` (slide narrative)

Produce a slide-by-slide narrative (no actual deck tooling):

1. **Problem** — what problem teams face without a platform like this
2. **Solution** — Optimistic Tanuki in one positioning statement
3. **Products** — the five named products with one-line promises
4. **Platform** — composable services, design system, deployment automation
5. **Proof** — Signal Foundry as proof-of-platform; working services; Go deployment wizard
6. **Developer path** — npm packages, billing SDK, gateway API
7. **Deployment** — Docker Compose, Kustomize, ArgoCD, GitHub Actions pipeline
8. **Adoption paths** — three ways to adopt (product, service layer, packages)
9. **Boundaries** — honest current state (no published pricing, no implied hosted demo)
10. **CTA** — repo link, demo script, developer portal

Each slide: one headline, 2–4 supporting bullets, one proof citation.

### `one-pager`

Single page (A4 density). Structure:

- Positioning statement (2 sentences)
- Five products in a 2-column table (product name, audience, one-line promise)
- Platform capabilities (5 bullet points, one per messaging pillar)
- Adoption paths (3 bullets)
- Technology stack snapshot (Angular, NestJS, PostgreSQL, Go, Docker, Kubernetes, AI/LangChain)
- Contact / repo line

### `capabilities-brief`

Structured technical overview:

1. Service catalog (list all services with port/role from `docs/architecture/README.md`)
2. Gateway composition model (how services are toggled per deployment)
3. AI orchestration (multi-model routing, MCP, LangChain/LangGraph)
4. Design system (12 personalities, product mapping, runtime switching)
5. Deployment automation (admin-env-wizard, providers, outputs)
6. Public package surface (current active packages and wave-1 candidates)
7. CI/CD pipeline (GitHub Actions, Kustomize, ArgoCD)

### `demo-script`

Follow the structure from `docs/marketing/admin-env-demo-script.md` as the model. Produce a step-by-step narrated walkthrough for the target audience:

- Operators: catalog selection → generated output → running gateway
- Platform teams: gateway composition → service toggle → API surface
- Technical evaluators: Signal Foundry workflow → AI orchestration → export

## Pitch Flow Rule

Always follow this order in external conversations (from `docs/marketing/repo-story.md:95-102`):

1. Lead with the buyer's product problem.
2. Name the relevant product and its workflow.
3. Show the platform underneath as credibility proof.
4. Use deployment tooling and packages as proof for technical audiences.
5. Be explicit about current boundaries.

## Messaging Pillars (Summary)

Use these five pillars as the backbone of any platform narrative. Full detail in `docs/marketing/messaging-pillars.md`.

1. **Five products, one platform** — proven through real product surfaces, not abstractions
2. **Shared services, distinct identities** — 12 personalities, one Angular component set
3. **Catalog-to-deployment in one command** — Go-based admin-env-wizard, no hand-maintained environment files
4. **AI is a service, not a feature flag** — multi-model orchestrator, MCP, LangChain/LangGraph, first-class deployment citizen
5. **Start with what you need** — product, service layer, or npm package — three documented adoption paths

## Constraints

- Do not imply live hosted demos, published pricing, or fully published npm packages unless separately confirmed.
- Maturity language: use "active product surface," "active campaign workbench," or "active with usability hardening in progress."
- AGPL-3.0 is the repository license. Frame it as: "open deployment path; review LICENSE before reuse."
- Signal Foundry is the clearest proof-of-platform case study. Lead with it when proving the platform claim to technical evaluators.

Source: `docs/marketing/messaging-pillars.md`, `PRODUCT.md:96-101`, `GOVERNANCE.md:22-26`

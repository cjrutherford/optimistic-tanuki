---
title: Messaging Pillars
summary: Core positioning statement, messaging pillars, elevator pitch, and FAQ outline for the Optimistic Tanuki portfolio.
category: marketing
section: marketing
tags:
  - marketing
  - positioning
  - pillars
  - pitch
  - faq
---

# Messaging pillars (internal draft)

**Status:** Internal positioning draft. Not approved for public use while RR-12 is unaccepted.

RR-01 is the authority for OT/TS public claim dispositions. The release owner must reconcile any proposed copy with the accepted RR-12 revision and the owning behavior evidence. This document and repository source presence do not approve claims.

## Positioning Statement

> Internal direction only. Do not present this draft as approved launch copy while RR-12 is unaccepted.

> **Optimistic Tanuki is a web application portfolio and platform for community, local, planning, project, and marketing workflows.**
>
> The repository documents application, service-composition, and developer-package paths. Availability and support claims for a specific workflow or revision require current evidence.

_Source: `docs/marketing/repo-story.md:18-28`, `PRODUCT.md:3-6`_

---

## The Five Products

| Product               | Nx project            | Audience                              | Personality    | One-line promise                                                                                             |
| --------------------- | --------------------- | ------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------ |
| **Optimistic Tanuki** | `client-interface`    | People and interest communities       | `classic`      | A social space centered on people and shared interests, with communities as an option.                       |
| **Towne Square**      | `local-hub`           | People connected to a place           | `soft-touch`   | A place-centered product direction for local coordination and exchange.                                      |
| **Forge of Will**     | `forgeofwill`         | Individuals, small teams, consultants | `bold`         | Turn plans into visible progress in one focused execution workspace.                                         |
| **Fin Commander**     | `fin-commander`       | Households, advisors, finance teams   | `professional` | Move from account setup to usable financial plans and scenarios without losing context.                      |
| **Signal Foundry**    | `marketing-generator` | Marketers, product teams, agencies    | `electric`     | Turn a structured brief into strategy directions, channel drafts, material assets, and a refinement history. |

_Source: `PRODUCT.md:51-58`, `docs/marketing/platform-product-matrix.md:7-21`_

---

## Core Pillars

### Pillar 1 — Five products, one platform

**Headline:** Five products share platform infrastructure.

**Body:** The repository contains named applications, shared services, design-system code, and deployment tooling. Product maturity and accepted workflows vary. Describe a specific capability only when its owning release evidence supports it.

**Proof:** `client-interface`, `local-hub`, `forgeofwill`, `fin-commander`, `marketing-generator` all ship from one Nx monorepo sharing gateway, auth, billing, payments, social, profile, AI, and video services. `PRODUCT.md:78-84`, `docs/marketing/repo-story.md:63-78`.

---

### Pillar 2 — Shared services, distinct identities

**Headline:** Shared components support distinct product identities.

**Body:** The shared theme system defines product personalities and visual tokens. Avoid claims that every component, screen, or accessibility behavior is complete without matching evidence.

**Proof:** `docs/design-system/personalities.md`, `libs/theme-models/src/lib/personalities.ts`, `libs/theme-models/src/lib/product-personalities.ts`. _PRODUCT.md:68-74_.

---

### Pillar 3 — Catalog-to-deployment in one command

**Headline:** Generate deployment artifacts from catalog selections.

**Body:** The Go-based admin environment wizard generates deployment artifacts from catalog selections. Describe supported outputs and provider targets from current tool documentation; do not imply a particular production deployment or accepted served revision without release evidence.

**Proof:** `tools/admin-env-wizard/README.md:1-42`, `docs/marketing/admin-env-demo-script.md`, `README.md:101-119`.

---

### Pillar 4 — AI is a service, not a feature flag

**Headline:** AI orchestration is part of the platform codebase.

**Body:** The repository includes an AI orchestrator and related integrations. Do not imply hosted availability or a production service commitment unless separately verified.

**Proof:** `apps/ai-orchestrator/README.md`, `apps/gateway/README.md:55-58`, `docs/architecture/README.md:189-197`.

---

### Pillar 5 — Start with what you need

**Headline:** Adopt a product. Deploy selected services. Install a package. Your call.

**Body:** The repository documents application, platform, and package paths. Confirm each package's current publication and each deployment path's tested status before making an external availability claim.

**Proof:** `docs/marketing/repo-story.md:16-28`, `docs/marketing/npm-developer-packages.md`, `apps/developer-portal/README.md`.

---

## Elevator Pitch (60 seconds)

> Internal draft. Reconcile every OT/TS workflow claim with RR-01 and accepted RR-12 evidence before external use.

> The Optimistic Tanuki repository brings applications, shared services, and deployment tooling together in one codebase.
>
> Product maturity and accepted workflows vary. Optimistic Tanuki centers on people and interests, with communities as an option. Towne Square centers on locality and early-access local exchange. Do not describe either as finished or launch-accepted while RR-12 remains open.
>
> The repository includes product applications, platform services, deployment tools, and developer packages. Check current support and release evidence before describing an option as available.
>
> The shared theme system defines product identities, and the repository includes AI orchestration code. Verify licensing, deployment support, and service availability for the specific use before making a public claim.

---

## Tone and Voice Guidelines

| Dimension                                | Direction                                                                                                                                                                                                                                                              |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Clarity over cleverness**              | State the product benefit before the architecture. Buyers understand outcomes; platform complexity comes after.                                                                                                                                                        |
| **Use accepted evidence**                | For OT and TS, follow RR-01 dispositions and the accepted RR-12 revision. A README, service doc, test, or source file can locate evidence but does not prove acceptance.                                                                                               |
| **Honest about boundaries**              | Public pricing is posture and vocabulary, not a published price sheet. Hosted demos are not implied unless separately deployed.                                                                                                                                        |
| **Personality matches product**          | Towne Square copy should feel warm and community-oriented (soft-touch). Forge of Will copy should feel action-forward (bold). Fin Commander copy should feel clear and conservative (professional). Signal Foundry copy should feel energetic and creative (electric). |
| **Platform story follows product story** | Lead with the buyer's product problem. Name the relevant product. Then show the platform underneath as proof, not as the lead.                                                                                                                                         |

_Source: `docs/marketing/repo-story.md:95-102`, `docs/marketing/platform-product-matrix.md:23-27`, `GOVERNANCE.md:22-26`_

---

## FAQ Outline

### Product questions

**Q: What is the difference between the five products?**
Each targets a distinct workflow: Towne Square = local community and commerce; Forge of Will = project execution; Fin Commander = financial planning; Signal Foundry = marketing campaigns; Optimistic Tanuki client interface = general community and social surface. See `docs/marketing/platform-product-matrix.md`.

**Q: Can I deploy just one product without running everything?**
Yes. The admin-env-wizard supports capability-bundle selections. You choose the services for the product you want; the generator creates the matching Compose or Kubernetes output. `tools/admin-env-wizard/README.md:14-42`.

**Q: Are these finished applications or reference implementations?**
Product maturity varies by application and workflow. For Optimistic Tanuki and Towne Square, use the early-access wording and claim dispositions in RR-01; do not describe them as finished or launch-accepted while RR-12 remains unaccepted.

### Platform questions

**Q: What backend services are included?**
Gateway, authentication, billing, payments, social, profile, permissions, project-planning, finance, chat, blogging, assets, AI orchestrator, prompt proxy, and video. All share a PostgreSQL datastore and communicate over NestJS TCP message patterns behind the gateway. `docs/architecture/README.md`.

**Q: How does deployment work?**
The Go-based admin-env-wizard compiles capability selections into Docker Compose fragments, Kustomize base and overlays, gateway composition YAML, and runtime environment files. ArgoCD applies the overlay; GitHub Actions validates inventory parity. `README.md:101-119`.

**Q: What cloud providers are supported?**
Akamai, Vultr, and OCI are the documented provider targets in the admin-env-wizard. `tools/admin-env-wizard/README.md:17`.

**Q: Is there a self-hosted option?**
The repository contains Docker Compose deployment configuration. Confirm the supported deployment path and exact reviewed revision before describing it as a released or supported offering.

### Developer and package questions

**Q: Can I use parts of this without adopting the full monorepo?**
Yes. `@optimistic-tanuki/billing-sdk`, `@optimistic-tanuki/billing-contracts`, and `@optimistic-tanuki/app-catalog-contracts` are the current public package surface, published via a mirror repository. Wave-1 candidates include constants, logger, encryption, and leads-contracts. `docs/marketing/npm-developer-packages.md`.

**Q: What license covers the code?**
Applications and services: AGPL-3.0. Publishable npm packages: MIT. Review `LICENSE` before reuse.

**Q: How are packages released?**
Source development stays in this monorepo. The mirror repository owns versioning and npm publication. The monorepo validates publishable package boundaries and metadata before sync or release flows run. `docs/marketing/npm-developer-packages.md:56-62`.

### Design system questions

**Q: Do all five products look the same?**
No. Each ships with a distinct personality that reshapes typography, spacing, border radius, animation, shadow, and color harmony. Towne Square uses `soft-touch` (pill controls, Quicksand + Nunito); Forge of Will uses `bold` (heavy Poppins, dramatic shadows); Signal Foundry uses `electric` (neon glow, DM Serif Display). `docs/design-system/personalities.md:40-68`.

**Q: Can operators or users change the personality?**
Yes. The theme service allows runtime personality switching. Each product declares a canonical default; operators and users can override it. `PRODUCT.md:72-74`.

### AI questions

**Q: What AI capabilities are included?**
A multi-model AI orchestrator with tool-call routing, MCP tool integration, LangChain/LangGraph agent coordination, and thinking-token filtering. It is a platform service exposed through the gateway. `apps/ai-orchestrator/README.md`.

**Q: Is AI required to run the platform?**
No. The gateway is composition-aware. AI orchestration can be included or excluded per deployment via the gateway composition YAML. `apps/gateway/README.md:55-58`.

---

## Key Reference Files

| File                                        | Use                                                                         |
| ------------------------------------------- | --------------------------------------------------------------------------- |
| `PRODUCT.md`                                | Product portfolio map, personality table, platform proof table, positioning |
| `docs/marketing/repo-story.md`              | Full portfolio-platform-proof narrative and pitch flow                      |
| `docs/marketing/platform-product-matrix.md` | Buyer-facing product comparison by audience, workflow, maturity             |
| `docs/marketing/signal-foundry.md`          | Signal Foundry one-pager and proof-of-platform case study                   |
| `docs/marketing/towne-square.md`            | Towne Square one-pager                                                      |
| `docs/marketing/forge-of-will.md`           | Forge of Will one-pager                                                     |
| `docs/marketing/fin-commander.md`           | Fin Commander one-pager                                                     |
| `docs/marketing/npm-developer-packages.md`  | Developer package surface and release posture                               |
| `docs/marketing/service-offerings.md`       | Hosted vs. self-hosted service packaging vocabulary                         |
| `docs/marketing/pricing-models.md`          | Pricing shape vocabulary (metered, block, unlimited)                        |
| `docs/design-system/personalities.md`       | Personality catalog and distinctiveness matrix                              |
| `tools/admin-env-wizard/README.md`          | Deployment automation for operator and ops audiences                        |
| `docs/marketing/admin-env-demo-script.md`   | Live demo script: catalog selection to running gateway                      |

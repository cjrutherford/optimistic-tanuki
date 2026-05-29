# Optimistic Tanuki Product Portfolio

Optimistic Tanuki is a multi-product portfolio for community, local coordination, focused execution, financial planning, and developer-facing platform services, implemented as an Nx monorepo.

## Core Products

- **Optimistic Tanuki** (`client-interface`): the main community-owned social networking app for defined groups
- **Towne Square** (`local-hub`): local-first coordination, classifieds, and civic participation
- **Forge of Will** (`forgeofwill`): focused project execution with context, notes, and risk tracking
- **Fin Commander** (`fin-commander`): guided financial workflows for ledgers, plans, and scenarios
- **Signal Foundry** (`marketing-generator`): a marketing campaign workbench for briefs, concepts, exports, and refinement history
- **Developer Portal** (`developer-portal`): the MVP home for API docs, SDK onboarding, and metered usage visibility

## What The Portfolio Includes

The product surface is broader than the main apps:

- hosted services such as billing can be offered as managed infrastructure, with self-hosted Docker options where documented
- public libraries such as `@optimistic-tanuki/billing-sdk` are intended to be distributed through npm
- public npm packages are published from the mirror-repo workflow, not directly from this monorepo
- public and operator-facing apps share the same gateway, monorepo, and delivery workflow

## Audience

Optimistic Tanuki is aimed at operators and teams that need:

- durable community and collaboration tooling
- productized workflows instead of disconnected SaaS fragments
- self-hosted or controlled deployment paths where the product surface supports them
- a platform story that includes real applications, not only abstractions

## Proof Of Platform

Signal Foundry is the clearest proof-of-platform story in the repo: we built a full marketing campaign workbench on the same stack we are offering to developers and operators. It uses the same Nx workspace, shared gateway patterns, SSR delivery model, and product workflow discipline that back the rest of the portfolio.

## Where To Go Next

- contributor setup and workspace navigation: [README.md](./README.md)
- contribution workflow: [CONTRIBUTING.md](./CONTRIBUTING.md)
- project governance: [GOVERNANCE.md](./GOVERNANCE.md)
- documentation index: [docs/README.md](./docs/README.md)
- Signal Foundry positioning: [docs/marketing/signal-foundry.md](./docs/marketing/signal-foundry.md)

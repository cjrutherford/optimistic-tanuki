# Platform Product Matrix

This is an internal comparison draft, not approved buyer-facing copy. For Optimistic Tanuki and Towne Square, RR-01 owns claim dispositions and RR-12 must accept the reviewed revision before external promotion.

## At A Glance

| Product        | Best fit                                                            | Core promise                                                                            | Primary proof                                                                       | Current posture                     |
| -------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------- |
| Towne Square   | people connected to a place, local organizers                       | place-centered direction for local coordination and exchange                            | `local-hub` source paths; local workflows remain subject to RR-06/10 acceptance     | early access; RR-12 not accepted    |
| Forge of Will  | individuals, small teams, consultants, delivery operators           | planning context and daily execution in one focused workspace                           | `forgeofwill` frontend, `project-planning` backend, tasks, risks, journals, timers  | active product surface              |
| Fin Commander  | households, operators, accountants, advisors, finance-focused teams | guided path from account setup to scoped plans, imports, and scenarios                  | onboarding flow, `fin-commander-data-access`, `fin-commander-imports`, e2e coverage | active app with usability hardening |
| Signal Foundry | marketers, product teams, agencies, launch operators                | structured brief to campaign concepts, material drafts, exports, and refinement history | `marketing-generator` app, concept gallery, export/material workflows               | active campaign workbench           |

## Comparison Detail

| Product        | Audience                                                                     | Workflow                                                                                                                   | Billing posture                                                                                                                                                                    | Deployment posture                                                                                                                    | Maturity signal                                                         |
| -------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Towne Square   | People with a relationship to a place; local organizers                      | Locality browsing, classifieds, and messaging are described as early access; civic-feed behavior requires RR-07 acceptance | Do not promote funding, donations, sponsorships, payment/transaction promises, tiers, featured placement, or analytics. Core/locality access must not be conflated with donations. | Repository contains an Angular SSR app and deployment configuration; production revision and support posture require release evidence | Early access; RR-06/10 and RR-12 remain open                            |
| Forge of Will  | Individuals and small teams managing projects, planning, and execution       | projects, tasks, risks, journals, timers, and execution context                                                            | Commercial packaging is not yet published                                                                                                                                          | frontend plus `project-planning` backend in local Docker/Nx workflows; container deployment through repo build and deployment flows   | active product surface with dedicated frontend and backend support      |
| Fin Commander  | Operators, accountants, advisors, and planning-focused households or teams   | guided onboarding, scoped plans, scenarios, imports, workspace-aware finance flows                                         | Commercial packaging is not yet published                                                                                                                                          | monorepo app and library stack with Nx build/test flow and shared service dependencies                                                | active app with onboarding and usability improvements in progress       |
| Signal Foundry | Product teams, operators, and marketers creating repeatable launch materials | structured brief, concept gallery, bundled channel drafts, material assets, exports, workspace history                     | service-led packaging is the clearest current posture; formal public pricing is not yet published                                                                                  | local-first app in the monorepo with Nx build/test targets and the standard container workflow                                        | active campaign workbench with export and refinement workflows in place |

## How To Use The Matrix

- Lead with the product whose workflow matches the buyer's immediate pain.
- Use the shared platform story only after the buyer understands the product outcome.
- For developer or platform audiences, move from this matrix to [Repo Story](./repo-story.md), [npm Developer Packages](./npm-developer-packages.md), or [Admin Environment Wizard Demo Script](./admin-env-demo-script.md).
- Treat this matrix as internal guidance. Avoid presenting unpublished pricing, hosted demos, package publication, or locally present workflows as live commercial surfaces without direct evidence.
- Do not describe Towne Square civic-feed behavior or Daylight as released before RR-07 acceptance. General civic participation can remain product direction when clearly qualified.
- Do not claim donation, sponsorship, payment/transaction, business-tier, featured-placement, or analytics capabilities as released; RR-01 withdraws those claims and DF-002 keeps broader financial work deferred. This does not imply settled locality or baseline access is donation-dependent.
- Do not claim trusted/community-owned guarantees or reputation-based moderation; RR-01 withdraws these claims and DF-001 remains deferred.

## Default Personalities

Each product ships with a canonical [personality](../design-system/personalities.md) from the shared theme system. Users can swap personalities at runtime; the table below records the default identity the product is designed around.

| Product           | Default personality | Identity in one line                        |
| ----------------- | ------------------- | ------------------------------------------- |
| Optimistic Tanuki | `classic`           | Balanced, versatile baseline.               |
| Towne Square      | `soft-touch`        | Organic, warm, gentle neighborhood feel.    |
| Forge of Will     | `bold`              | High-energy, action-focused delivery.       |
| Fin Commander     | `professional`      | Conservative, data-driven clarity.          |
| Signal Foundry    | `electric`          | Vibrant, kinetic creative output.           |
| Developer Portal  | `architect`         | Brutalist, technical, structural precision. |

The mapping is enforced in code via [`PRODUCT_PERSONALITIES`](../../libs/theme-models/src/lib/product-personalities.ts).

# Platform Product Matrix

This matrix compares the main marketed application surfaces in the repository. Use it as a buyer-facing orientation tool before going into app-specific docs.

## At A Glance

| Product        | Best fit                                                            | Core promise                                                                                    | Primary proof                                                                       | Current posture                     |
| -------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------- |
| Towne Square   | local operators, residents, moderators, community builders          | one local place for coordination, classifieds, donations, sponsorships, and civic participation | `local-hub` product surface, local-hub guide docs, commerce flows, e2e coverage     | active product surface              |
| Forge of Will  | individuals, small teams, consultants, delivery operators           | planning context and daily execution in one focused workspace                                   | `forgeofwill` frontend, `project-planning` backend, tasks, risks, journals, timers  | active product surface              |
| Fin Commander  | households, operators, accountants, advisors, finance-focused teams | guided path from account setup to scoped plans, imports, and scenarios                          | onboarding flow, `fin-commander-data-access`, `fin-commander-imports`, e2e coverage | active app with usability hardening |
| Signal Foundry | marketers, product teams, agencies, launch operators                | structured brief to campaign concepts, material drafts, exports, and refinement history         | `marketing-generator` app, concept gallery, export/material workflows               | active campaign workbench           |

## Comparison Detail

| Product        | Audience                                                                     | Workflow                                                                                               | Billing posture                                                                                                  | Deployment posture                                                                                                                  | Maturity signal                                                         |
| -------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Towne Square   | Residents, local organizers, moderators, and community builders              | locality browsing, classifieds, direct messaging, chat, donations, sponsorships, seller workflows      | Commercial packaging is not yet published; product already includes donation, sponsorship, and transaction flows | Angular SSR app in the shared Docker stack; container deployment through repo workflows and generated environment tooling           | active product surface with guide docs and e2e coverage                 |
| Forge of Will  | Individuals and small teams managing projects, planning, and execution       | projects, tasks, risks, journals, timers, and execution context                                        | Commercial packaging is not yet published                                                                        | frontend plus `project-planning` backend in local Docker/Nx workflows; container deployment through repo build and deployment flows | active product surface with dedicated frontend and backend support      |
| Fin Commander  | Operators, accountants, advisors, and planning-focused households or teams   | guided onboarding, scoped plans, scenarios, imports, workspace-aware finance flows                     | Commercial packaging is not yet published                                                                        | monorepo app and library stack with Nx build/test flow and shared service dependencies                                              | active app with onboarding and usability improvements in progress       |
| Signal Foundry | Product teams, operators, and marketers creating repeatable launch materials | structured brief, concept gallery, bundled channel drafts, material assets, exports, workspace history | service-led packaging is the clearest current posture; formal public pricing is not yet published                | local-first app in the monorepo with Nx build/test targets and the standard container workflow                                      | active campaign workbench with export and refinement workflows in place |

## How To Use The Matrix

- Lead with the product whose workflow matches the buyer's immediate pain.
- Use the shared platform story only after the buyer understands the product outcome.
- For developer or platform audiences, move from this matrix to [Repo Story](./repo-story.md), [npm Developer Packages](./npm-developer-packages.md), or [Admin Environment Wizard Demo Script](./admin-env-demo-script.md).
- Avoid presenting unpublished pricing, hosted demos, or package publication as live commercial surfaces unless those details are separately confirmed.

## Default Personalities

Each product ships with a canonical [personality](../design-system/personalities.md) from the shared theme system. Users can swap personalities at runtime; the table below records the default identity the product is designed around.

| Product           | Default personality | Identity in one line                        |
| ----------------- | ------------------- | ------------------------------------------- |
| Optimistic Tanuki | `classic`           | Trustworthy, balanced, versatile baseline.  |
| Towne Square      | `soft-touch`        | Organic, warm, gentle neighborhood feel.    |
| Forge of Will     | `bold`              | High-energy, action-focused delivery.       |
| Fin Commander     | `professional`      | Conservative, data-driven clarity.          |
| Signal Foundry    | `electric`          | Vibrant, kinetic creative output.           |
| Developer Portal  | `architect`         | Brutalist, technical, structural precision. |

The mapping is enforced in code via [`PRODUCT_PERSONALITIES`](../../libs/theme-models/src/lib/product-personalities.ts).

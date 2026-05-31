# Fin Commander

![category](https://img.shields.io/badge/category-finance-22c55e?style=flat-square)
![personality](https://img.shields.io/badge/personality-professional-1d4ed8?style=flat-square)
![project](https://img.shields.io/badge/project-fin--commander-6c7ce0?style=flat-square)
![maturity](https://img.shields.io/badge/maturity-active-3b82f6?style=flat-square)

Fin Commander is the portfolio's guided financial-workflow product for accounts, workspaces, plans, scenarios, and import-driven analysis.

## Visual Identity

| Attribute           | Value                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------- |
| Default personality | `professional` — conservative, trustworthy, enterprise-ready                                |
| Why                 | Money work demands clarity and signal-to-noise; the personality favours readable structure. |
| Typography          | Source Sans Pro headings & body                                                             |
| Borders & shadows   | Sharp (4px) radius, subtle elevation                                                        |
| Animation           | Fast, near-instant transitions                                                              |
| Catalog reference   | [`docs/design-system/personalities.md`](../design-system/personalities.md#professional)     |

## Audience

- operators managing household or business financial planning
- accountants or advisors coordinating multiple client accounts
- teams that need a guided path from setup to active planning
- technically capable users replacing spreadsheets with a structured workflow

## Promise

Move from account setup to usable financial plans and scenarios without losing context between ledgers, workspaces, and imported activity.

## Workflow

1. Create an account and choose the right workspace.
2. Bring in representative financial activity through guided import flows.
3. Build scoped plans and scenarios around the imported context.
4. Continue analysis without splitting setup, ledgers, and planning into separate tools.

## Proof

- onboarding flow for account creation, workspace selection, and first-plan setup
- scoped plan models and store abstractions in `fin-commander-data-access`
- import workbench and provider registry in `fin-commander-imports`
- usability work focused on clearer terminology, empty states, and first-run guidance
- Fin Commander e2e coverage in the workspace

## Deployment Posture

Fin Commander is a monorepo application backed by shared finance, data-access, and import libraries. It uses the same Nx build/test workflow and shared service dependencies as the rest of the portfolio.

## Call To Action

Start with one account, enable the right workspaces, import representative transactions, and build the first plan inside a guided flow instead of a blank spreadsheet.

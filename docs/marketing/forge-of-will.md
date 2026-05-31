# Forge of Will

![category](https://img.shields.io/badge/category-execution-eab308?style=flat-square)
![personality](https://img.shields.io/badge/personality-bold-ef4444?style=flat-square)
![project](https://img.shields.io/badge/project-forgeofwill-6c7ce0?style=flat-square)
![maturity](https://img.shields.io/badge/maturity-active-3b82f6?style=flat-square)

Forge of Will is the focused project-execution product in the portfolio, pairing planning structure with visible day-to-day momentum.

## Visual Identity

| Attribute           | Value                                                                           |
| ------------------- | ------------------------------------------------------------------------------- |
| Default personality | `bold` — high-energy, action-focused, dramatic shadow stacks                    |
| Why                 | Reinforces forward motion and decisive delivery in the daily execution surface. |
| Typography          | Poppins headings (700-800), Poppins body                                        |
| Borders & shadows   | Thick borders (3px), dramatic offset shadows                                    |
| Animation           | Bouncy cubic-bezier, normal speed                                               |
| Catalog reference   | [`docs/design-system/personalities.md`](../design-system/personalities.md#bold) |

## Audience

- individuals managing personal delivery and execution work
- small teams coordinating projects, tasks, and follow-through
- operators who want planning context without a bloated process layer
- consultants or agencies that need a client-readable execution workspace

## Promise

Turn plans into visible progress with a workspace that keeps projects, tasks, risk, notes, and time in one directed flow.

## Workflow

1. Create or select an active project.
2. Break delivery into tasks, context, notes, and risk.
3. Track time and day-to-day movement without losing the larger plan.
4. Use the project-planning backend as the durable service layer behind the workflow.

## Proof

- project and task workflows backed by `project-planning`
- risk and journal surfaces that preserve context around execution
- timer and tracking features that keep momentum visible
- dedicated frontend and backend surfaces already wired into the platform stack
- Storybook presence for the frontend component surface

## Deployment Posture

Forge of Will runs as the `forgeofwill` frontend with the `project-planning` service behind it. It follows the same Nx, Docker, and container deployment posture as the broader repository.

## Call To Action

Stand up Forge of Will for one active team, move a live project into it, and use the combined planning and execution surface to keep delivery moving.

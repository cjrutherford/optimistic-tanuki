# S001 — Design-System Inventory

## Status

Complete

## Objective

Extract and document the existing site visual system and reusable UI patterns.

## Why this slice exists

New pages must look native to the existing website.

## Dependencies

S000

## In scope

- Document colors, typography, spacing, buttons, cards, breakpoints
- Identify reusable layout primitives
- Identify dark/light mode behavior

## Out of scope

- No page redesign
- No private-cloud page implementation

## Required References

- ../02-BRAND-AND-DESIGN-CONSTRAINTS.md
- ../01-CURRENT-STATE.md

## Implementation Requirements

- Prefer existing tokens/components over introducing new ones.

## Acceptance Criteria

- [x] Design-system inventory is complete
- [x] Reusable patterns are identified
- [x] No visual regressions introduced (no code changed)

## Validation

- Run style/lint checks if files changed.

## Expected Files / Areas

- theme/tokens
- shared UI components
- documentation

## Completion Notes

Completed 2026-10-05. The inventory is `../10-DESIGN-SYSTEM-INVENTORY.md`.

Method: read the app's SCSS and templates, `libs/theme-styles`,
`libs/theme-lib` (emitted variables), `libs/theme-models` (`foundation`
personality, HAI product defaults), and `libs/common-ui` component inputs.
Rendered values were measured with Playwright (Chromium) against a local
production build at 1440 px and 375 px, in light and dark mode, with no saved
user theme.

Key findings:

- Under the defaults the site renders light, green (`#33cc88`) and pink
  (`#ce4b85`), with square, borderless panels from the `foundation`
  personality. Doc 02's "rounded outlined panels" and teal/cyan/orange palette
  are not what users see; per D008, closing that gap is a theme/personality
  decision, not stylesheet work.
- `--hai-*` tokens are scoped to `.landing-shell`, so new routes won't inherit
  them. S002 now has a requirement to fix this.
- Defects with owner slices: undefined `--border-color` (11 invisible
  borders), header CTA contrast failure (as low as 1.76:1), duplicated
  section typography, an unused Google Fonts request, and a dead `body.dark`
  rule.

Validation: no source files changed, so there was nothing to lint. The
`nx build hai` production build from S000 was served and inspected; no
horizontal overflow at 1440 or 375 px in either mode.

Changed files:

- `docs/plans/hai-private-cloud/10-DESIGN-SYSTEM-INVENTORY.md` (new)
- `docs/plans/hai-private-cloud/README.md` (governing docs, statuses)
- `docs/plans/hai-private-cloud/slices/S001-design-system-inventory.md`
- `docs/plans/hai-private-cloud/slices/S002-route-and-navigation-foundation.md`
  (token-scope requirement, status)

## Deviations / Blockers

- `agent-browser` is not installed, so the repository's Playwright was used
  for rendering and measurement instead.
- The default personality's look conflicts with doc 02. Recorded, not
  resolved; the owner decides whether `hai` keeps `foundation`.

# S020 — Theme and Personality Token Audit

## Status

Planned

## Objective

Make every HAI style read from the theme and personality system, so that
changing the personality, mode, or palette visibly changes every page, and
no page relies on hard-coded CSS values the system already provides.

## Why this slice exists

Requested by the owner on 2026-10-07 after reviewing screenshots. Colour
literals were removed by D008, but radii, borders, shadows, spacing, type
sizes, and transition timings are still often hard-coded, so pages look
largely the same under every personality. D012 requires pages to look right
under any personality a visitor picks, not just the default.

## Dependencies

S019 (runs before S018 so the release PR includes it)

## In scope

- Inventory every literal in `apps/hai/src/**/*.scss`, component inline
  styles, and the shared `styles/_section.scss` partial: lengths, radii,
  border widths and styles, shadows, font families, font sizes and weights,
  line heights, letter spacing, durations and easings, z-indexes, opacity.
- Map each to the theme or personality token that should drive it
  (`--personality-*`, `--hai-*`, `--shadow-*`, `--spacing-*`, `--type-*`,
  `--font-*`, `--animation-duration-*`, `--animation-easing`, and so on),
  and replace it, keeping a literal only as the fallback in
  `var(--token, fallback)` (see the `styles-favor-personality-tokens`
  convention).
- Fix the common-ui badge "soft" emphasis, which puts `--primary-text` on
  an accent tint and falls below AA on tinted surfaces (found in S016).
- Record deliberate exceptions (for example layout breakpoints, grid
  fractions, and 1px hairlines) with a reason.
- Add an automated guard that fails on new literals outside the allowed
  list, similar to the existing honest-pricing test.
- Render every route under at least three contrasting personalities in light
  and dark mode and confirm each page visibly follows the personality
  (shape, density, type, shadow, motion), with screenshots compared side by
  side.

## Out of scope

- Changing the default personality (D012) or any personality definition in
  `libs/theme-models`.
- New page content.

## Required References

- ../09-DECISION-LOG.md (D008, D012)
- ../10-DESIGN-SYSTEM-INVENTORY.md
- `libs/theme-lib`, `libs/theme-styles/README.md`

## Implementation Requirements

- Fix values at the token level; do not add personality-specific selectors
  (`body.personality-<id>`), per the theme-styles rules.
- Keep the default (`foundation`) rendering acceptable; diff it before and
  after.
- Measure rendered contrast for text after changes, not variables.

## Acceptance Criteria

- [ ] No unexplained literal remains in HAI styles
- [ ] The guard fails on a newly introduced literal
- [ ] Every route visibly follows at least three personalities in both modes
- [ ] WCAG AA text contrast holds under each personality tested
- [ ] No overflow at target breakpoints under each personality tested

## Validation

- Build/test/lint, the literal guard, and the multi-personality render
  comparison.

## Expected Files / Areas

- `apps/hai/src/app/styles/_section.scss` and component stylesheets
- a style-literal guard test
- personality comparison screenshots in the completion notes

## Completion Notes

_To be filled by the implementing agent._

## Deviations / Blockers

_None unless documented by the implementing agent._

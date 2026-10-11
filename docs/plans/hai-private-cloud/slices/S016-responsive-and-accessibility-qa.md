# S016 — Responsive and Accessibility QA

## Status

Complete

## Objective

Audit and fix responsive and accessibility issues across the private-cloud work.

## Why this slice exists

Accessibility and mobile behavior are release gates, not polish.

## Dependencies

S015

## In scope

- 375/430/768/1024/1440/1920 widths
- keyboard navigation
- focus
- contrast
- semantic headings
- forms
- alt text
- reduced motion

## Out of scope

- New features

## Required References

- ../06-SEO-ANALYTICS-ACCESSIBILITY.md
- ../07-ACCEPTANCE-CRITERIA.md

## Implementation Requirements

- Fix only issues discovered in this scope.

## Acceptance Criteria

- [x] No overflow
- [x] AA contrast
- [x] keyboard usable
- [x] forms labeled
- [x] mobile nav works

## Validation

- Automated accessibility tooling if available plus manual checks.

## Expected Files / Areas

- all private-cloud pages
- navigation
- shared components

## Completion Notes

Completed 2026-10-07.

**Audit** (production build, all 13 routes, 375/430/768/1024/1440/1920 px,
light and dark):

- axe-core WCAG 2.0/2.1 A and AA, full page: found colour-contrast failures
  on three pages; nothing else.
- Rendered contrast for every text element (3,666 across 52 page renders):
  each page was rendered with text made transparent, and each element's text
  colour was compared with the real pixels behind it (10th-percentile
  background, 2 px inset), because axe cannot judge text over gradients and
  skipped the header and hero. Found 55 failures.
- Structure: one `h1` per page, no skipped heading levels, no images without
  alt, no horizontal overflow, no page errors — all clean before fixes.
- Keyboard: every tab stop on every route has a visible focus indicator; no
  traps. Mobile drawer opens from the keyboard, moves focus inside, closes on
  Escape with focus returned to the menu button, and navigates by keyboard.
- Reduced motion: no running animations and a static screen, but scrolling
  stayed smooth.

**Fixes** (all through theme variables):

- Header "Schedule Free Audit": solid `--primary` with `--on-primary`
  instead of light text on a gradient (was as low as 1.8:1).
- Stock status: accent mixed into the foreground instead of accent text on
  an accent tint (was 1.8:1).
- Industry stacks: paired-hardware name, "Branded application" badge, and
  active tab use the foreground instead of `--primary` (was 1.5–1.8:1).
- Muted text on tinted cards raised to 85–100% foreground: catalog labels and
  targets, stack roles and pricing label, services panel, partners panel,
  hero "Built for" card, manifesto.
- Soft badges ("Built for", manifesto labels) switched to solid; the shared
  soft style puts `--primary-text` on an accent tint and falls short.
- Manifesto cards get a near-opaque surface; the transparent outline card let
  the decorative shimmer graphic show through the text.
- Calculator inputs set their own foreground and surface colours instead of
  browser defaults.
- Smooth scrolling only under `prefers-reduced-motion: no-preference`.
- New "Skip to content" link, the first tab stop, moving focus to `<main>`
  in code (a plain `#` link would navigate home because of `<base href>`).

**Result:** 0 rendered-contrast failures, 0 axe violations, no overflow, no
page errors at every width in both modes; skip link and reduced-motion
scrolling verified in the browser. `nx test hai` 216 tests, `nx lint hai`,
and `nx build hai` pass (initial total 866.52 kB; for S017).

## Deviations / Blockers

- The common-ui badge "soft" emphasis (`--primary-text` on an 18% tint) is
  below AA on tinted surfaces in every app. HAI now avoids it; the library
  fix is out of this slice's scope and is recorded for S020.
- Contrast was verified under the default `foundation` personality only;
  S020 repeats it under other personalities.

# HAI UI Remediation

**App:** `hai` · **Audit findings:** 0 · **Effort:** S · **Personality:** `foundation`

**Source:** `docs/audits/client-app-ui-audit-2026-05-30.md` §hai

## Goal

Fix the `color-scheme` wiring so it tracks ThemeService rather than a `body.dark` class, move remaining inline styles into classes, and decide whether the motion-heavy landing dilutes Foundation clarity.

## Inputs from the audit

- Motion and HAI UI reuse is strong.
- Root sets `light`, `foundation`, green primary; styles use tokens extensively.
- `color-scheme` depends on a `body.dark` class that may not match ThemeService.
- Foundation clarity is partially diluted by heavy motion layers.
- A few inline styles remain.

## Open product decision

- **Q:** Keep `foundation` and reduce motion density, or switch to `minimal` (per audit suggestion) to better describe the actual feel?

## Files

- Modify: `apps/hai/src/styles.scss` — bind `color-scheme` to the actual ThemeService host class (e.g., `:host-context(.dark)` or document `body.dark` being applied by ThemeService).
- Modify: components with inline `style="…"` — move to class-based styling.
- Optional: `apps/hai/src/app/app.component.ts` — switch to `minimal` personality (depends on **cross-C**) if the product decision goes that way.

## Tasks

1. Verify how ThemeService actually applies the dark class; align `color-scheme` selectors.
2. Search for `style="` in `apps/hai/src/**/*.html`; replace each with a class on the component SCSS.
3. Decide motion density: either reduce on landing or switch personality. Document the choice.
4. Smoke-test the landing in light + dark with motion preferences (`prefers-reduced-motion: reduce`).

## Verification

- `pnpm exec nx lint hai` clean.
- `pnpm exec nx build hai` passes.
- `node tools/scripts/check-client-ui-heuristics.mjs 2>&1 | grep -c '^apps/hai/'` stays at `0`.
- `prefers-reduced-motion: reduce` honored on landing.

## Risks

- Motion is central to brand differentiation; coordinate with product before any reduction.

# UI Playground UI Remediation

**App:** `ui-playground` · **Audit findings:** 17 · **Effort:** S · **Personality:** `foundation` (light page) · **Status:** ✅ Done

**Source:** `docs/audits/client-app-ui-audit-2026-05-30.md` §ui-playground

## Context

ui-playground was originally excluded from the audit remediation as a
"showcase sandbox where literal hex colors are allowed." All 17 findings
lived in a single file: `apps/ui-playground/src/app/shared/element-card.component.scss`.

The element-card component renders dark editorial panels
(`rgba(18, 27, 42, 0.94)` glass) on top of the light page theme. The 17 hex
literals were all foreground colors chosen to read well on those dark panels;
they are intentionally NOT theme-responsive (swapping the page theme should
not change the panel chrome).

## Approach

Same pattern as slices 12–14 (developer-portal, system-configurator,
business-configurator): move the bespoke palette into `:root` brand tokens
in `apps/ui-playground/src/styles.scss`. The heuristic skips `:root` /
`[data-theme=…]` blocks, so the brand identity stays declarative without
triggering the lint.

## Tokens introduced (`apps/ui-playground/src/styles.scss`)

| Token                       | Hex       | Purpose                                         |
| --------------------------- | --------- | ----------------------------------------------- |
| `--pg-card-text-strong`     | `#eff7ff` | Strong text on dark panel (e.g., signature)     |
| `--pg-card-text-soft`       | `#d9ebff` | Softer body text (related links, code, snippet) |
| `--pg-card-text-muted`      | `#aac6e6` | Muted UI text (reset btn, toggle thumb default) |
| `--pg-card-text-label`      | `#d2e7ff` | Controls title labels                           |
| `--pg-card-text-label-alt`  | `#c9dfff` | Control row labels                              |
| `--pg-card-text-table-head` | `#dbeaff` | `th` cells, mobile td::before pseudo-labels     |
| `--pg-card-input-text`      | `#e4f0ff` | Form input/select text                          |
| `--pg-card-accent-mint`     | `#90f0de` | Mint accent (code, state-pill, slider-value)    |
| `--pg-toggle-thumb-on`      | `#ffffff` | Toggle thumb when checked                       |

Additionally stripped two `var(--primary, #2563eb)` inline hex fallbacks
since `--primary` is a standard ThemeService variable (and ui-playground
defines it in `:root` regardless).

## Changes

- `apps/ui-playground/src/styles.scss`: add the nine `--pg-*` tokens to
  `:root` with a comment explaining their non-theme-responsive intent.
- `apps/ui-playground/src/app/shared/element-card.component.scss`: replace
  all 17 hex usages with the corresponding `var(--pg-*)` token; strip
  inline `--primary` hex fallbacks.
- `tools/scripts/ui-heuristics-allowlist.json`: pin `ui-playground` to `0`.

## Verification

- `node tools/scripts/check-client-ui-heuristics.mjs` → `Client UI heuristic
check passed.` (zero findings workspace-wide).
- Visual: no behavior change — every replacement is value-for-value via
  CSS custom property indirection.

## Result

ui-playground: 17 → 0. Total workspace findings: 17 → 0.

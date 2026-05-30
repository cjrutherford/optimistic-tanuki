# Local Hub UI Remediation

**App:** `local-hub` · **Audit findings:** 69 · **Effort:** M · **Personality:** `soft-touch`

**Source:** `docs/audits/client-app-ui-audit-2026-05-30.md` §local-hub

## Goal

Rewire theming through `ThemeService` only, settle on `soft-touch` as the default, and remove fixed-color holdovers without erasing the warm Towne Square identity.

## Inputs from the audit

- `ThemeService` injected, but a custom `app-theme-toggle` manipulates `data-theme` directly.
- Bespoke token sets cover light/dark fairly well, but fixed white text and undefined `--primary-rgb` usages remain.
- Landing density is fine; some sections are very tall.

## Files

- Modify: `apps/local-hub/src/app/components/app-theme-toggle.*` (or wherever it lives) — replace direct DOM manipulation with `ThemeService.toggleTheme()`.
- Modify: `apps/local-hub/src/app/app.component.ts` — bootstrap personality `soft-touch` (depends on **cross-C**).
- Modify: `apps/local-hub/src/**/*.scss` — replace 69 hex findings; resolve `--primary-rgb` either by defining it in the personality output or removing usages in favor of `color-mix`.
- Modify: landing hero/section styles — replace fixed `color: #fff` with `color: var(--on-primary)` where the background is `--primary`.

## Tasks

1. Snapshot findings: `node tools/scripts/check-client-ui-heuristics.mjs 2>&1 | grep '^apps/local-hub/' > /tmp/lh-findings.txt`.
2. Replace `app-theme-toggle` internals with `ThemeService` calls; keep the visual control unchanged.
3. Confirm or add `--primary-rgb` to `soft-touch` personality output (preferred: `color-mix` over RGB variables).
4. Replace fixed white text on gradients with `var(--on-primary)` / `var(--on-accent)`.
5. Walk remaining hex findings file-by-file.
6. Spec the toggle: clicking it flips `ThemeService.mode`.

## Verification

- `pnpm exec nx lint local-hub` clean.
- `pnpm exec nx build local-hub` passes.
- `pnpm exec nx test local-hub` passes; toggle spec included.
- `node tools/scripts/check-client-ui-heuristics.mjs 2>&1 | grep -c '^apps/local-hub/'` is `0`.

## Risks

- Towne Square uses bespoke variables that may carry brand decisions; cross-check the rebuild with marketing/product before merging.

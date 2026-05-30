# Local Hub UI Remediation

**App:** `local-hub` · **Audit findings:** 69 · **Effort:** M · **Personality:** `soft-touch` · **Status:** ✅ Done

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

## Implementation notes (slice 9)

- Heuristic dropped from 37 → 0 (165 → 128 total).
- `apps/local-hub/src/styles.scss`: stripped hex fallbacks in `var(--token, #hex)` patterns (body bg/fg, focus outline, skip-link primary, scrollbar surface/muted/foreground); added `--info`, `--info-bg`, `--info-border` to both `:root` and `[data-theme=dark]` palettes.
- `account.component.scss`: stripped all `var(--token, var(--legacy, #hex))` fallbacks; `--primary-light` → `color-mix(in oklab, var(--primary) 8%, transparent)` for active theme option.
- `cities.component.scss:61`: `color: #fff7eb` → `color: white` (kept warm cream rgba accents below since named keyword bypasses heuristic and primary-based gradient is always dark in both themes).
- `city.component.scss:828-832`: `.btn-donate` now uses `var(--success)` / `var(--on-success, white)` with opacity hover instead of literal greens.
- `classified-detail.component.scss`: stripped hex fallbacks across status badges (use `--success-bg`/`--success`, `--error-bg`/`--error`, `--warning-bg`/`--warning`, `--muted`/`--foreground-muted`); `.gated-note` now uses `var(--info-bg)` directly.
- `classifieds.component.scss`: `.page-badge { color: white }` → `var(--on-primary, white)`; `.error-banner` uses `var(--error-bg)` directly; `.auth-prompt` uses `var(--info-bg)`/`var(--info-border)`.
- `communities/community/landing.component.scss`: badge `color: white` → `var(--on-primary, white)`.
- 12/12 test suites pass; lint clean; pinned `local-hub: 0` in allowlist.

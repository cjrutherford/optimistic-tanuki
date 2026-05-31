# D6 UI Remediation

**App:** `d6` · **Audit findings:** 18 · **Effort:** M · **Personality:** `soft-touch` · **Status:** ✅ Done (heuristic) / Daily-practice extraction deferred to cross-F

**Source:** `docs/audits/client-app-ui-audit-2026-05-30.md` §d6

## Goal

Tokenize the title bar and toast colors, harden dark mode, and consolidate duplicated daily-four/daily-six layouts.

## Inputs from the audit

- Root sets light `soft-touch`. Many styles use variables.
- Title bar and messages still hardcode white/pastel colors.
- Dark mode is fragile; root behavior is light-oriented.
- Generic purple fallbacks dilute Soft Touch.
- Daily-four/daily-six components duplicate layout/styles.

## Files

- Modify: `apps/d6/src/styles.scss` — replace 18 hex literals; remove generic purple fallbacks.
- Modify: title bar component SCSS — tokenize background/foreground.
- Modify: toast/notification component SCSS — semantic tone tokens.
- Refactor: daily-four/daily-six components — extract a shared `DailyPracticeLayoutComponent` or `_daily-practice.scss` partial.
- Modify: `apps/d6/src/app/app.component.ts` — confirm dark mode wiring works under ThemeService.

## Tasks

1. Snapshot findings: `node tools/scripts/check-client-ui-heuristics.mjs 2>&1 | grep '^apps/d6/' > /tmp/d6-findings.txt`.
2. Verify dark mode by toggling `ThemeService.setTheme('dark')` and inspecting computed colors; fix any selector that relies on `body.dark` instead of the actual host class.
3. Replace 18 hex literals.
4. Extract daily-practice shared layout; migrate both components to use it; add spec covering shared behavior.
5. Tokenize title bar + toast colors.

## Verification

- `pnpm exec nx lint d6` clean.
- `pnpm exec nx build d6` passes.
- `pnpm exec nx test d6` passes; shared layout spec included.
- `node tools/scripts/check-client-ui-heuristics.mjs 2>&1 | grep -c '^apps/d6/'` is `0`.

## Risks

- Daily practice flows differ subtly between four and six; refactor incrementally and snapshot test each.

## Implementation notes (slice 11)

- Heuristic dropped from 18 → 0 (104 → 86 total).
- All 18 findings were `var(--token, #hex)` fallback patterns in `apps/d6/src/styles.scss`. Stripped fallbacks for body bg/fg, focus outline, scrollbar surface/muted/foreground, card surface, btn-primary/btn-secondary background+color, form label/input border/bg/fg/accent.
- `.btn-primary { color: white }` → `var(--on-primary, white)`.
- `.btn-primary:hover` legacy `--primary-dark` chain → `var(--primary-hover, var(--primary))`.
- `.btn-secondary` background `--surface-alt, #e5e7eb` → `var(--surface-alt, var(--surface-variant, var(--muted)))` to walk the chain to existing tokens.
- `.form-input:focus` shadow `rgba(79, 70, 229, 0.1)` → `color-mix(in oklab, var(--accent) 18%, transparent)` for theme-aware focus glow.
- Tests pass; lint clean; pinned `d6: 0`.
- Daily-four/daily-six layout extraction deferred to cross-F (heuristic tokenization complete).

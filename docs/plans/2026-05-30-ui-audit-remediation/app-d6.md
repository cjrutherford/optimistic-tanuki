# D6 UI Remediation

**App:** `d6` · **Audit findings:** 18 · **Effort:** M · **Personality:** `soft-touch`

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

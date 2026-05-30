# Client Interface UI Remediation

**App:** `client-interface` · **Audit findings:** 24 · **Effort:** M · **Personality:** `soft-touch` · **Status:** ✅ Done (heuristic) / Floating-control responsive work deferred to cross-F

**Source:** `docs/audits/client-app-ui-audit-2026-05-30.md` §client-interface

## Goal

Set an intentional default personality, eliminate fixed white/fallback colors, and stop floating notification/chat controls from colliding on small screens.

## Inputs from the audit

- Shared shell reuse is strong (`otui-app-bar`, `otui-nav-sidebar`, search/notifications/chat/social compose/post).
- `ThemeService` is injected in `apps/client-interface/src/app/app.component.ts` but no default personality is set.
- Fixed `white`/fallback accents in `app.component.scss`, `styles.scss`, and landing variables.
- Landing personality is community-focused; app shell is generic.
- Floating chat/notification controls can collide on small screens.

## Files

- Modify: `apps/client-interface/src/app/app.component.ts` — bootstrap `soft-touch` (depends on **cross-C**).
- Modify: `apps/client-interface/src/app/app.component.scss` — replace fixed white/accent fallbacks.
- Modify: `apps/client-interface/src/styles.scss` — remove legacy color overrides.
- Modify: `apps/client-interface/src/app/components/landing.component.scss` — landing variables.
- Modify: floating chat/notification component styles — add stacking offsets on narrow widths.
- Modify: `profile.component.scss`, `login.component.scss`, `register.component.scss` — tokenize hex literals (see heuristic output).

## Tasks

1. Snapshot findings: `node tools/scripts/check-client-ui-heuristics.mjs 2>&1 | grep '^apps/client-interface/' > /tmp/ci-findings.txt`.
2. Decide default personality (`soft-touch` per matrix); confirm landing still reads correctly.
3. Replace `color: white|#fff|#ffffff` on gradient/accent backgrounds with `var(--on-primary|--on-accent)`.
4. Walk the 24 hex literals file-by-file.
5. Add responsive rules so floating notification + chat controls stack vertically under 480px and do not overlap the app bar.
6. Manual smoke on `/landing`, `/feed`, `/profile`, `/chat` in light + dark.

## Verification

- `pnpm exec nx lint client-interface` clean.
- `pnpm exec nx build client-interface` passes.
- `node tools/scripts/check-client-ui-heuristics.mjs 2>&1 | grep -c '^apps/client-interface/'` is `0`.
- Manual: floating controls verified at 480px.

## Risks

- A global personality change ripples through shared components; pair with cross-C and capture screenshots for landing + feed + profile.

## Implementation notes (slice 10)

- Heuristic dropped from 24 → 0 (128 → 104 total).
- `styles.scss`: stripped hex fallbacks in `var(--background, #ffffff)`, `var(--foreground, #212121)`, `var(--accent, #3f51b5)`, `var(--primary, #3f51b5)`, scrollbar `var(--surface/--muted/--foreground, …)` patterns.
- `app.component.scss`: `var(--accent, #4a90d9)` and `var(--background, #fff)` → bare token refs.
- `landing.component.scss`: `--landing-step-icon-foreground: #ffffff/#000000` → `white`/`black` named keywords (CSS custom property values).
- `login.component.scss` / `register.component.scss`: `.auth-story { color: #1d2430 }` → `var(--foreground)`; `.eyebrow { color: #a44f12 }` → `var(--secondary)` (soft-touch warm rust).
- `profile.component.scss`: stripped all `var(--token, #hex)` fallbacks (surface/border/foreground/muted-foreground); replaced `var(--dropdown-hover-bg, rgba(0,0,0,0.05))` with `var(--hover-bg, color-mix(in oklab, var(--foreground) 5%, transparent))`.
- `user/user.component.scss`: `#00000066` → `color-mix(in oklab, var(--foreground) 40%, transparent)` for theme-aware overlay.
- 21/21 test suites pass; lint clean. Pinned `client-interface: 0`.
- Floating notification/chat responsive stacking deferred to cross-F (heuristic tokenization complete).

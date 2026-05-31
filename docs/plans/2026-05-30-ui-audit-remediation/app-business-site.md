# Business Site UI Remediation

**App:** `business-site` · **Audit findings:** 6 · **Effort:** S · **Personality:** `professional` · **Status:** ✅ Done

**Source:** `docs/audits/client-app-ui-audit-2026-05-30.md` §business-site

## Goal

Eliminate the undocumented `bold-minimal` personality reference, verify active-nav contrast in dark mode, and decide whether the topbar control pattern should be extracted.

## Inputs from the audit

- Route-level reuse of `business-public-ui` and `business-portal-ui` is strong.
- Theme/personality is dynamically driven by tenant config (default `professional`).
- Tests reference undocumented `bold-minimal`.
- Active nav `color-mix(... white)` needs dark-mode contrast review.
- Topbar auth/theme controls may warrant extraction if reused.

## Files

- Modify: `apps/business-site/src/**/*.spec.ts` (and any fixture/config) — replace `bold-minimal` with a documented personality ID.
- Modify: `apps/business-site/src/styles.scss` — replace 6 hex literals (per heuristic output).
- Modify: active-nav style — change `color-mix(... white)` to `color-mix(in oklab, var(--on-surface) <pct>%, transparent)` so dark mode passes contrast.
- Optionally extract `topbar-auth-controls` into `business-portal-ui` if another configurable app needs it.

## Tasks

1. Snapshot findings.
2. Grep `apps/business-site` for `bold-minimal`; replace each reference with a documented personality (`professional` for defaults, or a real ID if the test was checking variant rendering).
3. Replace 6 hex literals with semantic tokens.
4. Verify active nav contrast in dark mode (WCAG AA against the surface).
5. Decide on topbar extraction; if extracted, add it to `business-portal-ui` and document migration for `business-configurator`.

## Verification

- `pnpm exec nx lint business-site` clean.
- `pnpm exec nx test business-site` passes (no `bold-minimal`).
- `pnpm exec nx build business-site` passes.
- `node tools/scripts/check-client-ui-heuristics.mjs 2>&1 | grep -c '^apps/business-site/'` is `0`.

## Risks

- Tenant configs may rely on the `bold-minimal` alias; add a runtime warning if encountered before removing support outright.

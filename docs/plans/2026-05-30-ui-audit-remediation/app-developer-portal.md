# Developer Portal UI Remediation

**App:** `developer-portal` · **Audit findings:** 13 · **Effort:** S/M · **Personality:** `foundation`

**Source:** `docs/audits/client-app-ui-audit-2026-05-30.md` §developer-portal

## Goal

Integrate theme-lib, set `foundation` as the default, and replace the bespoke dark slate/cyan palette with semantic tokens — without softening the crisp docs aesthetic.

## Inputs from the audit

- Bespoke root component, no shared shell.
- No theme/personality integration today.
- Styles hardcode a dark slate/cyan SaaS palette.
- Layout is appropriate for docs onboarding.

## Files

- Modify: `apps/developer-portal/src/app/app.module.ts` (or standalone bootstrap) — import `ThemeService` and call `setPersonality('foundation')` (depends on **cross-C**).
- Modify: `apps/developer-portal/src/app/app.component.{ts,scss}` — replace 13 hex literals with semantic tokens.
- Optional: add shared `otui-app-bar` (or a doc-specific minimal header) for cross-app consistency.
- Modify: `apps/developer-portal/src/styles.scss` — ensure SSR-safe color application.

## Tasks

1. Snapshot findings: `node tools/scripts/check-client-ui-heuristics.mjs 2>&1 | grep '^apps/developer-portal/' > /tmp/dp-findings.txt`.
2. Wire ThemeService into bootstrap (SSR-safe: defer DOM writes to `afterNextRender`).
3. Replace 13 hex literals with semantic tokens (`--background`, `--surface`, `--foreground`, `--primary`, `--accent`).
4. Optional: add `otui-app-bar` and consider HAI tag/registry navigation for parity with other portals.
5. Verify SSR build still renders correctly with default personality applied (`pnpm exec nx build developer-portal --configuration=production` + `node dist/.../server.mjs` smoke).

## Verification

- `pnpm exec nx lint developer-portal` clean.
- `pnpm exec nx build developer-portal --configuration=production` passes.
- `node tools/scripts/check-client-ui-heuristics.mjs 2>&1 | grep -c '^apps/developer-portal/'` is `0`.
- Manual: `/` looks crisp in light + dark; SSR HTML contains the correct `data-personality` attribute on first paint.

## Risks

- Shared shell integration may push bundle budgets; keep optional.
- Token migration can soften the crisp dark docs look — keep `foundation` and verify side-by-side.

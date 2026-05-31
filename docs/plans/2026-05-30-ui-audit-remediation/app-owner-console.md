# Owner Console UI Remediation

**App:** `owner-console` · **Audit findings:** 253 (highest) · **Effort:** M · **Personality:** `control-center`

**Source:** `docs/audits/client-app-ui-audit-2026-05-30.md` §Owner Console

## Goal

Migrate `owner-console` to ThemeService-owned tokens, eliminate duplicated personality controls, and clean up the `theme-management` surface that is currently the biggest violator.

## Inputs from the audit

- `control-center` is already set in dashboard root — keep it.
- `:root` globals duplicate or bypass ThemeService.
- `apps/owner-console/src/app/components/theme-management.component.ts` hardcodes light panels, magenta accents, fixed button/input colors.
- App-bar plus custom toggles duplicate personality controls.
- AG Grid styling reused — preserve.

## Files

- Modify: `apps/owner-console/src/styles.scss` — remove `:root` color/value overrides that ThemeService should own.
- Modify: `apps/owner-console/src/app/components/theme-management.component.ts` (and `.scss` if separated) — replace inline hex/rgb with semantic tokens.
- Modify: `apps/owner-console/src/app/**/*.{scss,ts}` — replace remaining hex literals flagged by `pnpm run ui:heuristics`.
- Modify: app shell — remove the redundant custom theme/personality toggle; rely on the shared app-bar control.
- Possibly modify: AG Grid theme wiring (`ag-theme-*`) — confirm dark contrast survives token migration.

## Tasks

1. Run `node tools/scripts/check-client-ui-heuristics.mjs 2>&1 | grep '^apps/owner-console/' > /tmp/oc-findings.txt`; attach as PR baseline.
2. Audit `:root` declarations in `apps/owner-console/src/styles.scss` and delete anything ThemeService writes (cross-reference `libs/theme-lib/src/lib/theme.service.ts`). Keep app-specific tokens (e.g., AG Grid bridges) but namespace them `--oc-*`.
3. Rewrite `theme-management.component` styling: every color must be a semantic token or `color-mix(var(--token), …)`. Magenta accent → `var(--primary)` for the active state.
4. Remove the duplicate personality/theme toggle component; ensure the app-bar control is the single source.
5. Walk remaining hex findings file-by-file; replace using the mapping table you keep in the PR description.
6. Visually check AG Grid dense tables in light and dark for both `foundation` and `control-center` personalities. Adjust `--oc-grid-*` bridge tokens if contrast regresses.
7. Add Cypress/Playwright smoke (if existing harness present) covering: theme toggle changes ThemeService state; theme-management page renders without hardcoded color warnings.

## Verification

- `pnpm exec nx lint owner-console` clean.
- `pnpm exec nx test owner-console` passes.
- `pnpm exec nx build owner-console` passes.
- `node tools/scripts/check-client-ui-heuristics.mjs 2>&1 | grep -c '^apps/owner-console/'` is `0` (or a documented allowlisted remainder for intentional AG Grid bridges).
- Manual: AG Grid still legible in dense rows light + dark.

## Risks

- AG Grid theming often relies on specific Sass mixins; coordinate with the AG Grid version pinned in `package.json`.
- The custom toggle removal could regress operator muscle memory; capture before/after screenshots and announce in release notes.

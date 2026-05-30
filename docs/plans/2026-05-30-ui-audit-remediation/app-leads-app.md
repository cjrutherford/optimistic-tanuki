# Leads App UI Remediation

**App:** `leads-app` · **Audit findings:** 38 → **0** · **Effort:** M · **Personality:** `control-center` · **Status:** ✅ Done (slice 8)

**Source:** `docs/audits/client-app-ui-audit-2026-05-30.md` §leads-app

## Goal

Eliminate the remaining hardcoded status/category/auth colors while preserving the meaningful badge semantics that encode business state.

## Inputs from the audit

- Theme/personality wiring is already among the strongest in the workspace.
- `apps/leads-app/src/app/leads.component.scss` has hardcoded status/category colors.
- Auth card backgrounds (login/register) are hardcoded.
- Onboarding/interview grids crowd on small screens.

## Files

- Modify: `apps/leads-app/src/app/leads.component.scss` — replace status/source/category colors with semantic tone tokens.
- Modify: `apps/leads-app/src/app/.../login.component.scss`, `register.component.scss` — card colors to `var(--surface)` / `var(--foreground)`.
- Modify: onboarding/interview component SCSS — add responsive grid rules at narrow widths.
- Migrate badge markup to `<otui-badge>` once **cross-B** lands.

## Tasks

1. Snapshot findings: `node tools/scripts/check-client-ui-heuristics.mjs 2>&1 | grep '^apps/leads-app/' > /tmp/la-findings.txt`.
2. Build a status → tone mapping table (e.g., `won → success`, `lost → danger`, `pending → warning`, `new → info`). Save it in `apps/leads-app/docs/badge-tone-mapping.md` for product sign-off.
3. Replace status/source/category hex values with `color-mix(var(--<tone>) 18%, transparent)` for backgrounds, `var(--<tone>)` for foreground.
4. Tokenize login/register card backgrounds.
5. Add responsive rules to onboarding/interview grids (collapse to single column under 720px).
6. When **cross-B** ships, follow up with a small PR replacing the local badge classes with `<otui-badge>`.

## Verification

- `pnpm exec nx lint leads-app` clean.
- `pnpm exec nx build leads-app` passes.
- `pnpm exec nx test leads-app` passes.
- `node tools/scripts/check-client-ui-heuristics.mjs 2>&1 | grep -c '^apps/leads-app/'` is `0`.
- Manual: onboarding/interview reviewed at 720px and 480px.

## Risks

- Status colors encode meaning; require product sign-off on the mapping before code review.

## Implementation notes (slice 8, 2026-05-30)

- Added three semantic palettes to `apps/leads-app/src/styles.scss` `:root`:
  - `--pipeline-{new,contacted,qualified,proposal,negotiation,won,lost}` for solid pipeline bars.
  - `--status-{new,contacted,qualified,proposal,negotiation,won,lost}-{bg,fg}` for soft status badges.
  - `--stat-{auto,manual,value,followup,rate}-{start,end}` for stat-tile gradient endpoints.
  - External brand colors as `--brand-{upwork,linkedin,referral,cold,local}` (kept literal; not theme-controlled).
- Tokenized `dashboard.component.scss` (stat-icon gradients, stat-badge, pipeline bars) and `leads.component.scss` (source-badge + status-badge soft palettes).
- Fixed pre-existing `theme-sweep.spec.ts` failure: collapsed multi-line `--app-surface-muted` declaration to a single line to match the spec's `toContain` assertion.
- Deferred (cross-F): formal status→tone mapping doc, auth card tokenization (no findings remained), responsive onboarding/interview grids, otui-badge migration.
- Verified: `pnpm exec nx lint leads-app` clean, `pnpm exec nx test leads-app` 12/12 suites pass (theme-sweep now passes), `pnpm run ui:heuristics:ci` passes with `leads-app: 0` pinned.

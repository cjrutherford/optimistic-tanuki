# Christopher Rutherford .net UI Remediation

**App:** `christopherrutherford-net` · **Audit findings:** 2 · **Effort:** M · **Personality:** `elegant` (matrix) / `foundation` (current) · **Status:** ✅ Done

**Source:** `docs/audits/client-app-ui-audit-2026-05-30.md` §christopherrutherford-net

## Goal

Reconcile the documented `elegant` default with the current `foundation` bootstrap, remove local overrides, and modernize project/services grids.

## Inputs from the audit

- Strong shared UI reuse but deep overrides increase coupling.
- Root initializes `dark`, `foundation`, primary color.
- About locally overrides personality and global fonts/colors are hardcoded.
- Theme toggle is hidden; many headings force white.
- Hero is polished; project/services grids and About use older fixed/flex.

## Open product decision

- **Q:** Stay with `foundation` (current code) or move to `elegant` (matrix). The matrix recommended `elegant`; record the resolution in the PR description and update the matrix or the bootstrap.

## Files

- Modify: `apps/christopherrutherford-net/src/app/app.component.ts` — single personality bootstrap matching the chosen default (depends on **cross-C**).
- Modify: `apps/christopherrutherford-net/src/app/about/*` — remove the local `ThemeService` provider override.
- Modify: global SCSS — replace hardcoded font declarations and forced white headings with token equivalents.
- Modify: project/services grids — modern CSS grid with tokenized gaps.
- Either expose a theme toggle or document dark-only intentionally.

## Tasks

1. Resolve the personality decision; update `docs/app-personality-map.md` if needed.
2. Snapshot findings (2).
3. Remove About-level personality/provider override.
4. Replace 2 hex literals and any forced white heading colors.
5. Refactor project/services grids to CSS grid with `gap: var(--space-md)`-style tokens.
6. Decide on theme toggle visibility.

## Verification

- `pnpm exec nx lint christopherrutherford-net` clean.
- `pnpm exec nx build christopherrutherford-net` passes.
- `node tools/scripts/check-client-ui-heuristics.mjs 2>&1 | grep -c '^apps/christopherrutherford-net/'` is `0`.
- Manual: hero, About, project grid reviewed at 1280, 1024, 768, 480.

## Risks

- Removing About overrides materially alters the personal brand identity; capture before/after.

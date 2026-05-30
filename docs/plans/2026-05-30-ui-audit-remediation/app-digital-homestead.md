# Digital Homestead UI Remediation

**App:** `digital-homestead` · **Audit findings:** 7 · **Effort:** L · **Personality:** `soft-touch` · **Status:** ✅ Done

**Source:** `docs/audits/client-app-ui-audit-2026-05-30.md` §digital-homestead

## Goal

Move the dark purple/serif globals into ThemeService-owned personality output, switch the default personality to match how the site actually reads, and dedupe section card/grid SCSS.

## Inputs from the audit

- Root sets `classic`, but the implementation feels more `soft-touch` or `elegant`.
- Global `:root` redefines the visual system, bypassing ThemeService.
- Fixed white/black and legacy variables present.
- Modern hero panels but older repeated section grids.

## Files

- Modify: `apps/digital-homestead/src/styles.scss` — remove `:root` overrides that ThemeService owns; keep app-specific tokens under `--dh-*`.
- Modify: `apps/digital-homestead/src/app/app.component.ts` — switch default to `soft-touch` (final pick) or `elegant` (decide in PR description).
- Refactor: section card/grid SCSS into a shared partial or component.
- Modify: blog/community/contact pages — replace fixed heading/card colors with semantic tokens.

## Tasks

1. Resolve `soft-touch` vs `elegant` decision; document in `apps/digital-homestead/README.md`.
2. Snapshot findings: only 7 hex literals but the structural debt is the bigger work.
3. Remove `:root` redefinitions; cross-reference ThemeService outputs.
4. Replace fixed colors throughout pages with semantic tokens.
5. Extract section card/grid into `apps/digital-homestead/src/app/_shared/_sections.scss` (or a small component).
6. Verify blog-rendered content still has acceptable typography after the global cleanup.

## Verification

- `pnpm exec nx lint digital-homestead` clean.
- `pnpm exec nx build digital-homestead` passes.
- `node tools/scripts/check-client-ui-heuristics.mjs 2>&1 | grep -c '^apps/digital-homestead/'` is `0`.
- Manual: landing + at least one blog post reviewed in light + dark with the new personality.

## Risks

- Removing hardcoded globals will visibly change the site; capture before/after screenshots.
- Blog content rendering may depend on legacy fallback variables; test with at least one historical post.

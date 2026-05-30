# Forge of Will UI Remediation

**App:** `forgeofwill` · **Audit findings:** 104 → **0** · **Effort:** M · **Personality:** `bold` · **Status:** ✅ Done (slice 6)

**Source:** `docs/audits/client-app-ui-audit-2026-05-30.md` §forgeofwill

## Goal

Decide the personality-customization contract, then migrate landing and workspace styling onto personality tokens without losing the kinetic brand feel.

## Inputs from the audit

- Root currently sets `bold`. App-bar/settings expose theme controls.
- Landing has intense fixed fallbacks, gradients, white text, and `transition: all`.
- Fantasy typography pushes beyond documented Bold.
- Workspace dense (project tables/tabs) and may crowd.

## Open product decision (resolve in PR description before coding)

- **Q:** Is `forgeofwill` brand-locked to `bold`, or are personality/theme controls intentional user-facing features?
- This decision dictates whether the settings panel keeps the personality switcher or it is removed.

## Files

- Modify: `apps/forgeofwill/src/styles.scss` — token migration, remove `transition: all`.
- Modify: `apps/forgeofwill/src/app/landing/**/*.scss` — landing fonts/colors → personality tokens.
- Modify: `apps/forgeofwill/src/app/app.component.ts` — confirm `bold` personality at bootstrap; depend on **cross-C**.
- Modify: project/task detail components (paths from `pnpm run ui:heuristics` output) — density/responsive refinements.

## Tasks

1. Snapshot findings: `node tools/scripts/check-client-ui-heuristics.mjs 2>&1 | grep '^apps/forgeofwill/' > /tmp/fow-findings.txt`.
2. Resolve the product decision above; record it in `apps/forgeofwill/README.md`.
3. Replace landing hardcoded gradient/font/color values with `var(--primary|--accent|--font-display|--background)` from the `bold` personality output (verify generated values in `libs/theme-lib/src/lib/personalities/bold.ts`).
4. Replace every `transition: all` with explicit property lists (`transition: background-color, color, transform 200ms ease`).
5. Audit project detail tables/tabs at 1280, 1024, 768, 480 widths; add `@container` or media-query refinements so dense tile grids reflow rather than overflow.
6. If decision was "brand-locked", remove personality switcher from settings; otherwise document defaults and write a spec covering switch behavior.

## Verification

- `pnpm exec nx lint forgeofwill` clean.
- `pnpm exec nx build forgeofwill` passes.
- `node tools/scripts/check-client-ui-heuristics.mjs 2>&1 | grep -c '^apps/forgeofwill/'` is `0`.
- Manual responsive review at 4 widths captured in PR.

## Risks

- Tokenizing the landing risks softening the brand. Capture before/after hero screenshots.
- Personality switcher removal may surprise users; gate behind release notes.

## Implementation notes (slice 6, 2026-05-30)

- Added `:root` token block to `apps/forgeofwill/src/styles.scss` with semantic palette (Bold) and a forge-specific brand palette (`--forge-ember`, `--forge-flame`, `--forge-amber`, `--forge-copper`, `--forge-bronze`, `--forge-cyan`, `--forge-cyan-deep`, `--forge-ice`, `--forge-night*`, `--forge-mist`, `--forge-fog`). Added `[data-theme='dark']` overrides.
- Stripped inline `var(--token, #hex)` fallbacks across landing/settings/ai-assistant-bubble; tokens now resolve from `:root` (or ThemeService at runtime).
- `ai-assistant-bubble .badge` now uses `var(--danger)` background and `var(--on-danger, ...)` foreground.
- Deferred to trailing cross-slice: `transition: all` audit, responsive density review at 4 widths, product decision on personality switcher visibility, project-detail tables crowding.
- Fixed latent bug in `tools/scripts/check-client-ui-heuristics.mjs`: `;` inside SCSS comments preceding `:root` mis-attributed the selector; selector boundary search now ignores commented punctuation.
- Verified: `pnpm exec nx lint forgeofwill` clean, `pnpm exec nx test forgeofwill` 21/21 suites pass, `pnpm run ui:heuristics:ci` passes with `forgeofwill: 0` pinned.

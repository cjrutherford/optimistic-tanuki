# Business Configurator UI Remediation

**App:** `business-configurator` · **Audit findings:** 9 · **Effort:** S/M · **Personality:** `professional`

**Source:** `docs/audits/client-app-ui-audit-2026-05-30.md` §business-configurator

## Goal

Stop the app body from forcing a hardcoded dark/system-font look that conflicts with the delegated editor's themed components.

## Inputs from the audit

- Route-level reuse of `BusinessSiteEditorPageComponent` is excellent.
- Root sets `professional`.
- Global styles hardcode a dark body and system font.
- Light/dark risk: editor uses tokens but body forces dark defaults.
- Legacy "Hardware Portal" styling lingers.
- Local wizard components may be unused.

## Files

- Modify: `apps/business-configurator/src/styles.scss` — replace hardcoded body background/color/font with semantic tokens (`background: var(--background); color: var(--foreground); font-family: var(--font-body);`).
- Modify: `apps/business-configurator/src/app/app.component.scss` — remove "Hardware Portal" styling.
- Audit + delete (or test): local wizard components if they are no longer routed.
- Confirm ThemeService bootstrap (depends on **cross-C**).

## Tasks

1. Snapshot findings: `node tools/scripts/check-client-ui-heuristics.mjs 2>&1 | grep '^apps/business-configurator/' > /tmp/bc-findings.txt`.
2. Replace hardcoded body styles with tokens.
3. Walk remaining 9 hex literals.
4. Search `apps/business-configurator` for "Hardware Portal" references; remove or repurpose.
5. Verify local wizard components: if routed, ensure they render; if not, delete and update tests.
6. Smoke: load `/`, confirm the editor renders with `professional` light + dark.

## Verification

- `pnpm exec nx lint business-configurator` clean.
- `pnpm exec nx build business-configurator` passes.
- `node tools/scripts/check-client-ui-heuristics.mjs 2>&1 | grep -c '^apps/business-configurator/'` is `0`.
- Editor (BusinessSiteEditorPageComponent) appearance is unchanged.

## Risks

- The shared editor may rely on the current dark body default; check side-by-side after removing it.

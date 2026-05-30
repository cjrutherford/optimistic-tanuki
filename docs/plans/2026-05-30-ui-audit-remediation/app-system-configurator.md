# System Configurator UI Remediation

**App:** `system-configurator` · **Audit findings:** 9 · **Effort:** L · **Personality:** `control-center` · **Status:** ✅ Done

**Source:** `docs/audits/client-app-ui-audit-2026-05-30.md` §system-configurator

## Goal

Preserve the HAI hardware-build identity while routing colors through semantic tokens, and decide whether the app is dark-only by product intent.

## Inputs from the audit

- Root sets `control-center` (correct).
- App/page styles dominated by hardcoded dark backgrounds, teal accents, white text.
- Light theme is effectively unsupported.
- Personality is strong; layout is effective.
- Inline page styles are large.

## Open product decision

- **Q:** Is `system-configurator` intentionally dark-only? If yes, document it and skip light theme work. If no, add a visible theme control and verify light mode.

## Files

- Modify: `apps/system-configurator/src/app/**/*.component.{ts,scss}` — extract repeated card/button/eyebrow styles into shared partials or components.
- Modify: page templates — replace fixed dark/teal/white with semantic tokens (`--background`, `--surface`, `--primary`, `--on-primary`).
- Modify: `apps/system-configurator/src/styles.scss` — define dark-only color-scheme if product confirms.

## Tasks

1. Resolve dark-only decision; document in `apps/system-configurator/README.md`.
2. Snapshot findings: `node tools/scripts/check-client-ui-heuristics.mjs 2>&1 | grep '^apps/system-configurator/' > /tmp/sysc-findings.txt`.
3. Extract repeated card/eyebrow/CTA styles into `apps/system-configurator/src/app/_shared/_configurator.scss` or a small component set.
4. Tokenize remaining hex usages using `control-center` personality outputs.
5. If light mode is supported, add a theme toggle in the configurator chrome and verify all sticky/summary surfaces.
6. Verify sticky summary + responsive configure grid behavior is preserved.

## Verification

- `pnpm exec nx lint system-configurator` clean.
- `pnpm exec nx build system-configurator` passes.
- `node tools/scripts/check-client-ui-heuristics.mjs 2>&1 | grep -c '^apps/system-configurator/'` is `0`.
- Manual: complete a configure → review → checkout walkthrough in the chosen modes.

## Risks

- Over-tokenizing can weaken the HAI hardware aesthetic; iterate with side-by-side comparisons.

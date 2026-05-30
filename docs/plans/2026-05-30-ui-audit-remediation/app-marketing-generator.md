# Marketing Generator UI Remediation

**App:** `marketing-generator` · **Audit findings:** 5 · **Effort:** S/M · **Personality:** `control-center`

**Source:** `docs/audits/client-app-ui-audit-2026-05-30.md` §marketing-generator

## Goal

Document the dark-only stance, isolate generated-asset CSS from app theme styles, and replace residual fallback colors with named variables — without breaking export fidelity.

## Inputs from the audit

- Root sets dark `control-center`. Styles already use theme tokens extensively.
- Dark-first is intentional; generated assets use hardcoded palettes (should stay).
- 5 residual hex literals.

## Files

- Modify: `apps/marketing-generator/README.md` — document dark-only stance.
- Modify: `apps/marketing-generator/src/app/**/*.{ts,scss}` — replace 5 hex literals with named variables.
- Modify: ensure generated-asset/export CSS lives under a clearly named directory or selector prefix (e.g., `.mg-export *` scope) so the lint script can be updated to allowlist it.
- Modify: `tools/scripts/check-client-ui-heuristics.mjs` (optional) — add a path-based exclusion for export styles.

## Tasks

1. Snapshot findings.
2. Document dark-only stance and personality default.
3. Replace 5 hex literals.
4. Audit generated-asset CSS for isolation; rename/prefix if needed so the heuristic script can allowlist by path.
5. If a script exclusion is added, document it in the cross-cutting D plan too.

## Verification

- `pnpm exec nx lint marketing-generator` clean.
- `pnpm exec nx build marketing-generator` passes.
- `node tools/scripts/check-client-ui-heuristics.mjs 2>&1 | grep -c '^apps/marketing-generator/'` is `0` (excluding allowlisted export CSS).

## Risks

- Over-tokenizing generator output can break export fidelity; only tokenize app chrome, never generated artifacts.

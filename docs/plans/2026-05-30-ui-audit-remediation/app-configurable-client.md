# Configurable Client UI Remediation

**App:** `configurable-client` · **Audit findings:** 3 · **Effort:** M · **Personality:** `foundation` · **Status:** ✅ Done

**Source:** `docs/audits/client-app-ui-audit-2026-05-30.md` §configurable-client

## Goal

Map tenant theme fields onto the standard personality variable names instead of legacy `--primary-color`/`--text-color`, and add guardrails for tenant `customCss`.

## Inputs from the audit

- Root sets `foundation`.
- Resolver writes legacy `--primary-color`/`--text-color` instead of standard variables.
- Light-only; tenant CSS can override contrast.
- Local section renderers duplicate patterns.

## Files

- Modify: the tenant theme resolver (find via `rg "primary-color" apps/configurable-client/src`) — write `--primary`, `--background`, `--foreground`, `--font-body`, etc.
- Modify: section renderer components — replace duplicated patterns with shared primitives once **cross-A** lands; until then, extract a local `_sections.scss`.
- Modify: tenant `customCss` injection — sanitize / scope under a `.tenant-overrides` wrapper to prevent global selector escapes.
- Modify: `apps/configurable-client/src/app/app.component.scss` and `styles.scss` — replace 3 hex literals.

## Tasks

1. Snapshot findings.
2. Update the resolver to write standard personality variables. Keep legacy aliases for one release (with a deprecation log when written).
3. Scope tenant `customCss` injection under a wrapper class; add a unit test verifying selectors do not leak globally.
4. Replace 3 hex literals.
5. Add an integration test that loads a sample tenant config and asserts ThemeService receives the mapped values.

## Verification

- `pnpm exec nx lint configurable-client` clean.
- `pnpm exec nx test configurable-client` passes.
- `pnpm exec nx build configurable-client` passes.
- `node tools/scripts/check-client-ui-heuristics.mjs 2>&1 | grep -c '^apps/configurable-client/'` is `0`.

## Risks

- Existing tenants depend on legacy variable names; keep the alias and log a deprecation when written.
- Tenant `customCss` is a runtime injection vector; sanitization scope must be validated.

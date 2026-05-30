# Fin Commander UI Remediation

**App:** `fin-commander` · **Audit findings:** 8 · **Effort:** M · **Personality:** `professional`

**Source:** `docs/audits/client-app-ui-audit-2026-05-30.md` §fin-commander

## Goal

Either promote the `--fc-*` "shark" identity into a formal theme-lib personality preset or fold it into the standard `professional` variables, then unstick the `color-scheme: light` issue.

## Inputs from the audit

- Defaults to `classic` while defining parallel `--fc-*` shark tokens.
- Global styles force `color-scheme: light` unless `body.dark` exists.
- Strong finance cockpit identity outside the personality system.
- Density is appropriate.

## Open product decision

- **Q:** Is the "shark" identity a brand pillar or a temporary skin?
  - **If brand pillar:** scope a separate plan to add a `shark` personality to `libs/theme-lib`.
  - **If skin:** map `--fc-*` to `professional` tokens and delete the parallel set.

## Files

- Modify: `apps/fin-commander/src/app/app.component.ts` — switch default personality (depends on **cross-C**).
- Modify: `apps/fin-commander/src/styles.scss` — remove forced `color-scheme: light` and base color logic on the actual ThemeService host class.
- Modify: `apps/fin-commander/src/**/*.scss` — either map `--fc-*` definitions to personality variables or delete them.

## Tasks

1. Resolve the brand decision; document in `apps/fin-commander/README.md`.
2. Snapshot findings.
3. Remove the `color-scheme: light` global; rely on ThemeService class to apply mode.
4. Implement the chosen path (promote vs. fold).
5. Walk remaining 8 hex literals.
6. Spec dark mode flips actually flip computed `color-scheme` and contrast.

## Verification

- `pnpm exec nx lint fin-commander` clean.
- `pnpm exec nx build fin-commander` passes.
- `node tools/scripts/check-client-ui-heuristics.mjs 2>&1 | grep -c '^apps/fin-commander/'` is `0`.
- Manual: dashboard contrast OK in light + dark.

## Risks

- Token migration can subtly alter financial contrast/spacing; require screenshots in the PR.

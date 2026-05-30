# Video Client UI Remediation

**App:** `video-client` · **Audit findings:** 16 · **Effort:** M · **Personality:** `electric`

**Source:** `docs/audits/client-app-ui-audit-2026-05-30.md` §video-client

## Goal

Replace the legacy `Sunset Vibes` palette API call with a documented personality, then tokenize the remaining generic Material/light components without regressing the cinematic dark identity.

## Inputs from the audit

- Strong reuse across navigation/auth/video-ui/store-ui/motion/HAI.
- Initialization uses an older palette API (`Sunset Vibes`) and legacy RGB variables.
- Cinematic dark mode is coherent; light/personality switching risks contrast issues.
- Account/channel components retain hardcoded Material-blue/light styles.

## Files

- Modify: `apps/video-client/src/app/app.component.ts` — replace palette API with `ThemeService.setPersonality('electric')` (depends on **cross-C**; decision: `electric` vs new `video` personality — capture in PR description).
- Modify: `apps/video-client/src/app/components/my-channel.component.{ts,scss}` — replace hardcoded Material-blue/light.
- Modify: account/channel views — replace fixed RGB fallbacks with `color-mix(var(--primary) X%, transparent)`.
- Migrate badge markup to `<otui-badge>` after **cross-B**.

## Tasks

1. Snapshot findings: `node tools/scripts/check-client-ui-heuristics.mjs 2>&1 | grep '^apps/video-client/' > /tmp/vc-findings.txt`.
2. Decide: `electric` (use existing personality) or create a `video` personality preset. If new preset, scope as a separate plan in `libs/theme-lib`.
3. Migrate bootstrap to `setPersonality(...)`.
4. Replace 16 hex literals.
5. Manual smoke on watch/home/channels at light + dark, verify cinematic dark feel survives.

## Verification

- `pnpm exec nx lint video-client` clean.
- `pnpm exec nx build video-client` passes.
- `node tools/scripts/check-client-ui-heuristics.mjs 2>&1 | grep -c '^apps/video-client/'` is `0`.

## Risks

- A generic-personality migration could regress the strong cinematic design; gate behind product review with side-by-side screenshots.

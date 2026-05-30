# Store Client UI Remediation

**App:** `store-client` · **Audit findings:** 68 → **0** · **Effort:** M/L · **Personality:** `playful` · **Status:** ✅ Done (slice 7)

**Source:** `docs/audits/client-app-ui-audit-2026-05-30.md` §store-client

## Goal

Bring the storefront — especially the bookings page — onto the `playful` personality tokens with WCAG-compliant dark mode and consistent semantic statuses.

## Inputs from the audit

- Root sets dark `playful` with pink primary.
- Globals use legacy aliases; page styles hardcode Bootstrap-like light colors.
- `apps/store-client/src/app/pages/bookings/bookings.component.scss` is the largest dark-mode regression risk (white cards + dark text).
- Bookings uses blue/purple gradients foreign to `playful`.
- Cart/catalog/donations/forum are mostly fine.

## Files

- Modify: `apps/store-client/src/styles.scss` — normalize legacy aliases (keep as `@deprecated` fallbacks only).
- Modify: `apps/store-client/src/app/pages/bookings/bookings.component.{ts,html,scss}` — full tokenization pass.
- Modify: status/state styles across catalog/cart — adopt semantic tone tokens from **cross-B**.
- Add (optional): visual regression snapshots for bookings, cart, catalog (light + dark).

## Tasks

1. Snapshot findings: `node tools/scripts/check-client-ui-heuristics.mjs 2>&1 | grep '^apps/store-client/' > /tmp/sc-findings.txt`.
2. Audit `apps/store-client/src/styles.scss` for legacy variable aliases (`--text-color`, `--primary-color`, etc.); document which still have callers; replace callers; keep the alias for one release with a deprecation comment.
3. Rewrite bookings:
   - Cards: `background: var(--surface); color: var(--foreground);`
   - Status pills: switch to `<otui-badge tone="…">` once **cross-B** lands; until then, use a local mixin sourcing `--info|success|warning|danger`.
   - Replace blue/purple gradients with `--primary`/`--accent` from `playful`.
4. Walk remaining 78 findings file-by-file.
5. Add Playwright smoke for `/bookings` in light + dark verifying no white-on-white text.
6. Verify donations/forum routes still render correctly after global alias normalization.

## Verification

- `pnpm exec nx lint store-client` clean.
- `pnpm exec nx build store-client` passes.
- `pnpm exec nx test store-client` passes; new smoke included.
- `node tools/scripts/check-client-ui-heuristics.mjs 2>&1 | grep -c '^apps/store-client/'` is `0`.
- Manual: bookings, cart, catalog reviewed in light + dark.

## Risks

- Bookings has hidden state-driven styles; a visual regression suite is strongly recommended before merge.
- Legacy aliases may have third-party tenant-customization callers; keep the alias for one release minimum.

## Implementation notes (slice 7, 2026-05-30)

- Expanded `apps/store-client/src/styles.scss` `:root` with the full Playful palette plus text scale (`--text-strong/-secondary/-muted/-disabled`), surface/border scale, neutral button palette (`--neutral`, `--neutral-hover`), status palette, and soft-alert tokens (`--success/-danger/-warning/-info-soft-bg/-fg/-border`, `--neutral-soft-*`, `--info-tint-*`). Added `[data-theme='dark']` overrides for surfaces and text scale.
- Tokenized 4 component SCSS files (`app.component`, `bookings.component`, `catalog.component`, `donations.component`) via length-sorted hex→token map; stripped inline `var(--token, #hex)` fallbacks.
- Bookings status pills now consume `--success/danger/warning/info/neutral-soft-bg|-fg` rather than raw Bootstrap hexes.
- Button palette: `.btn-primary` → `var(--accent)`/`var(--accent-hover)`; `.btn-secondary` → `var(--neutral)`/`var(--neutral-hover)`; `.btn-danger` → `var(--danger)`/`var(--danger-hover)`.
- Deferred (cross-F): legacy alias deprecation pass (kept aliases for one release), Playwright dark-mode smoke for `/bookings`, otui-badge migration for status pills (waits on cross-B integration).
- Verified: `pnpm exec nx lint store-client` clean, `pnpm exec nx test store-client` 3/3 suites pass, `pnpm run ui:heuristics:ci` passes with `store-client: 0` pinned.

# Cross-Cutting B: Themed Badge / Chip / Pill Component

**Goal:** Replace hardcoded badge/chip/pill colors with one themed component (or directive + semantic classes) so semantic categories (info, success, warning, danger, neutral, brand) render consistently across light/dark and every personality.

## Scope (revised 2026-05-30 after `common-ui` audit)

`BadgeComponent` already exists at `libs/common-ui/src/lib/common-ui/badge.component.ts` with `variant: 'success' | 'primary' | 'warning' | 'error' | 'neutral'` and `size: 'sm' | 'md' | 'lg'`. It is theme-aware via the `Themeable` base class.

Remaining work for this plan:

1. Audit theme-lib output (`libs/theme-lib/src/lib/personalities/*.ts`) for `--success / --warning / --danger / --info` and corresponding `--on-*` tokens across every personality. Add any that are missing with WCAG-AA-passing defaults.
2. Add a **`variant: 'solid' | 'soft' | 'outline'`** modifier (separate from `BadgeVariant` — rename the existing `variant` input to `tone` over one release, keeping `variant` as a deprecated alias).
3. Replace the hardcoded fallbacks in `badge.component.scss` (`#4caf50`, `#6e8efb`, `#ff9800`, `#f44336`, `white`) with token-only references once theme-lib coverage is verified.
4. Add Storybook stories under `libs/common-ui/.storybook` showing all tone × variant × size combinations in light + dark across at least 3 personalities.
5. Document the migration playbook in `libs/common-ui/README.md` showing before/after for one caller from the audit's list.

This plan delivers the **component upgrade only**; per-app plans migrate callers in their own PRs.

Per the audit (`docs/audits/client-app-ui-audit-2026-05-30.md` §B), the initial callers to migrate are:

- `apps/leads-app/src/app/leads.component.scss`
- `apps/store-client/src/app/pages/bookings/bookings.component.scss`
- `apps/owner-console/src/app/components/theme-management.component.ts`
- `apps/client-interface/src/app/app.component.scss`
- `apps/video-client/src/app/components/my-channel.component.ts`

This plan delivers the **component only**; per-app plans handle migration in their own PRs.

## Decision: keep existing component, extend it

`BadgeComponent` (component, standalone, theme-aware) already exists. Keep and extend it. Do NOT introduce a parallel component.

API after this plan:

```ts
@Input() tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'brand' = 'neutral';
/** @deprecated use `tone` */
@Input() variant: BadgeVariant = 'neutral';
@Input() shape: 'solid' | 'soft' | 'outline' = 'soft';
@Input() size: 'sm' | 'md' | 'lg' = 'md';
@Input() icon: 'check' | 'star' | 'shield' | 'none' = 'none';
```

All colors derive from semantic tokens:

- `solid` → `background: var(--<tone>); color: var(--on-<tone>);`
- `soft` → `background: color-mix(in oklab, var(--<tone>) 18%, transparent); color: var(--<tone>);`
- `outline` → `background: transparent; color: var(--<tone>); border: 1px solid var(--<tone>);`

Tone-to-CSS-variable mapping (`brand` aliases to `--primary`/`--on-primary`):

| Tone    | Background var      | Foreground var |
| ------- | ------------------- | -------------- |
| neutral | `--surface-variant` | `--foreground` |
| info    | `--info`            | `--on-info`    |
| success | `--success`         | `--on-success` |
| warning | `--warning`         | `--on-warning` |
| danger  | `--danger`          | `--on-danger`  |
| brand   | `--primary`         | `--on-primary` |

Missing tone tokens must be added to `libs/theme-lib` with light/dark defaults per personality; coordinate with the personality system owner.

## Files

- Create: `libs/common-ui/src/lib/badge/badge.component.{ts,html,scss,spec.ts}`
- Modify: `libs/common-ui/src/index.ts`
- Modify: `libs/theme-lib/src/lib/personalities/*.ts` — add `--info|success|warning|danger|on-*` tokens if missing.
- Modify: `apps/ui-playground/src/...` — add a story showing all tones × variants × sizes in light + dark for at least 3 personalities.

## Tasks

1. Audit current usage of badges/chips/pills (rg `badge|chip|pill` in `apps/`); attach to PR.
2. Confirm tone token coverage across all personalities; add missing ones with WCAG AA-passing defaults (use `tools/scripts/check-client-ui-heuristics.mjs` and manual contrast checks).
3. Implement `BadgeComponent` with the API above and SCSS using only tokens.
4. Add specs for tone/variant/size combinations.
5. Add playground stories with light/dark toggle and personality switcher.
6. Document migration in `libs/common-ui/README.md` with before/after for one of the five caller files.

## Verification

- `pnpm exec nx test common-ui` passes.
- `pnpm exec nx test theme-lib` passes (token additions covered).
- `pnpm exec nx build ui-playground` passes.
- Manual contrast check passes WCAG AA at sm + md sizes for every tone × variant in light and dark.

## Risks

- Token additions touch every personality; coordinate the PR to avoid merge conflicts with other personality work.
- Existing badges may encode business state via specific colors; document a tone-mapping table in each per-app plan that consumes this component.

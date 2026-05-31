# Cross-Cutting A: Shared UI Primitives

**Goal:** Promote four duplicated UI patterns into reusable, themed primitives so per-app remediation plans can replace bespoke implementations.

**Why first:** Several per-app plans (`client-interface`, `digital-homestead`, `developer-portal`, `local-hub`, `leads-app`, `fin-commander`, `owner-console`, `marketing-generator`) call out the same recurring patterns. Building them centrally avoids 5+ parallel reinventions.

**Owner library:** `libs/common-ui` (preferred) or a new `libs/ui-primitives` if scope balloons.

## Scope (revised 2026-05-30 after `common-ui` audit)

`common-ui` already has `HeroSectionComponent`, `SectionHeadingComponent`, `TileComponent`, `ChipComponent`, `BadgeComponent`. After inspection:

1. **`SectionHeadingComponent` tokenization** — already exists; defaults hardcode `#fff` and `rgba(33,33,33,0.15)`. Replace with semantic tokens so it can serve as the shared page-header. No new component.
2. **`<otui-metric-tile>`** — net new. `TileComponent` is a generic variantable card and is the wrong shape for label/value/delta metrics.
3. **`<otui-empty-state>` / `<otui-loading-state>` / `<otui-error-state>`** — net new.

(Badge/chip is a separate plan, **cross-B**.)

## Files

- Modify: `libs/common-ui/src/lib/common-ui/section-heading/section-heading.component.{ts,html,scss}` — replace hardcoded color defaults with semantic tokens.
- Create: `libs/common-ui/src/lib/common-ui/metric-tile/metric-tile.component.{ts,html,scss,spec.ts}`
- Create: `libs/common-ui/src/lib/common-ui/states/{empty,loading,error}-state.component.{ts,html,scss,spec.ts}`
- Modify: `libs/common-ui/src/lib/common-ui/index.ts` — export new components and any updated types.
- Modify: `libs/common-ui/README.md` (create if missing) — usage examples for each primitive.

## Tasks

1. Inventory existing implementations (rg for "page-header", "hero", "metric", "empty-state" in `apps/`); attach the list to the PR description.
2. Define a minimal `@Input()` API for each component (no business-domain types).
3. Implement components as standalone Angular components, with styles using **only** semantic tokens (`--background`, `--foreground`, `--surface`, `--primary`, `--on-primary`, `--muted-foreground`, `--border`, `--radius-md`).
4. Add stories or examples in `apps/ui-playground` for each primitive (light + dark + 2 personalities).
5. Write specs covering: renders projected content, applies tone variants, exposes the action slot.
6. Document migration notes in `libs/common-ui/README.md` showing the before/after for one app.
7. Open an umbrella tracking issue listing every per-app plan that should consume the new primitives in follow-up PRs.

## Non-goals

- Migrating callers in this PR. Each per-app plan handles its own migration.
- Theme/personality refactors. This is pure primitive extraction.

## Verification

- `pnpm exec nx test common-ui` passes (or `nx test ui-primitives` if the new lib is used).
- `pnpm exec nx build ui-playground` passes; primitives render correctly in playground.
- `pnpm exec nx lint common-ui` clean.

## Risks

- API surface drift: keep inputs minimal and additive; prefer content projection over many inputs.
- Bundle impact: primitives must be tree-shakeable standalone components.

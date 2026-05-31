# Cross-Cutting E: Primitive Storybook Stories + Migration Docs

**Goal:** Backfill the items deferred from slice 1 (cross-A): Storybook stories for the new common-ui primitives and `libs/common-ui/README.md` migration examples grounded in real before/after code from the per-app slices.

**Why last:** The migration examples should reference real callers that have actually been migrated; running this slice after the per-app work guarantees the examples are accurate instead of hypothetical.

## Scope

1. Add Storybook stories for the primitives introduced in slice 1:
   - `MetricTileComponent` — coverage: value-only, value + delta up/down/flat, value + caption, with sparkline slot content, all four tones, light + dark, foundation + control-center + bold personalities.
   - `StateMessageComponent` (+ `EmptyStateComponent` / `LoadingStateComponent` / `ErrorStateComponent` wrappers) — coverage: each kind/tone, with and without body, with and without actions slot, with custom `[slot=icon]` content.
   - `SectionHeadingComponent` refresh — coverage: with/without eyebrow, with/without subheading, with projected actions content, default (token-driven) vs. legacy-input override.
2. Update `libs/common-ui/README.md` (create if missing) with a "Primitives" section documenting the new components plus migration snippets pulled from at least one per-app remediation PR per primitive (page-header from a per-app slice that adopted `<otui-section-heading>`, metric tile from `leads-app` or `owner-console`, state message from a dashboard caller).

## Files

- Create: `libs/common-ui/src/lib/common-ui/metric-tile/metric-tile.component.stories.ts`
- Create: `libs/common-ui/src/lib/common-ui/states/state-message.component.stories.ts`
- Create or update: `libs/common-ui/src/lib/common-ui/section-heading/section-heading.component.stories.ts`
- Create or update: `libs/common-ui/README.md`

## Tasks

1. Audit existing storybook stories under `libs/common-ui/src/lib/common-ui/**/*.stories.ts` to follow the established Story authoring pattern.
2. Add stories for each new primitive with light + dark and at least 3 personalities (`foundation`, `control-center`, `bold`).
3. Capture before/after migration snippets while scanning the per-app PRs that have already landed.
4. Verify `pnpm exec nx build-storybook common-ui` builds without warnings.
5. Verify `pnpm exec nx test common-ui` still passes (no story-driven regressions).

## Verification

- `pnpm exec nx build-storybook common-ui` passes.
- `pnpm exec nx test common-ui` passes.
- README renders correctly on GitHub (preview the markdown locally if possible).

## Risks

- Storybook addon configuration drift; mirror an existing story file rather than copying boilerplate from upstream docs.
- Examples pulled from a per-app PR that later gets revised — link by commit SHA so the snippets stay accurate.

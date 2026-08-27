---
title: Personality Token Adoption — UI Library Estate Rollout — Close-out
date: 2026-07-19
status: complete — batches 0–7 landed
summary: Close-out record for the personality-token adoption rollout across the UI library estate — batch commits, estate end-state, legacy-var regression sweep, and follow-ups discovered but out of scope.
---

# Personality Token Adoption — Close-out

This closes the rollout plan captured at
`/home/cjrutherford/.claude/plans/now-please-go-through-serene-lagoon.md`, which
itself builds on `2026-07-18-personality-styles-refactor.md` (phases 1–6: dead
18-way duplicated personality SCSS estate removed, shadow/background pipelines
fixed, `libs/theme-styles/src/lib/personality/` created as the curated shared
partial home). That plan fixed the _pipeline_; this one drove _adoption_ of it
across the component estate, library by library, plus a user-reported compose
visual glitch.

## Batches landed

| Batch | Commit                                    | Scope                                                                                                                                                                                                   |
| ----- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | `3350ae71`                                | Compose glitch fix + card hygiene: opt-in `textured` input gating `p.surface-texture()`, `bottom: -2` → `-2px` fix, `.personality-architec` typo fix, blog-compose missing `&` on drag-state `::after`. |
| 1     | `49a04f18`                                | common-ui foundation: `styles/mixins.scss` 1,391 → 292 lines; 13 legacy-vocab components migrated to the contract; `--radius-md` naming bug fixed.                                                      |
| 2     | `9eaa6c0f`                                | motion-ui (canonical exemplar) + message-ui, navigation-ui, persona-ui, business-ui, auth-ui.                                                                                                           |
| 3     | `7b5eab44`                                | profile-ui, store-ui + ag-grid-ui (real ag-grid v32+ Theming API bridge, not rule swaps).                                                                                                               |
| 4     | `56268b48`                                | project-ui (elevation/motion tokens added from scratch), blogging-ui, chat-ui.                                                                                                                          |
| 5     | `b4485011`                                | form-ui: `_mixins.scss` 469 → 47 lines; five form controls onto the input contract.                                                                                                                     |
| 6     | `064773d9`                                | forum-ui (108 dead `--accent` refs migrated, storybook `:root` mock aligned) + social-ui (lib-local `mixins.scss` 410 → 168 lines, compose.component.scss's 17 hardcoded shadows tokenized).            |
| 7     | _(this session, uncommitted — see below)_ | community-ui mop-up (6 SCSS files, ~3,107 lines) + this estate-wide close-out and verification.                                                                                                         |

Batch 7 was executed under the constraint **do not commit** — its diff is left
in the working tree for the caller to review and commit.

## Estate end-state

**16 of 16 SCSS-bearing libraries converted** onto `libs/theme-styles/src/lib/personality/`
(`p.shadow($size)`, `p.personality-transition()`, `p.surface-texture()`):
motion-ui, message-ui, navigation-ui, persona-ui, business-ui, auth-ui,
ag-grid-ui, profile-ui, store-ui, project-ui, blogging-ui, chat-ui, form-ui,
forum-ui, social-ui, community-ui.

**7 libs correctly skipped** (no SCSS): notification-ui, search-ui, video-ui,
compose-lib, payments-ui, finance-ui, leads-ui.

**Lines removed across the three dead lib-local mixin estates** (the
duplicated-mixin problem the plan set out to collapse, on top of phase 1's
prior removal of the 18-way duplicated `personality-tokens.scss` /
`personality-effects.scss` pair — 13,092 lines across 49 files, commit
`97cf745d`, pre-dating batch numbering):

| Estate                                 | Before | After | Batch |
| -------------------------------------- | -----: | ----: | ----- |
| `common-ui/src/lib/styles/mixins.scss` |  1,391 |   292 | 1     |
| `form-ui/src/lib/styles/_mixins.scss`  |    469 |    47 | 5     |
| `social-ui/src/lib/styles/mixins.scss` |    410 |   168 | 6     |

### Batch 7 (community-ui) detail

community-ui was already the strongest adopter in the estate before this
batch: radii were already 100% on `var(--border-radius-*)`, fonts already on
`var(--font-*, fallback)`, transitions already reading
`var(--animation-duration-*)`/`var(--animation-easing)`, and zero hex colors —
the only gap was that none of it went through the shared `personality` partial
and standard-elevation shadows were spelled out as raw `var(--shadow-*)`
instead of `@include p.shadow($size)`.

Across the 6 component SCSS files (`community-posts`, `create-community`,
`find-communities`, `manage-groups`, `manage-members`, `shell` —
`community-chat` has no `.scss`, its styles are inline in the `.ts`, out of
scope, see follow-ups):

- Added `@use 'personality' as p;` to all 6 files (0 → 6).
- Converted 41 single-value elevation `box-shadow` declarations (including
  `none`) to `@include p.shadow($size)`.
- Converted 14 transition declarations to `@include p.personality-transition()`
  (single- and same-speed multi-property forms, e.g.
  `(box-shadow, transform), 'fast'`).
- Left untouched, matching estate precedent (forum-ui/social-ui): compound
  shadows combining a base elevation var with a custom glow
  (`box-shadow: var(--shadow-lg), 0 0 20px color-mix(...)`), `!important`
  shadow/radius declarations (the mixin has no `!important` param), and one
  mixed-speed compound transition on `.groups-sidebar` (width/min-width at
  `normal` speed, box-shadow at `fast` — already fully on contract vars, just
  not mixin-wrappable since the mixin takes one `$speed`).
- No `ng-package.json`/`styleIncludePaths` change needed: unlike motion-ui,
  community-ui has no `build` target (no ng-packagr) — its `stylePreprocessorOptions.includePaths`
  comes from the app-level `client-interface:build` browserTarget it borrows,
  which already carries the workspace `nx.json` include path.
- No `.storybook` `:root` mock to align: community-ui's `preview.ts` already
  uses the shared `StorybookThemeBridgeComponent`, same as motion-ui.
- The extensive `--local-background` / `--local-foreground` / `--local-accent`
  / `--local-complement` / `--local-border-color` / `--local-border-gradient`
  / `--local-variant` usage across all 6 files was **triaged, not migrated**:
  every component (`CommunityShellComponent`, `CreateCommunityComponent`,
  `FindCommunitiesComponent`, `ManageGroupsComponent`, `ManageMembersComponent`)
  extends common-ui's `Variantable`/`Themeable` and host-binds these as live
  per-instance values computed in `applyVariant()` from `ThemeColors` (e.g.
  `this.accent = colors.accent`) — the same documented pattern as
  common-ui's `tile.component.scss` per-instance override API and chat-ui's
  compose-chat/chat-window `--local-*` bindings. These are a legitimate
  write-only host API, not the dead global fallback vocabulary the Decisions
  section targets, so they were left as-is.

Verification: `nx test community-ui` (10/10 passing, unchanged — only 3 of 7
components have spec files, a pre-existing coverage gap, not something this
batch weakened), `nx lint community-ui` (clean), `nx build-storybook
community-ui` (fails — pre-existing, see follow-ups, reproduced identically
on unmodified code via `git stash`).

## Estate-wide verification (this session)

1. `pnpm nx run-many -t test -p common-ui theme-ui theme-lib theme-models community-ui` — **green** (3 suites cached/run, all passing; community-ui 10/10).
2. `pnpm nx build ui-playground` — **succeeds** (only pre-existing Sass `mixed-decls` deprecation warnings and component budget-size warnings, none newly introduced).
3. `pnpm nx build forgeofwill` — **succeeds** (same pre-existing warning classes).
4. `pnpm run check:no-personality-scss` — **passes** (no `personality-tokens.scss`/`personality-effects.scss` reintroduced anywhere).
5. `pnpm nx build-storybook common-ui` — **succeeds**.
   `pnpm nx build-storybook theme-ui` — **succeeds**.
6. Legacy-var regression sweep — see table below.

### Legacy-var regression sweep

Repo-wide grep across `libs/*/src/**/*.scss` for `--accent`, `--complement`,
`--local-`, `--border-color`, `--foreground-color`, `--radius-md`
(word-boundary aware; `--border-radius-md` excluded by construction).

| Hit                                                                                                                                                                                                                                                                         | Classification                         | Notes                                                                                                                                                                                                                                                                                                                                                                                |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `common-ui/tile/tile.component.scss` — `var(--border-color, ...)`                                                                                                                                                                                                           | **Expected exception**                 | Documented per-instance override API (batch 1).                                                                                                                                                                                                                                                                                                                                      |
| `chat-ui/compose-chat/compose-chat.component.scss` — bare `--accent`/`--complement`/`--border-color`                                                                                                                                                                        | **Expected exception**                 | In-file comment: self-bound host vars, documented in batch 4.                                                                                                                                                                                                                                                                                                                        |
| `chat-ui/chat-window/**` (`chat-window`, `participants`, `message-list`) — `--local-border-color`, `--local-accent-transparent`                                                                                                                                             | **Expected exception**                 | In-file comments: computed per-instance host bindings, documented in batch 4.                                                                                                                                                                                                                                                                                                        |
| `blogging-ui/blog-compose*` / `rich-text-toolbar.component.scss` — `--local-background-gradient`                                                                                                                                                                            | **Expected exception**                 | Live per-instance gradient host binding, documented in batch 4/0.                                                                                                                                                                                                                                                                                                                    |
| `social-ui/compose/components/rich-text-toolbar.component.scss`, `social-ui/compose/extensions/angular-component-node.styles.scss`, `social-ui/link/link.component.scss`, `social-ui/attachment/attachment.component.scss` — `--accent`/`--complement`/`--local-*` mentions | **Expected exception (comments only)** | Explanatory comments documenting the batch-6 migration; grep confirms zero live bindings.                                                                                                                                                                                                                                                                                            |
| `ag-grid-ui/ag-grid-ui.component.scss` — `--local-background`, `--local-foreground`, `--local-border-color`                                                                                                                                                                 | **Expected exception**                 | In-file comment: `Themeable`/host-bound tier, documented in batch 3.                                                                                                                                                                                                                                                                                                                 |
| `profile-ui/profile-selector.component.scss`, `project-ui/analytics-dashboard*`, `project-ui/task-kanban*`, `project-ui/task-calendar*`, `auth-ui/confirm-block*` — `--accent`/`--complement` mentions                                                                      | **Expected exception (comments only)** | Explanatory comments about prior migrations.                                                                                                                                                                                                                                                                                                                                         |
| `community-ui/**` (5 of 6 files) — `--local-*` host-bound vars                                                                                                                                                                                                              | **Expected exception (this batch)**    | See batch 7 detail above: `Variantable`/`Themeable` per-instance API, same class as tile/compose-chat/chat-window.                                                                                                                                                                                                                                                                   |
| `theme-ui/utilities.scss`, `theme-ui/palette-manager.component.scss`, `theme-ui/palette-selector.component.scss` — bare `var(--accent, #3f51b5)` / `var(--complement, #c0af4b)`                                                                                             | **NEW finding — reported, not fixed**  | theme-ui's own components were never in the plan's 16-lib rollout list (theme-ui hosts the _showcase_ stories used to verify other libs, but its own `palette-manager`/`palette-selector`/`utilities.scss` were out of scope). Live legacy vars with hex fallback, the exact anti-pattern this rollout targets. Out of scope for batch 7 (not community-ui); flagged as a follow-up. |
| `theme-styles/components/toolbar.scss` — `var(--local-accent, var(--accent))`, `var(--local-complement, var(--complement, #c0af4b))`                                                                                                                                        | **NEW finding — reported, not fixed**  | Lives under `theme-styles/src/lib/components/`, a different concern from the curated `personality/` partial home; not part of the 16-lib estate scan. Same fallback-chain anti-pattern. Out of scope for batch 7; flagged as a follow-up.                                                                                                                                            |
| `hai-ui/hai-about-modal/hai-about-modal.component.scss` — heavy bare `var(--accent)`/`var(--complement)` usage, including `--local-hai-*` fallback chains terminating on bare `--accent`                                                                                    | **NEW finding — reported, not fixed**  | hai-ui is not one of the 16 libs in the plan's estate rollout order — it appears to postdate the original exploration passes. Out of scope for batch 7 (not community-ui); flagged as a follow-up.                                                                                                                                                                                   |

No new live hits were found inside any lib owned by an earlier batch that
would indicate regression — every non-community-ui hit above is either a
previously-documented exception or an explanatory comment. The three NEW
findings (theme-ui, theme-styles/components/toolbar.scss, hai-ui) are all
**outside** community-ui and were left unfixed per this batch's scope
constraint; they're carried into the follow-ups below.

## Pre-existing issues discovered but out of scope

Carried forward from earlier batches, plus one newly confirmed this session:

- persona-ui: `.storybook/tsconfig.json` missing.
- `@storybook/jest` absent from `package.json`, affecting ~20 story files.
- store-ui: storybook tsconfig path issue.
- navigation-ui: storybook i18n tsconfig bug.
- forum-ui: stale `TopicDto` story mocks.
- business-detail: `a&` selector bug.
- form-ui: select component spec failure (1 pre-existing, stash-proven).
- motion-ui: `storybook-share-target` spec failure.
- **community-ui** (confirmed this session): `pnpm nx build-storybook
community-ui` fails with `Cannot read file './.storybook/tsconfig.json'`.
  Root cause: community-ui has no ng-packagr `build` target of its own (see
  batch 3's infrastructure finding — motion-ui is the estate's only buildable
  lib) and its `storybook`/`build-storybook` targets borrow
  `browserTarget: "client-interface:build"` from the `client-interface` app,
  which drags in that app's i18n locale configuration with a relative
  tsconfig path that doesn't resolve from the repo-root cwd nx executes from.
  Reproduced identically on unmodified `HEAD` via `git stash`, confirming
  it predates and is unrelated to this batch's SCSS edits.

## Recommended follow-ups

1. **Fix the storybook configs** listed above (persona-ui, store-ui,
   navigation-ui, forum-ui, business-detail, form-ui, motion-ui, and now
   community-ui) — none block the personality-token rollout itself, but they
   block reviewers from doing the plan's prescribed visual sweep
   (`personality-showcase`/`personality-grid`/`personality-surfaces` 12-across)
   on the affected libs.
2. **Extend the rollout to `.ts` inline-template styles.** Flagged repeatedly
   across batches (blogging-ui, social-ui) and confirmed again here:
   community-ui's `community-chat.component.ts` has inline `styles: [...]`
   with `var(--local-complement, #666)`, `var(--local-accent, #4a90d9)`, and a
   bare `#dc3545` hex — the same class of gap, just outside `.scss` files
   entirely, so it wasn't touched by this or any prior batch.
3. **Wire or remove the orphaned tooltip stylesheet** (common-ui,
   flagged in batch 1 — `tooltip.scss` was tokenized but found to have zero
   consumers wiring it up).
4. **The write-only `--local-*` host APIs** in form-ui, store-ui, and
   common-ui (and, per this session's sweep, ag-grid-ui) — directives set
   these vars but no SCSS anywhere reads some of them. Worth an audit pass to
   either wire them up or delete the dead host bindings.
5. **New from this close-out**: migrate `theme-ui`'s own components
   (`utilities.scss`, `palette-manager.component.scss`,
   `palette-selector.component.scss`) and `theme-styles/src/lib/components/toolbar.scss`
   off the bare `--accent`/`--complement` legacy vocabulary — both were
   outside the plan's original 16-lib scope and were never converted.
6. **New from this close-out**: `hai-ui` was not part of the original 16-lib
   estate inventory and has not been audited or converted at all — it should
   go through the same per-lib checklist as a fresh follow-up batch.

## Verification commands (for reproduction)

```bash
pnpm nx run-many -t test -p common-ui theme-ui theme-lib theme-models community-ui
pnpm nx build ui-playground
pnpm nx build forgeofwill
pnpm run check:no-personality-scss
pnpm nx build-storybook common-ui
pnpm nx build-storybook theme-ui
pnpm nx test community-ui
pnpm nx lint community-ui
```

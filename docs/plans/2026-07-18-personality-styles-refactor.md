---
title: Personality Styles — Consolidation & Background/Shadow Variation Plan
date: 2026-07-18
status: in progress — phases 1–6 implemented (C3 landed 2026-07-18)
summary: Refactoring plan to remove the dead per-lib personality SCSS estate, fix two broken pipelines (shadow tint and page-background encoding), and give every personality a distinct page background and shadow identity — reviewed by fact-check and architecture subagent passes.
---

# Personality Styles — Consolidation & Background/Shadow Variation Plan

## Context

This plan builds on `2026-07-14-theme-personality-distinctiveness.md` (whose C1/C2
utilities — `personality-distinctiveness.ts`, `personality-fonts.spec.ts` — have
landed). That plan targets the _data_ layer (personality definitions). This plan
targets the _style delivery_ layer: the SCSS that ships with every UI library, and
the two token dimensions that are thinnest in practice — **shadows** (4 unique
intensities across 12 personalities, every rendered shadow neutrally colored) and
**backgrounds** (0 of 12 personalities actually render one — see finding 5).

All factual claims below were verified against the repo (file/line cites) and
independently re-verified by a fact-check review pass; the design was critiqued
by an architecture review pass. Both reviews are incorporated.

## Analysis — what the codebase shows today

### 1. The personality SCSS is copy-pasted into 18 libraries — and it is dead code

Every `*-ui` library carries its own `src/lib/styles/personality-tokens.scss` and
`personality-effects.scss`:

- **Tokens:** 18 copies; 15 byte-identical; `form-ui`, `forum-ui`, `social-ui`
  have drifted (form-ui appended `form-input-*` and extra `focus-ring-*` mixins;
  forum/social stripped comments and re-ordered maps).
- **Effects:** 18 copies; 15 identical; the same three libs drifted — each pasted
  a _subset_ of the shared mixins and appended lib-specific mixins
  (`forum-card`, `post-card`, `checkbox-custom`, …) into the same file.

The decisive finding (verified twice, independently): **nothing consumes any of
it.** Exactly 9 component SCSS files `@use` these partials (common-ui `button`/
`card`/`tabs`, form-ui's five inputs, social-ui `post`) and not one of them —
nor any other file in the repo — `@include`s a single mixin from either file.
Even the drifted libs' own additions are dead (forum-ui's copies have zero
importers at all). The only CSS the files emit into bundles is the
`:root`/`.personality-*` blocks duplicated into those 9 components' styles,
which set quoted-string custom properties (`'soft'`, `'medium'`) that nothing
meaningful reads — the theme service never sets them (the file's ":root —
overridden by theme service" comment is wrong; the service emits
`--personality-border-radius` / `--personality-box-shadow` instead,
`theme.service.ts:738–746`), and the only readers are two Playwright specs
(`client-interface-e2e`/`forgeofwill-e2e` `personality-modal-sidebar.spec.ts`)
that `console.log` the value without asserting.

So this is not "shared infrastructure that drifted" — it is an 18-way-duplicated
aspiration that was never wired up. That reframes the refactor: **delete, then
curate**, not shim-and-migrate.

### 2. `theme-styles` is the designated shared home, but its documented usage has never worked

`libs/theme-styles/src/index.ts` documents
`@use '@optimistic-tanuki/theme-styles/mixins' as *;`, yet: the package has no
`tsconfig.base.json` mapping, no project declares it as a dependency, so pnpm
links it only into its fallback store — **not resolvable** from any app or lib
source. It contains one SCSS file (`components/toolbar.scss`) and has zero
consumers. There is no cross-library bare-specifier SCSS import anywhere in the
repo, and no `stylePreprocessorOptions` in any project config. The shared home
exists in name only; the import mechanism must be established for the first
time, not "confirmed."

### 3. The shadow-personality pipeline is wired at both ends but severed in the middle

- The model is rich: every personality declares `colorGeneration.shadowTint`
  (`neutral | primary-tint | warm | cool`) and `shadowOpacity` (0 → 0.25), plus
  `tokens.shadowIntensity` / `shadowMultiplier` and a hand-authored
  `presentation.shadow.value` literal.
- `theme.service.ts` computes a tinted, mode-aware `shadowColor` via
  `generateShadowColor()` (`color-harmony.ts:578`) and emits it as
  `--shadow-color` / `--shadow-opacity` (lines 541–545, 805–808).
- **But** `generatePersonalityShadows()` (line 838) — which produces the
  `--shadow-sm/md/lg/xl` variables consumed by ~120 files — hardcodes
  `rgba(0, 0, 0, opacity)` (line 846). The tint never reaches a rendered
  shadow; no component consumes `var(--shadow-color)` anywhere. `warm`, `cool`,
  and `primary-tint` personalities all cast identical neutral shadows.
- A second, parallel shadow contract _does_ render: `presentation.shadow.value`
  is emitted as `--personality-box-shadow` / `--personality-card-shadow`
  (lines 745, 769) and consumed by 17 files (chiefly common-ui
  `button.component.scss`). These literals are hand-authored — and all of them
  are neutral `rgba(0,0,0,…)` or `none`, including the three personalities
  (`playful`, `electric` → `neon`; `soft-touch` → `glow`) whose declared
  `presentation.shadow.style` promises colored effects. The
  `PersonalityShadowStyle` type has offered `neon`/`glow` since it was written;
  no CSS implements them.
- Two-contract hazard: retuning `--shadow-*` without also regenerating
  `--personality-box-shadow` recreates the dual-source-of-truth failure the
  07-14 plan's A1 just eliminated for fonts (see the cautionary comment at
  `personality.interfaces.ts:321–328`).

### 4. Opacity semantics are double-booked

`generateShadowColor()` bakes a mode-dependent alpha (0.1–0.5) into the rgba it
returns, while `--shadow-opacity` separately carries
`colorGeneration.shadowOpacity` (0.05–0.25). Any fix that combines
`var(--shadow-color)` with `var(--shadow-opacity)` (e.g. via `color-mix`)
multiplies both. There must be exactly one opacity source.

### 5. Page backgrounds: the capability exists, and it is verifiably broken

- The model supports per-personality `pageBackground` (theme-responsive SVG +
  `usePrimaryTint`) with per-personality `pageBackgroundOpacity`; the service
  generates the SVG with theme colors and emits `--page-background-pattern`
  (`theme.service.ts:779–802`).
- **But the encoding is double-escaped**: `encodeURIComponent(svg)` is followed
  by `.replace(/%/g, '%25')` (line 793), which re-encodes every escape the
  encoder just produced (including the `%27`/`%22` inserted two lines earlier).
  The emitted URI begins `%253Csvg…`; a browser decodes once to the literal
  text `%3Csvg…` — invalid SVG, nothing renders. Reproduced in node during
  review.
- Consequently the single personality that defines a pattern (`control-center`,
  `personalities.ts:1148`) has never displayed it, and the two apps that consume
  the variable (`ui-playground`, `forgeofwill`) paint nothing from it. This
  likely explains why adoption stalled at 1 personality / 2 apps. Effective
  background variation today: **zero**.

## Design

### Guiding constraints (from the request and the existing system)

1. Follow the existing personality system: extend `Personality` /
   `colorGeneration` / CSS-variable contracts; do not invent a parallel one.
2. Reuse existing components (theme-ui showcase components, common-ui
   `card`/`button`); any new component lands in the most relevant existing
   library (backdrop → `theme-ui`; no new libraries).
3. Everything stays theme-responsive (derived from primary color + mode) and
   WCAG-safe (patterns capped by `pageBackgroundOpacity`, validated by the
   existing contrast harness — which is only possible once finding 5 is fixed).

### Workstream A — Remove the dead estate; seed `theme-styles` with what will actually be used

**A1. Delete all 18 pairs and their dead imports in one PR.** Remove every
`libs/*/src/lib/styles/personality-{tokens,effects}.scss`, the 9 inert
`@use` lines, and the two Playwright `console.log` reads of
`--personality-border-radius-style`. Lib-specific mixins buried in the drifted
copies (`forum-card`, `post-card`, `checkbox-custom`, …) are equally dead —
delete them too; git history preserves anything worth resurrecting. No shims,
no two-phase sweep: with zero mixin consumers there is nothing to migrate.
Regression surface is limited to the 9 components losing dead `:root` blocks —
one manual Storybook review pass covers it (note: the repo has no visual
regression tooling — only the Storybook interaction test-runner — so the check
is explicitly manual, or a screenshot job is added first).

**A2. Establish the shared import mechanism (first time, minimal form).**
Recommended: `nx.json` `targetDefaults` setting
`stylePreprocessorOptions.includePaths: ["libs/theme-styles/src/lib"]` for both
builder executors in use (`@angular/build:application` and
`@angular-devkit/build-angular:application` — `nx.json` already carries a
targetDefaults entry for the latter to extend). Component SCSS compiles inside
app builds and Storybook builds (which delegate to app browserTargets), so one
workspace-level setting covers everything; no per-app `package.json`, exports
maps, or path mappings needed. The bare-specifier alternative
(`workspace:*` dependency + `sass` export condition) works but is strictly more
moving parts for the same result.

**A3. Populate `libs/theme-styles/src/lib/personality/` curated, not wholesale.**
Add partials containing **only** what Workstreams B/C actually consume as they
land: the `--shadow-*`/`--shadow-color` variable-contract mixins (B3), the
pattern/noise mixins the backdrop needs (C2/C3), and the personality hover/focus
mixins _when a component adopts them_. Most of the old effects file was never
exercised; canonizing untested CSS wholesale would recreate the aspiration
problem. Fix `theme-styles`' `index.ts` usage docs and `sideEffects` flag while
in there (D5).

**A4. Drift guard.** Trivial CI check (script in `tools/`): the deleted paths
must not reappear.

### Workstream B — Make shadows genuinely vary per personality

**B1. Reconnect the tint (bug fix, with plumbing).**
`generatePersonalityShadows()` currently has no access to `mode` or the computed
`shadowColor` (it's called from `generatePersonalityTokens(personality)`,
line 828, outside the flow where `shadowColor` exists at line 541). Fix:

- Pass `shadowColor`/`mode` through `generatePersonalityTokens` →
  `generatePersonalityShadows`; build the emitted `--shadow-*` values from the
  tinted color, resolved at generation time (not `var()`-composed — see next
  point).
- Resolve the double-booked opacity (finding 4): change `generateShadowColor()`
  to return the tint _without_ baked alpha (or as `{rgb, alpha}`), and apply
  exactly one opacity — `colorGeneration.shadowOpacity`, mode-scaled. Keep the
  mode-awareness: dark-mode shadows should differ from light-mode.

`warm/cool/primary-tint` personalities immediately gain distinct shadow
character with zero data changes.

**B2. Extend the shadow vocabulary with an explicit profile, derived not
hand-authored.** Add a `shadowProfile` field (to `PersonalityTokenOverrides`, or
widen `PersonalityShadowStyle`) rather than overloading
`presentation.shadow.style` — the existing 6-value type cannot express the
profile split below (e.g. `dramatic` is shared by bold, playful, _and_
architect, which land in different profiles). Teach
`generatePersonalityShadows()` shape profiles, not just intensity scaling:

| Profile                     | Shape                              | Personalities (proposed)    |
| --------------------------- | ---------------------------------- | --------------------------- |
| `layered` (current default) | soft stacked blur                  | classic, professional, soft |
| `diffuse`                   | large blur, low opacity, warm tint | soft-touch, elegant         |
| `hard-offset`               | 0-blur brutalist offset            | architect                   |
| `neon`                      | primary-tinted outer glow          | electric                    |
| `technical`                 | tight 1px + inset hairline         | control-center, foundation  |
| `minimal`                   | hairline border-shadow or none     | minimal                     |
| `playful-drop`              | high-offset saturated drop         | bold, playful               |

Critically, **derive `presentation.shadow.value` from the same generator**
(following the `withDerivedFontFamilies()` precedent in `personalities.ts`)
instead of keeping hand-authored literals — this keeps
`--personality-box-shadow` (17 consumers, incl. common-ui buttons) coherent
with `--shadow-*` (~120 consumers) and avoids recreating the dual-source bug.
It also fixes for free the absurdity that the declared-`neon` personalities
currently author plain-black shadow values. Profile assignments must stay
consistent with existing `presentation.shadow.style` declarations
(playful/electric = neon, soft-touch = glow) and raise unique shadow treatments
from 4 to ~7 of 12.

**Note on 07-14 interlock:** the 07-14 plan's B2 ("spread structural tokens,
raise shadow uniqueness") and this workstream are the _same design exercise_ —
execute them as one change and cross-reference both docs, so the two plans
don't double-assign shadow data.

**B3. SCSS stays a thin contract.** The new shared partial documents and wraps
the `--shadow-sm/md/lg/xl` + `--shadow-color` variable contract only. The old
`$shadow-values` map and `shadow-personalized` mixin are not carried forward
(they had zero consumers; nothing breaks).

### Workstream C — Vary page backgrounds across all personalities

**C0. Fix the data-URI encoding (prerequisite bug fix).**
`encodeURIComponent` already escapes everything needed except `'`; replace the
five-way manual `.replace()` chain (`theme.service.ts:790–797`) with
`encodeURIComponent(svg).replace(/'/g, '%27')`. Add a spec asserting the
emitted URI round-trips `decodeURIComponent` to parseable SVG. Ship in Phase 2
alongside B1 — same class of one-function instant win, and C1's design pass is
unreviewable until patterns actually render.

**C1. Author `pageBackground` for the remaining 11 personalities** in
`personalities.ts`, each derived from the personality's stated character, using
the existing theme-responsive `generatePageBackgroundPattern` path:

| Personality    | Pattern direction                                       | Opacity |
| -------------- | ------------------------------------------------------- | ------- |
| classic        | none (flat is its identity) — documented as intentional | —       |
| minimal        | ultra-sparse dot lattice                                | 0.02    |
| bold           | wide diagonal bands, primary tint                       | 0.08    |
| soft           | large soft blobs / waves                                | 0.03    |
| professional   | fine pinstripe                                          | 0.03    |
| playful        | scattered circles/confetti                              | 0.06    |
| elegant        | thin flourish lines                                     | 0.05    |
| architect      | blueprint grid + crosshairs, no tint                    | 0.05    |
| soft-touch     | paper-grain noise, warm                                 | 0.04    |
| electric       | angular circuit traces, primary tint                    | 0.06    |
| control-center | (existing grid — keep, now visible post-C0)             | 0.05    |
| foundation     | none (0 opacity is intentional — keep)                  | 0       |

Design-led pass; the table is a starting proposal. One enforced opacity bound:
authored patterns ≤ **0.08** (test-enforced in D2; the interface's documented
0–0.2 range stays as the hard type-level cap). Every pattern must clear the
contrast harness at its stated opacity in both modes.

**C2. Ship one reusable delivery mechanism instead of 60 app-shell edits.**
Add a standalone `PersonalityBackdropComponent` in **theme-ui** with
encapsulated stylesheet CSS. A component (not a directive extension) is the
right shape for two reviewed reasons: `theme-host-bindings.directive.ts` only
mirrors theme colors into `--local-*` inline styles and paints nothing — this
is new behavior either way; and inline styles cannot carry
`@media (prefers-contrast: more)` / `forced-colors: active` /
`prefers-reduced-motion` guards, which are stylesheet concerns and mandatory
here (patterns disable under contrast/forced-colors preferences). The component
applies `background-image: var(--page-background-pattern, none)` plus
attachment/size rules. Apps opt in by adding it to their shell — start with the
two apps already binding the variable (`ui-playground`, `forgeofwill`) as
reference implementations, then the product apps in
`docs/app-personality-map.md`. The plain `styles.scss` recipe (as in
`apps/forgeofwill/src/styles.scss:65`) remains a documented alternative for
apps that don't want the component.

**SSR note:** six apps have server configs; `applyPersonalityTheme` is
browser-only, so first paint is patternless. Accepted for this plan — the
backdrop specifies a short `background-image` fade-in so the pattern's arrival
reads as intentional rather than a flash. Emitting theme variables during SSR
is explicitly out of scope (future work).

**C3. Surface texture (stretch).** Optional `--surface-texture` variable for
card-level texture (paper grain for soft-touch, scanlines for control-center),
consumed by common-ui `card` via a shared partial. Only after C1/C2 prove out;
same opacity/contrast guards.
_Status: implemented (2026-07-18)._ `Personality.surfaceTexture?` (pattern,
usePrimaryTint, opacity) ships for a small curated set of four —
`soft-touch` (paper-grain speckle), `control-center` (1px scanlines, ~4px
pitch), `architect` (sparse blueprint cross-hatch), `electric` (angular
circuit-trace corner, primary-tinted) — every other personality
intentionally declares none; absence is the default, not a gap. Authored
opacity is capped at **0.05** (tighter than `pageBackground`'s 0.08, since
this paints under running text), enforced in
`personality-surface-textures.spec.ts` alongside an exact-set check so an
accidental addition/removal is a deliberate, reviewed change. `ThemeService`
emits `--surface-texture` through the SAME `generatePageBackgroundPattern` +
single-`encodeURIComponent` path as `--page-background-pattern`, and both
variables are now explicitly cleared when the incoming personality declares
none — fixing a stale-variable leak in `applyPersonalityTheme()` that
affected `--page-background-pattern` too (it only ever `setProperty`s the
current personality's variables and never diffs against the previous one).
`libs/theme-styles/src/lib/personality/_surfaces.scss` wraps the contract
(`surface-texture()` mixin, with `prefers-contrast: more` /
`forced-colors: active` guards), consumed by common-ui `card`.

### Workstream E — Vary surface treatment per personality (related objective, added 2026-07-18)

Surfaces are the highest-leverage token not yet varying: `var(--surface` appears
in ~198 files, yet the only per-personality surface parameter is
`colorGeneration.surfaceLuminosityOffset` — and it clusters hard (7 of 12
personalities use −2; full range is only −1 to −4). Every personality's cards,
panels, and inputs sit on a near-identical neutral lift off the background.
There is also an existing per-personality `gradients.surface` (emitted via the
GradientFactory) that most surfaces never use.

**E1. Extend `ColorGenerationConfig` with surface character.** Add
`surfaceSaturationShift` (neutral ↔ tinted surfaces) and `surfaceHueBias`
(`none | primary | warm | cool` — mirroring the existing `shadowTint`
vocabulary) so `generateThemeResponsiveColors()` can derive surfaces with
per-personality character: e.g. architect gets flat untinted paper, soft-touch
a warm-biased surface, electric a faint primary-tinted lift, control-center a
cooler technical panel. Spread `surfaceLuminosityOffset` deliberately (target
≥ 6 unique values across 12) — elevation contrast is itself a personality
trait (dramatic personalities lift more; minimal barely at all).

**E2. Keep the derivation chain intact.** Surfaces stay derived from primary
color + mode inside `generateThemeResponsiveColors()` (`color-harmony.ts:453`)
— no hand-authored surface hexes. `--surface`, `--background-elevated`, and the
existing `gradients.surface` must all derive from the same computed surface so
the three never disagree (same single-source rule as B2's shadows).

**E3. Contrast is the hard constraint.** `--surface` is a text background in
most of its ~198 consumer files: every personality × mode must keep
foreground-on-surface and muted-on-surface ratios passing the existing
contrast harness (`validateThemeContrast`), auto-clamping tint/saturation
before failing. Test-enforced alongside D-series specs; surface dimensions
join the distinctiveness metric with D3's re-seeding.

Relationship to C3: E varies the surface _color values_; C3 (stretch) layers
optional _texture_ on top. E is independent of C and can land with Phase 3's
design pass or as its own pass.

### Workstream D — Tests, stories, docs

- **D1.** `theme.service.spec.ts`: assert `--shadow-md` contains the tinted
  color for a `warm`-tint personality (locks B1); assert light and dark modes
  emit _different_ `--shadow-md`; assert `--personality-box-shadow` agrees with
  the generated profile (locks B2's single-source rule); assert distinct values
  per shape profile.
- **D2.** `personalities.spec.ts`: assert every personality either defines
  `pageBackground` or is on the documented flat-list (`classic`, `foundation`);
  assert declared patterns are valid SVG, and authored opacity ≤ 0.08. Plus the
  C0 round-trip encoding spec.
- **D3.** Extend `personality-distinctiveness.ts` weighting to include shadow
  profile and background pattern as dimensions. **Re-seed the JND threshold in
  the same PR** — re-weighting shifts pairwise scores and can flip the
  `soft`/`soft-touch` threshold seeded by the 07-14 plan's C1.
- **D4.** theme-ui Storybook: add shadow-profile and background-pattern rows to
  the existing `personality-showcase`/`personality-grid` stories (12-across,
  both modes) — reuse the existing components.
- **D5.** Update `docs/design-system/personalities.md` (regenerate matrix per
  the 07-14 plan's D1), rewrite `libs/theme-styles/src/index.ts` usage docs and
  README to match the _actual_ import mechanism from A2, and fix its
  `"sideEffects": false` (contradicted by side-effect style imports).

## Sequencing & effort

| Phase | Items                          | Rationale                                                                          | Rough effort |
| ----- | ------------------------------ | ---------------------------------------------------------------------------------- | ------------ |
| 1     | A1, A4                         | Delete dead estate; nothing later depends on it existing                           | ~0.5 day     |
| 2     | B1, C0, D1(part), D2(encoding) | Two one-function bug fixes + locking tests; immediate visible wins                 | ~1 day       |
| 3     | B2, B3, D1, D3                 | Shadow vocabulary (design-led; joint with 07-14 B2)                                | ~1.5–2 days  |
| 4     | A2, A3                         | Import mechanism + curated partials, landed with their first real consumer (B3/C2) | ~0.5 day     |
| 5     | C1, C2, D2                     | Background authoring (design-led) + backdrop component                             | ~2 days      |
| 5b    | E1–E3                          | Surface variation (design-led; contrast-gated; parallel to Phase 5)                | ~1–1.5 days  |
| 6     | D4, D5, C3                     | Stories, docs, stretch texture                                                     | ~1 day       |

Phase 1 and 2 are independent and can ship immediately, in either order.
A2/A3 deliberately land _with_ their first consumer rather than speculatively.

## Risks & mitigations

- **Deleting "unused" CSS that something implicitly needed** — mitigated by two
  independent verification passes (zero `@include` consumers repo-wide; the 9
  importing components' includes all resolve to other local partials) and a
  manual Storybook review of those 9 components. No visual-regression tooling
  exists in the repo; if that's unacceptable, add a screenshot job before
  Phase 1.
- **Two shadow contracts drifting apart** — eliminated structurally by deriving
  `presentation.shadow.value` from the generator (B2) and test-locking
  agreement (D1).
- **Pattern noise harming readability/accessibility** — authored opacity ≤ 0.08
  (test-enforced), contrast-harness validation in both modes, and stylesheet
  guards disabling patterns under `prefers-contrast: more` and
  `forced-colors: active`.
- **SSR flash** — accepted and softened via fade-in (see C2); SSR variable
  emission is documented future work, not silently ignored.
- **07-14 plan interlock** — B2 executed jointly with that plan's B2; D3
  re-seeds the distinctiveness threshold in the same PR that re-weights it.
- **Branch conflicts** — the in-flight `docs-coverage-features` work touches
  only backend code (finance, gateway MCP/controllers); no overlap.

## Success criteria

- Zero copies of `personality-{tokens,effects}.scss` under `libs/*/src/lib/styles/`;
  CI guards against reappearance.
- `--shadow-*` values reflect each personality's `shadowTint` and differ between
  light and dark modes; `--personality-box-shadow` provably agrees (test-enforced).
- ≥ 6 distinct shadow treatments across the 12 personalities, including working
  `neon`/`glow` (distinctiveness metric includes shadows).
- `--page-background-pattern` decodes to valid SVG (test-enforced) and 10 of 12
  personalities render a distinct, theme-responsive page background; the 2 flat
  ones are documented as intentional.
- Surfaces vary by personality: ≥ 6 unique `surfaceLuminosityOffset` values and
  per-personality hue/saturation character, with every foreground-on-surface
  pair passing the contrast harness in both modes (test-enforced).
- No new libraries; the one new component (`PersonalityBackdropComponent`) lives
  in theme-ui; shared SCSS lives in theme-styles behind a working, documented
  import mechanism.

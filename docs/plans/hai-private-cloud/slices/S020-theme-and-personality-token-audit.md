# S020 — Theme and Personality Token Audit

## Status

Complete

## Objective

Make every HAI style read from the theme and personality system, so that
changing the personality, mode, or palette visibly changes every page, and
no page relies on hard-coded CSS values the system already provides.

## Why this slice exists

Requested by the owner on 2026-10-07 after reviewing screenshots. Colour
literals were removed by D008, but radii, borders, shadows, spacing, type
sizes, and transition timings are still often hard-coded, so pages look
largely the same under every personality. D012 requires pages to look right
under any personality a visitor picks, not just the default.

## Dependencies

S017. Originally after S019; the owner moved it ahead on 2026-10-07. It
still runs before S018 so the release PR includes it.

## In scope

- Inventory every literal in `apps/hai/src/**/*.scss`, component inline
  styles, and the shared `styles/_section.scss` partial: lengths, radii,
  border widths and styles, shadows, font families, font sizes and weights,
  line heights, letter spacing, durations and easings, z-indexes, opacity.
- Map each to the theme or personality token that should drive it
  (`--personality-*`, `--hai-*`, `--shadow-*`, `--spacing-*`, `--type-*`,
  `--font-*`, `--animation-duration-*`, `--animation-easing`, and so on),
  and replace it, keeping a literal only as the fallback in
  `var(--token, fallback)` (see the `styles-favor-personality-tokens`
  convention).
- Fix the common-ui badge "soft" emphasis, which puts `--primary-text` on
  an accent tint and falls below AA on tinted surfaces (found in S016).
- Fix the title bar's translucency in dark mode: page headings show
  through it while scrolling (found in S017). Its background should come
  from surface tokens with enough opacity to keep its own text readable.
- Record deliberate exceptions (for example layout breakpoints, grid
  fractions, and 1px hairlines) with a reason.
- Add an automated guard that fails on new literals outside the allowed
  list, similar to the existing honest-pricing test.
- Render every route under at least three contrasting personalities in light
  and dark mode and confirm each page visibly follows the personality
  (shape, density, type, shadow, motion), with screenshots compared side by
  side.

## Out of scope

- Changing the default personality (D012) or any personality definition in
  `libs/theme-models`.
- New page content.

## Required References

- ../09-DECISION-LOG.md (D008, D012)
- ../10-DESIGN-SYSTEM-INVENTORY.md
- `libs/theme-lib`, `libs/theme-styles/README.md`

## Implementation Requirements

- Fix values at the token level; do not add personality-specific selectors
  (`body.personality-<id>`), per the theme-styles rules.
- Keep the default (`foundation`) rendering acceptable; diff it before and
  after.
- Measure rendered contrast for text after changes, not variables.

## Acceptance Criteria

- [x] No unexplained literal remains in HAI styles
- [x] The guard fails on a newly introduced literal
- [x] Every route visibly follows at least three personalities in both modes
- [x] WCAG AA text contrast holds under each personality tested
- [x] No overflow at target breakpoints under each personality tested

## Validation

- Build/test/lint, the literal guard, and the multi-personality render
  comparison.

## Expected Files / Areas

- `apps/hai/src/app/styles/_section.scss` and component stylesheets
- a style-literal guard test
- personality comparison screenshots in the completion notes

## Completion Notes

### What was wrong

Pages looked the same under every personality for three reasons.

1. **Hard-coded values.** Most sizes, spacing, weights, radii, shadows and
   timings were literals:
   - the new guard counted 522 literal declarations;
   - the repo's `tools/personality-audit.mjs` ratchet counted 145.
2. **An opaque page background.** HAI painted its own background (an opaque
   `.page::before` layer and a background on the app host). That covered
   `lib-personality-backdrop`, so no personality's pattern or atmosphere
   ever showed.
3. **Invalid transitions.** `--hai-transition` was built from
   `--personality-transition`, giving invalid declarations such as
   `transform all 0.3s …`, so those transitions were silently dropped.

### Token layer

**`app/styles/_section.scss`** holds the helpers:

- `space(n)`: n steps of `--spacing-md`, the personality's density;
- `text-size(step)`: the personality's type scale, plus `sm` and `lede`
  steps derived from it;
- `display()`: fluid sizes scaled by `--type-ratio`, with the mobile floor
  shared by every personality;
- `leading()`: from `--line-height` and `--heading-line-height`;
- `timing()`: from `--animation-duration-*` and `--animation-easing`.

It also holds the mixins:

- `heading-style`: the personality's heading family, weight, tracking, case
  and leading;
- `eyebrow` and `label`: the personality's label font, case and tracking;
- `copy-font` and `body-copy`;
- `primary-action` and `secondary-action`: the personality's button fill,
  weight, case and control height;
- `hover-lift` and `lift`: the personality's hover and press transforms;
- `fade`, `panel`, `card`, `visually-hidden`.

**`app.component.scss`** holds HAI's `--hai-*` tokens on `:host`, so the
header, page and contact strip all share them. Each derives from theme and
personality tokens:

- radii: panel, card, chip, pill;
- borders: width, style, strong, accent;
- shadows: panel, card, raised, hover;
- `--hai-weight-strong`: `max(600, --personality-font-weight)`;
- reading measures;
- six named display sizes.

`.page` now takes its width from `--layout-max-width`.

### Conversion

- 30 HAI stylesheets were converted. A codemod handled the mechanical
  categories; headings, shadows, shorthands and decorative values were done
  by hand. The three inline `styles:` blocks moved into `.scss` files.
- Duplicated button, hover, eyebrow and visually-hidden rules were replaced
  by the shared mixins.
- Hard-coded `text-transform: uppercase` on labels now reads the
  personality's label case.
- Result: guard 522 → 0; ratchet 145 → 0, re-baselined to lock it in
  (`tools/personality-audit.baseline.json`, HAI entries only).

### 31 stated exceptions

Each has a `// token-exempt:` comment with its reason:

- 8 row-alignment layout heights;
- 4 decorative illustration sizes and 1 offset, capped by the viewport;
- 3 visually-hidden pattern values;
- 2 local stacking orders;
- 4 faint decorative layers (opacity);
- 2 diagram connector offsets;
- 1 logo display size (the asset is exported at 2×);
- 1 honeypot offset;
- 1 action-button minimum width;
- 1 hero layout height;
- 2 emphasis weights.

Allowed by the guard without a comment: `em`/`ch`/`vw`/`fr` units, 1px
hairlines, `font-weight: 400`, z-index -2 to 2, and token definitions in the
token layer.

### Guard

`apps/hai/src/app/style-literals.ts` and `style-tokens.spec.ts` fail on:

- a literal size, spacing, radius, shadow, timing, weight, leading, tracking,
  border, z-index or opacity outside `var()` or the helpers;
- inline component styles.

Proved twice: the spec feeds known literals, and adding
`padding: 1.3rem` plus a literal `box-shadow` to `cta-panel.component.scss`
made it fail with both listed. It passed again once the file was restored.

### Other fixes

- **Header (title bar):**
  - see-through in dark mode: now 95% opaque surface with the personality's
    `--surface-backdrop-filter`;
  - the 8–186px desktop overflow from 1,025 to 1,365px (found here): the
    brand title wraps to two lines and the full navigation starts at
    1,200px;
  - the menu button is touch-target sized;
  - the header CTA uses `primary-action`.
- **Native controls:** `color-scheme` follows dark mode
  (`html[data-theme='dark']`).
- **Literal colour:** the remaining `white` in the body background was
  removed.
- **common-ui, soft emphasis** (`interfaces/_variant.scss`, all primitives):
  - the problem: tone text on its own 18% tint measured 4.64–4.95:1 on a
    tinted panel (default, yellow, orange, pink and blue primaries; light and
    dark);
  - the fix: the text now mixes 70% tone with 30% foreground;
  - the result: at least 5.35:1 everywhere, with the hue kept.
- **common-ui, soft cards** (`card.component.scss`): the tint is laid over
  the elevated surface, so page patterns and scenes no longer reach card
  text. Measured 3.35:1 over the risograph dot pattern before; passes now.
- **Narrow screens:**
  - single-column grids use `minmax(0, 1fr)`;
  - headings break only when a word cannot fit;
  - the hero heading sizes to its own column (`12.5cqi`);
  - badges wrap;
  - the appliance grid's `minmax(320px, …)`, which overflowed at 320px, is
    now `minmax(min(100%, 20rem), …)`.

### Validation

All personality checks set the personality the way a visitor's saved choice
does, through `localStorage`.

- **Personalities:** every route rendered under `foundation`, `bold`,
  `elegant` and `risograph`, in light and dark, at 1280 and 390px. Each
  visibly follows its personality: type family, weight, case and scale;
  density; radius; shadow; header treatment; button fill; and the page
  pattern and scene behind content. Comparisons are in `../assets/s020/`:
  - `home-desktop-light.jpg`, `home-desktop-dark.jpg`;
  - `private-cloud-mobile.jpg`, `software-stacks-desktop.jpg`;
  - `foundation-before-after.jpg` (default personality, before and after).
- **Contrast:** measured on rendered pixels with the S016 method: all text
  elements, the real background, the 10th-percentile background, a 2px
  inset. 3,718 elements per personality, 13 routes at 375 and 1440px, light
  and dark. **0 failures** under all four personalities.
- **Overflow:** horizontal scroll, content past the viewport, or text cut off
  by a clipping ancestor. 13 routes × 7 widths (320, 375, 768, 1024, 1100,
  1280, 1440) × 4 personalities. **0 of 364** checks failed.
- **Default rendering (`foundation`):** diffed before and after. It is
  slightly denser, headings use the personality's 500 weight, shadows are
  flatter, and the hero heading is a little smaller. Acceptable, and what
  the personality defines.
- **Build and tests:**
  - `nx test hai` (38 suites, 223 tests) and `nx test common-ui` (241 tests)
    pass;
  - `nx lint hai` is clean; `nx lint common-ui` has 3 earlier warnings in
    table files;
  - `nx build hai` passes with 0 Sass deprecation warnings;
  - `check:personality-audit` and `check:no-personality-scss` pass.

## Deviations / Blockers

- **Style budget.** `solutions-matrix.component.scss` (10.8 kB) and
  `landing.component.scss` (8.25 kB) now exceed the 8 kB component-style
  warning budget, though not the 16 kB error limit. The growth comes from
  `var()` fallbacks. They stay, because theme variables are set only in the
  browser and the server-rendered first paint needs the fallbacks. Raising
  the warning budget or splitting the matrix stylesheet is the owner's
  call.
- **Changes outside HAI.** The two common-ui changes (soft text mix, soft
  card base) change soft badges, chips, buttons and cards in every app. They
  are small, and each one raises contrast.
- **Ratchet reporting.** The ratchet still reports HAI as "reads personality
  42%", because its detector does not recognise the `section.*` helpers; its
  literal count for HAI is 0.
- **Safari/WebKit** is still untested (see S017).

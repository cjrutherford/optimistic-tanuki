---
title: Personality Catalog
summary: Catalog of all 12 predefined personalities, their distinctiveness matrix, and the canonical product mapping.
category: design-system
section: design-system
tags:
  - design-system
  - personality
  - theme
  - branding
date: 2026-05-29
---

# Personality Catalog

Every product in the Optimistic Tanuki portfolio renders through the **theme system**: a shared infrastructure that turns a single primary color and a chosen personality into a fully derived design language — typography, spacing, shadows, borders, animation, color harmonies, mobile adaptations, and component presentation contracts.

The catalog below is the human-readable companion to two source-of-truth files:

- [`libs/theme-models/src/lib/personalities.ts`](../../libs/theme-models/src/lib/personalities.ts) — the `Personality` registry.
- [`libs/theme-models/src/lib/product-personalities.ts`](../../libs/theme-models/src/lib/product-personalities.ts) — the canonical product → personality mapping.

## Why Personalities Matter

A personality is **not** a color palette. It is a complete aesthetic configuration that touches:

1. **Color harmony** — how secondary, accent, muted and inverse colors are derived from the primary.
2. **Contrast** — minimum/enhanced ratios, autoAdjust, background offset.
3. **Tokens** — spacing scale, border radius style, shadow intensity, typography style.
4. **Fonts** — body/heading/mono families, weights, preload hints.
5. **Animation** — speed, easing curve, duration ladder, stagger delay.
6. **Color generation** — luminosity, saturation, dark-mode scaling, shadow tint.
7. **Mobile adaptations** — spacing/font/shadow multipliers, touch target sizes.
8. **Presentation contracts** — concrete component presets for buttons, cards, inputs.

Two products with the same primary color can feel completely different because their personality reshapes every derived token.

## Product → Personality Mapping

| Product               | Project (Nx)          | Default personality | Identity in one line                        |
| --------------------- | --------------------- | ------------------- | ------------------------------------------- |
| **Optimistic Tanuki** | `client-interface`    | `classic`           | Trustworthy, balanced, versatile baseline.  |
| **Towne Square**      | `local-hub`           | `soft-touch`        | Organic, warm, gentle neighborhood feel.    |
| **Forge of Will**     | `forgeofwill`         | `bold`              | High-energy, action-focused delivery.       |
| **Fin Commander**     | `fin-commander`       | `professional`      | Conservative, data-driven clarity.          |
| **Signal Foundry**    | `marketing-generator` | `electric`          | Vibrant, kinetic creative output.           |
| **Developer Portal**  | `developer-portal`    | `architect`         | Brutalist, technical, structural precision. |

Users can switch personalities at runtime through the theme service. The mapping above defines the **canonical default** each product ships with.

## Distinctiveness Matrix

Distinctiveness here is a measured claim, not a stylistic one. The catalog used to
justify itself with "each personality differs from the others in at least four
dimensions" — a claim that is technically true of almost any two personalities
and, in practice, perceptually meaningless. It's exactly the reasoning that let
`soft` and `soft-touch` ship as near-duplicates (perceptual distance 0.1888,
both pastel/rounded/Quicksand-headed/Nunito-bodied with matching radius,
shadow and animation) until that was caught and fixed.

The real, enforced claim is:

- Every pair of personalities clears a **JND-aware perceptual distance
  threshold** (`DISTINCTIVENESS_THRESHOLD`, currently **0.36** — no pair
  falls below it) computed by
  [`personalityDistance()`](../../libs/theme-models/src/lib/personality-distinctiveness.ts).
  Categorical fields (color-harmony type, border-radius style, shadow
  intensity, **shadow profile**, **page-background pattern**, **surface hue
  bias**, animation speed, font family, ...) count as a full unit of
  difference when they differ; numeric fields (spacing multiplier, animation
  duration, saturation, **surface luminosity offset**, ...) are normalized
  against their perceptual just-noticeable-difference scale, not their raw
  numeric range — so a 400ms vs. 350ms animation delta barely registers,
  while a 25-point accent saturation shift does.
- The six **product-mapped** personalities (`classic`, `soft-touch`, `bold`,
  `professional`, `electric`, `architect` — see the mapping above) clear a
  meaningfully higher bar, `PRODUCT_DISTINCTIVENESS_THRESHOLD` (currently
  **0.46**, product-set floor above it), since each one is the defining
  visual identity of a whole product.
- Both thresholds were **re-seeded** by the
  `2026-07-18-personality-styles-refactor` plan (up from 0.34/0.44) after
  that plan's Workstreams B2 (shadow profile), C1 (page background), and
  E1 (surface character) added four new dimensions to the metric — each
  re-weighting shifts every pairwise score, so the thresholds are re-tuned
  in the same change that re-weights, per that plan's D3. The **"differs in
  ≥ 4 dimensions"** framing this catalog used before the 07-14 plan is
  retired for good — the enforced claim is strictly the perceptual-distance
  threshold above, not a raw dimension count.
- Both thresholds are **enforced by a build-failing test**,
  [`personality-distinctiveness.spec.ts`](../../libs/theme-models/src/lib/personality-distinctiveness.spec.ts):
  if a future change ever drifts two personalities back into near-duplicate
  territory, CI fails before it ships — distinctiveness isn't something a
  reviewer has to notice by eye in a hand-maintained table.

The matrix below is **generated from that same metric and registry**, not
hand-maintained, so it can never silently drift from what the test enforces.

<!-- BEGIN GENERATED: personality-distinctiveness-matrix -->
<!-- Generated by `scripts/generate-personality-matrix.mjs` on 2026-07-18. -->
<!-- Do not edit this section by hand — run `node scripts/generate-personality-matrix.mjs --write` to regenerate it. -->

#### Summary

- **Personalities compared:** 12 (all of `PREDEFINED_PERSONALITIES`)
- **Mean pairwise distance:** 0.7029
- **Global closest pair:** `classic` vs `foundation` — 0.3672
- **Product-set closest pair** (architect, bold, classic, electric, professional, soft-touch): `bold` vs `electric` — 0.4662
- **`DISTINCTIVENESS_THRESHOLD`:** 0.36 (global closest pair clears it: yes)
- **`PRODUCT_DISTINCTIVENESS_THRESHOLD`:** 0.46 (product-set floor clears it: yes)

#### Pairwise perceptual distance (lower triangle; 0 = identical, 1 = maximally different)

| Personality      | `classic` | `minimal` | `bold` | `soft` | `professional` | `playful` | `elegant` | `architect` | `soft-touch` | `electric` | `control-center` | `foundation` |
| ---------------- | --------- | --------- | ------ | ------ | -------------- | --------- | --------- | ----------- | ------------ | ---------- | ---------------- | ------------ |
| `classic`        | —         |           |        |        |                |           |           |             |              |            |                  |              |
| `minimal`        | 0.692     | —         |        |        |                |           |           |             |              |            |                  |              |
| `bold`           | 0.567     | 0.867     | —      |        |                |           |           |             |              |            |                  |              |
| `soft`           | 0.747     | 0.649     | 0.890  | —      |                |           |           |             |              |            |                  |              |
| `professional`   | 0.469     | 0.615     | 0.766  | 0.714  | —              |           |           |             |              |            |                  |              |
| `playful`        | 0.719     | 0.783     | 0.574  | 0.793  | 0.820          | —         |           |             |              |            |                  |              |
| `elegant`        | 0.642     | 0.750     | 0.749  | 0.749  | 0.718          | 0.812     | —         |             |              |            |                  |              |
| `architect`      | 0.707     | 0.791     | 0.654  | 0.946  | 0.552          | 0.725     | 0.719     | —           |              |            |                  |              |
| `soft-touch`     | 0.669     | 0.621     | 0.736  | 0.571  | 0.669          | 0.747     | 0.706     | 0.821       | —            |            |                  |              |
| `electric`       | 0.633     | 0.844     | 0.466  | 0.880  | 0.770          | 0.465     | 0.732     | 0.659       | 0.799        | —          |                  |              |
| `control-center` | 0.657     | 0.612     | 0.843  | 0.701  | 0.535          | 0.839     | 0.696     | 0.633       | 0.624        | 0.817      | —                |              |
| `foundation`     | 0.367     | 0.540     | 0.757  | 0.795  | 0.528          | 0.832     | 0.721     | 0.725       | 0.789        | 0.820      | 0.587            | —            |

#### Dimensions compared

| Group                   | Field                                          | Weight |
| ----------------------- | ---------------------------------------------- | ------ |
| Color                   | `colorHarmony.type`                            | 0.080  |
| Typography              | `fonts.heading`                                | 0.070  |
| Typography              | `fonts.body`                                   | 0.070  |
| Typography              | `tokens.typography`                            | 0.060  |
| Color                   | `colorHarmony.accentSaturation`                | 0.050  |
| Structure / tokens      | `tokens.borderRadius`                          | 0.040  |
| Color                   | `colorHarmony.saturationBoost`                 | 0.040  |
| Color                   | `colorHarmony.lightnessShift`                  | 0.040  |
| Color                   | `colorHarmony.accentLightness`                 | 0.040  |
| Structure / tokens      | `tokens.spacingScale`                          | 0.030  |
| Structure / tokens      | `tokens.borderStyle`                           | 0.030  |
| Structure / tokens      | `tokens.shadowProfile`                         | 0.030  |
| Animation               | `animations.speed`                             | 0.030  |
| Color                   | `colorHarmony.spread`                          | 0.030  |
| Structure / tokens      | `tokens.spacingMultiplier`                     | 0.030  |
| Structure / tokens      | `tokens.borderRadiusMultiplier`                | 0.030  |
| Animation               | `animations.duration.normal`                   | 0.030  |
| Structure / tokens      | `tokens.shadowIntensity`                       | 0.020  |
| Structure / tokens      | `tokens.shadowMultiplier`                      | 0.020  |
| Animation               | `animations.prefersReducedMotion`              | 0.020  |
| Animation               | `animations.easing`                            | 0.020  |
| Presentation            | `presentation.border.radius`                   | 0.020  |
| Presentation            | `presentation.shadow.style`                    | 0.020  |
| Presentation            | `presentation.animation.style`                 | 0.020  |
| Color generation + icon | `colorGeneration.shadowOpacity`                | 0.020  |
| Color generation + icon | `pageBackground.pattern`                       | 0.020  |
| Typography              | `tokens.lineHeight`                            | 0.020  |
| Typography              | `tokens.letterSpacing`                         | 0.020  |
| Structure / tokens      | `tokens.borderWidth`                           | 0.020  |
| Presentation            | `presentation.components.button.textTransform` | 0.020  |
| Color generation + icon | `colorGeneration.shadowTint`                   | 0.020  |
| Color generation + icon | `iconStyle`                                    | 0.020  |
| Surface character       | `colorGeneration.surfaceLuminosityOffset`      | 0.015  |
| Surface character       | `colorGeneration.surfaceHueBias`               | 0.015  |
| Color generation + icon | `colorGeneration.neutralSaturation`            | 0.010  |
| Color generation + icon | `colorGeneration.backgroundLuminosity`         | 0.010  |

Weights sum to 1.08 (normalized by the actual sum, not required to equal exactly 1 — see `personality-distinctiveness.ts`'s module doc comment). Categorical fields (marked with a single distinct/non-distinct outcome — e.g. `tokens.shadowProfile`, `colorGeneration.surfaceHueBias`, `pageBackground.pattern`) count as a full unit of difference when they differ; numeric fields are normalized against a perceptual just-noticeable-difference scale, not their raw numeric range.

<!-- END GENERATED: personality-distinctiveness-matrix -->

> Full configuration for each personality lives in `personalities.ts`. To regenerate the summary and matrix above after changing a personality, run `node scripts/generate-personality-matrix.mjs --write` (or `pnpm run docs:personalities`) — it bundles `personalities.ts` and `personality-distinctiveness.ts` with esbuild and imports the metric directly, so the numbers are never hand-typed. Do not edit the generated section by hand.

## Shadow Profile Vocabulary

Every personality declares `tokens.shadowProfile`, an explicit shape
discriminator (added by Workstream B2 of the
`2026-07-18-personality-styles-refactor` plan) on top of
`colorGeneration.shadowTint`'s color and `tokens.shadowMultiplier`'s scale.
`generatePersonalityShadows()` (`libs/theme-lib/src/lib/theme-lib/theme.service.ts`)
turns the profile into a genuinely different silhouette, not just a
differently-scaled version of the same soft stacked blur — and the SAME
generator output also derives `--personality-box-shadow` /
`--personality-card-shadow`, so the two shadow contracts (~120 `--shadow-*`
consumers vs. 17 `--personality-*-shadow` consumers) can never drift apart
the way fonts once did.

| Profile        | Shape                                                                            | Personalities                     |
| -------------- | -------------------------------------------------------------------------------- | --------------------------------- |
| `layered`      | Soft stacked blur (the original default)                                         | `classic`, `soft`, `professional` |
| `diffuse`      | Large blur radius, reduced opacity, no offset — an ambient glow                  | `elegant`, `soft-touch`           |
| `hard-offset`  | 0-blur solid offset that grows with size — brutalist                             | `architect`                       |
| `neon`         | Outer glow built from the **primary** color, not the neutral/tinted shadow color | `electric`                        |
| `technical`    | Tight small offsets plus a crisp 1px ring at low alpha — instrument-panel feel   | `control-center`, `foundation`    |
| `minimal`      | Hairline ring only, collapsing to `none` at zero opacity                         | `minimal`                         |
| `playful-drop` | Pronounced vertical offset with modest blur — a saturated, bouncy drop           | `bold`, `playful`                 |

7 distinct shadow treatments across 12 personalities (up from 4 unique
intensities pre-refactor, all neutrally colored). See the `Theme/Personality
Variation/Shadow Profiles` Storybook stories in `libs/theme-ui` for a
12-across, both-modes visual comparison.

## Page Backgrounds

10 of 12 personalities render a distinct, theme-responsive page background
pattern via `pageBackground` (an SVG motif + `usePrimaryTint`) and
`colorGeneration.pageBackgroundOpacity`; `generatePageBackgroundPattern()`
tints the pattern with theme colors at generation time, and `ThemeService`
emits it as `--page-background-pattern` (a `data:image/svg+xml,...` URI,
consumed by `<lib-personality-backdrop>` or a plain `styles.scss` rule).

| Personality      | Pattern                                                                         | Opacity |
| ---------------- | ------------------------------------------------------------------------------- | ------- |
| `classic`        | **None — flat is its identity.** Documented, intentional.                       | —       |
| `minimal`        | Ultra-sparse dot lattice                                                        | 0.02    |
| `bold`           | Wide diagonal bands, primary-tinted                                             | 0.08    |
| `soft`           | Large soft blob/wave ellipses                                                   | 0.03    |
| `professional`   | Fine pinstripe                                                                  | 0.03    |
| `playful`        | Scattered circles / confetti                                                    | 0.06    |
| `elegant`        | Thin flourish lines                                                             | 0.05    |
| `architect`      | Blueprint grid + crosshair, untinted                                            | 0.05    |
| `soft-touch`     | Paper-grain noise dots                                                          | 0.04    |
| `electric`       | Angular circuit traces, primary-tinted                                          | 0.06    |
| `control-center` | Technical grid + crosshair (the original pattern, now actually visible post-C0) | 0.05    |
| `foundation`     | **None — 0 opacity is intentional.** Documented, kept.                          | 0       |

Every authored pattern is capped at opacity ≤ 0.08 and validated as
parseable SVG (test-enforced,
[`personality-backgrounds.spec.ts`](../../libs/theme-models/src/lib/personality-backgrounds.spec.ts)),
and the emitted `--page-background-pattern` data URI round-trips
`decodeURIComponent` to that same parseable SVG in both light and dark mode
(test-enforced in `theme.service.spec.ts`) — the pre-refactor encoding bug
(`encodeURIComponent` output was re-escaped by a stray `.replace()` chain)
meant **zero** personalities ever rendered a background in practice, even
though `control-center` had authored one since before the refactor. See the
`Theme/Personality Variation/Page Backgrounds` Storybook
stories for a 12-across, both-modes visual comparison, and
`personality-backdrop.component.ts` for the delivery mechanism.

## Surface Character

Before Workstream E (`2026-07-18-personality-styles-refactor` plan), the
only per-personality surface parameter was `colorGeneration.surfaceLuminosityOffset`,
and it clustered hard — 7 of 12 personalities used `-2`, with the full
authored range only spanning `-1` to `-4`. Every personality's cards, panels,
and inputs sat on a near-identical neutral lift off the background.

Two new fields give surfaces genuine per-personality character, mirroring
the vocabulary `shadowTint` already established for shadows:

- **`surfaceHueBias`** (`none` | `primary` | `warm` | `cool`) — `none` keeps
  the surface on the same neutral hue as `background`; `primary` anchors it
  to the primary color at a higher saturation than the neutral background (a
  faint brand-tinted lift); `warm`/`cool` anchor it to the same fixed ~30°/
  ~210° hues `shadowTint`'s `warm`/`cool` use, so a personality reads as
  consistently warm- or cool-leaning across both shadows and surfaces
  regardless of the chosen primary color.
- **`surfaceSaturationShift`** — a saturation delta (0-12 authored range)
  applied off the neutral background before the hue bias above is applied;
  `0` keeps the surface as flat/untinted as the neutral derivation (e.g.
  `architect`'s raw paper), higher values read as a clearly tinted lift
  (e.g. `electric`'s faint primary-tinted surface).

`surfaceLuminosityOffset` itself was also deliberately spread — dramatic
personalities (e.g. `playful` at `-7`) now lift much further off the
background than restrained ones (e.g. `minimal` at `-1`); elevation contrast
is itself a personality trait, not an incidental constant. `--surface`,
`--background-elevated`, and the existing `gradients.surface` all still
derive from the SAME computed surface value, so the three can never
disagree.

**Contrast is the hard constraint**: `generateThemeResponsiveColors()`
auto-clamps `surfaceSaturationShift` downward (in steps, toward the neutral
derivation) if the fully-authored bias would drop foreground-on-surface
below the personality's `contrast.minimumRatio`, or muted-on-surface below
an empirically-set floor — every personality × mode passes both, test-enforced
by the `surface character contrast gate (E3)` suite in
[`theme.service.spec.ts`](../../libs/theme-lib/src/lib/theme-lib/theme.service.spec.ts).
See the
`Theme/Personality Variation/Surfaces` Storybook stories for a 12-across,
both-modes visual comparison of background/surface/elevated tiers.

## Personalities in Detail

### classic

- **Tags:** versatile, balanced, professional, default
- **Category:** professional
- **Used by:** `client-interface` (Optimistic Tanuki)
- **Best for:** Default starting point, generic dashboards, any product without a strong opinion.

### minimal

- **Tags:** clean, spacious, elegant, modern
- **Category:** professional
- **Best for:** Content-heavy reading apps, focus modes, professional tools where chrome should disappear.

### bold

- **Tags:** vibrant, energetic, marketing, creative
- **Category:** creative
- **Used by:** `forgeofwill` (Forge of Will)
- **Best for:** Execution surfaces, marketing pages, calls to action.

### soft

- **Tags:** gentle, airy, calming, wellness
- **Category:** casual
- **Best for:** Wellness, journaling, educational content.

### professional

- **Tags:** enterprise, trustworthy, conservative, b2b
- **Category:** professional
- **Used by:** `fin-commander` (Fin Commander)
- **Best for:** Finance, B2B SaaS, regulated workflows, anywhere readability and restraint outweigh personality.

### playful

- **Tags:** fun, energetic, creative, youth
- **Category:** creative
- **Best for:** Games, creative tools, youth-oriented apps.

### elegant

- **Tags:** luxury, sophisticated, premium, refined
- **Category:** professional
- **Best for:** Portfolios, premium services, editorial sites.

### architect

- **Tags:** brutalist, industrial, structural, bold, technical
- **Category:** technical
- **Used by:** `developer-portal` (Developer Portal)
- **Best for:** Developer tools, technical documentation, architecture-flavored content.

### soft-touch

- **Tags:** warm, tactile, paper, organic, wellness
- **Category:** casual
- **Used by:** `local-hub` (Towne Square)
- **Identity:** a warm, tactile "paper" aesthetic — Fraunces serif headings, Mulish humanist-sans body, pill-shaped edges, and a medium tactile-lift shadow. Deliberately distinct from `soft`'s airy/cool/Quicksand identity (see the Distinctiveness Matrix above).
- **Best for:** Form-heavy UIs, wellness and community apps, anything that should feel inviting, tactile, and unhurried.

### electric

- **Tags:** vibrant, energetic, kinetic, playful, social
- **Category:** creative
- **Used by:** `marketing-generator` (Signal Foundry)
- **Best for:** Social media, community platforms, creative galleries, marketing workbenches.

### control-center

- **Tags:** technical, dashboard, monospace, grid, precision
- **Category:** technical
- **Best for:** Admin panels, monitoring dashboards, configuration UIs.

### foundation

- **Tags:** minimal, functional, clean, utilitarian, base
- **Category:** technical
- **Identity:** the compact/technical/reduced-motion baseline — borderless (`border: none`), no shadow (`shadowIntensity: none`), and instant animation (`speed: instant`, ~0–120ms durations), on top of pure system fonts. This flat look is a deliberate, legitimately separate identity from `classic`, not an underdeveloped one — see the Distinctiveness Matrix note above.
- **Best for:** Prototypes, getting-started kits, utilitarian internal tooling.

## Declaring a Personality in an App

Apps declare their canonical personality in two places that must stay aligned:

1. **`PRODUCT_PERSONALITIES`** entry in `libs/theme-models/src/lib/product-personalities.ts`.
2. **`apps/<project>/src/index.html`** sets `<body data-personality="…">` so the initial CSS render matches the personality even before Angular hydrates.

Switching the canonical personality requires updating both the mapping and the matching app `index.html` body attribute. Marketing docs, design-system docs, and comparison UI use the mapping as the canonical product catalog reference.

## Verification

- **Unit test:** `libs/theme-models/src/lib/product-personalities.spec.ts` asserts that every product maps to a registered personality.
- **Distinctiveness test:** `libs/theme-models/src/lib/personality-distinctiveness.spec.ts` fails the build if any pair drops below `DISTINCTIVENESS_THRESHOLD` or the product set drops below `PRODUCT_DISTINCTIVENESS_THRESHOLD` — the enforcement mechanism behind the Distinctiveness Matrix above.
- **Storybook:** the personality showcase stories in `libs/theme-ui` render the catalog and let a reviewer compare personalities side-by-side.
- **Live comparison:** the `<otui-personality-comparison>` component (see `libs/theme-ui/src/lib/theme-ui/personality-comparison.component.ts`) renders the same UI primitives across multiple personalities and can be embedded in apps or stories.
- **"All 12 at a glance" grid:** the `Theme/Personality Grid (All 12)` Storybook story (`libs/theme-ui/src/lib/theme-ui/personality-grid.stories.ts`, backed by `<lib-personality-grid>`) renders a heading, body copy, button, card, and input for every predefined personality in both light and dark mode simultaneously — the visual counterpart to the numeric matrix, useful for catching near-duplicates or font-fallback that the metric alone wouldn't surface.
- **Token variation stories (Workstream D4):** `Theme/Personality Variation/Shadow Profiles`, `Theme/Personality Variation/Page Backgrounds`, and `Theme/Personality Variation/Surfaces` (all in `libs/theme-ui`, backed by `<lib-personality-token-showcase>`) render the same 12-across, both-modes comparison for the three dimensions this catalog documents above — each cell calls the same pure `generatePersonalityShadows()` / `generatePageBackgroundPattern()` / `generateThemeResponsiveColors()` functions `ThemeService` uses internally, so what's on screen is provably what the app would actually render.

## Accessibility

All personalities inherit:

- A `minimumRatio` of at least **4.5** and an `enhancedRatio` of **7** (WCAG AA / AAA targets).
- `prefersReducedMotion` handling on personalities with stronger motion (`minimal`, `soft`, `professional`, `soft-touch`, `control-center`, `foundation`).
- Touch target sizes ≥ 44 px on mobile breakpoints.

When introducing a new personality, validate it with the existing contrast and theme-validation harnesses in `libs/theme-lib` before adding it to the registry.

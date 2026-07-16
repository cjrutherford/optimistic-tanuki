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
  threshold** (`DISTINCTIVENESS_THRESHOLD`, currently **0.34**) computed by
  [`personalityDistance()`](../../libs/theme-models/src/lib/personality-distinctiveness.ts).
  Categorical fields (color-harmony type, border-radius style, shadow
  intensity, animation speed, font family, ...) count as a full unit of
  difference when they differ; numeric fields (spacing multiplier, animation
  duration, saturation, ...) are normalized against their perceptual
  just-noticeable-difference scale, not their raw numeric range — so a 400ms
  vs. 350ms animation delta barely registers, while a 25-point accent
  saturation shift does.
- The six **product-mapped** personalities (`classic`, `soft-touch`, `bold`,
  `professional`, `electric`, `architect` — see the mapping above) clear a
  meaningfully higher bar, `PRODUCT_DISTINCTIVENESS_THRESHOLD` (currently
  **0.44**), since each one is the defining visual identity of a whole
  product.
- Both thresholds are **enforced by a build-failing test**,
  [`personality-distinctiveness.spec.ts`](../../libs/theme-models/src/lib/personality-distinctiveness.spec.ts):
  if a future change ever drifts two personalities back into near-duplicate
  territory, CI fails before it ships — distinctiveness isn't something a
  reviewer has to notice by eye in a hand-maintained table.

The matrix below is **generated from that same metric and registry**, not
hand-maintained, so it can never silently drift from what the test enforces.

<!-- BEGIN GENERATED: personality-distinctiveness-matrix -->
<!-- Generated by `scripts/generate-personality-matrix.mjs` on 2026-07-15. -->
<!-- Do not edit this section by hand — run `node scripts/generate-personality-matrix.mjs --write` to regenerate it. -->

#### Summary

- **Personalities compared:** 12 (all of `PREDEFINED_PERSONALITIES`)
- **Mean pairwise distance:** 0.6909
- **Global closest pair:** `classic` vs `foundation` — 0.3466
- **Product-set closest pair** (architect, bold, classic, electric, professional, soft-touch): `bold` vs `electric` — 0.4485
- **`DISTINCTIVENESS_THRESHOLD`:** 0.34 (global closest pair clears it: yes)
- **`PRODUCT_DISTINCTIVENESS_THRESHOLD`:** 0.44 (product-set floor clears it: yes)

#### Pairwise perceptual distance (lower triangle; 0 = identical, 1 = maximally different)

| Personality      | `classic` | `minimal` | `bold` | `soft` | `professional` | `playful` | `elegant` | `architect` | `soft-touch` | `electric` | `control-center` | `foundation` |
| ---------------- | --------- | --------- | ------ | ------ | -------------- | --------- | --------- | ----------- | ------------ | ---------- | ---------------- | ------------ |
| `classic`        | —         |           |        |        |                |           |           |             |              |            |                  |              |
| `minimal`        | 0.692     | —         |        |        |                |           |           |             |              |            |                  |              |
| `bold`           | 0.532     | 0.857     | —      |        |                |           |           |             |              |            |                  |              |
| `soft`           | 0.772     | 0.631     | 0.881  | —      |                |           |           |             |              |            |                  |              |
| `professional`   | 0.467     | 0.590     | 0.753  | 0.731  | —              |           |           |             |              |            |                  |              |
| `playful`        | 0.696     | 0.766     | 0.595  | 0.792  | 0.805          | —         |           |             |              |            |                  |              |
| `elegant`        | 0.618     | 0.730     | 0.739  | 0.734  | 0.720          | 0.817     | —         |             |              |            |                  |              |
| `architect`      | 0.699     | 0.789     | 0.641  | 0.942  | 0.521          | 0.728     | 0.706     | —           |              |            |                  |              |
| `soft-touch`     | 0.653     | 0.596     | 0.720  | 0.562  | 0.657          | 0.741     | 0.722     | 0.811       | —            |            |                  |              |
| `electric`       | 0.604     | 0.831     | 0.448  | 0.871  | 0.751          | 0.413     | 0.716     | 0.642       | 0.783        | —          |                  |              |
| `control-center` | 0.634     | 0.581     | 0.841  | 0.683  | 0.522          | 0.826     | 0.702     | 0.614       | 0.604        | 0.807      | —                |              |
| `foundation`     | 0.347     | 0.518     | 0.737  | 0.789  | 0.511          | 0.819     | 0.714     | 0.703       | 0.777        | 0.806      | 0.599            | —            |

<!-- END GENERATED: personality-distinctiveness-matrix -->

> Full configuration for each personality lives in `personalities.ts`. To regenerate the summary and matrix above after changing a personality, run `node scripts/generate-personality-matrix.mjs --write` — it bundles `personalities.ts` and `personality-distinctiveness.ts` with esbuild and imports the metric directly, so the numbers are never hand-typed. Do not edit the generated section by hand.

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

## Accessibility

All personalities inherit:

- A `minimumRatio` of at least **4.5** and an `enhancedRatio` of **7** (WCAG AA / AAA targets).
- `prefersReducedMotion` handling on personalities with stronger motion (`minimal`, `soft`, `professional`, `soft-touch`, `control-center`, `foundation`).
- Touch target sizes ≥ 44 px on mobile breakpoints.

When introducing a new personality, validate it with the existing contrast and theme-validation harnesses in `libs/theme-lib` before adding it to the registry.

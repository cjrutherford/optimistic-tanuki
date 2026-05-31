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

Each personality differs from the others in at least four dimensions. This is the at-a-glance comparison for design and code review:

| Personality      | Border radius    | Shadow              | Animation           | Body font weight | Spacing     | Headline differentiator                |
| ---------------- | ---------------- | ------------------- | ------------------- | ---------------- | ----------- | -------------------------------------- |
| `classic`        | Soft (4–8 px)    | Subtle              | Normal `ease`       | 400              | Comfortable | Traditional, trustworthy baseline.     |
| `minimal`        | Sharp (0–4 px)   | None                | Fast linear         | 300–400          | Spacious    | Maximum whitespace, near-zero chrome.  |
| `bold`           | Soft (8–12 px)   | Dramatic offset     | Fast bouncy         | 700              | Comfortable | Action-oriented, high contrast.        |
| `soft`           | Round (16–24 px) | Subtle              | Slow flowing        | 300–400          | Airy        | Serif voice, gentle pace.              |
| `professional`   | Sharp (4 px)     | Subtle              | Fast (near-instant) | 500              | Compact     | Enterprise clarity.                    |
| `playful`        | Pill (9999 px)   | Neon glow           | Bouncy              | 700              | Spacious    | Comic Neue + bouncy bezier.            |
| `elegant`        | None / Sharp     | Dramatic            | Slow                | 400              | Comfortable | Playfair Display, double borders.      |
| `architect`      | Sharp (0 px)     | Hard offset (6 px)  | Stepped             | 800              | Compact     | Brutalist monospace + Oswald headings. |
| `soft-touch`     | Pill (9999 px)   | Soft glow           | Slow flowing        | 400–500          | Airy        | Quicksand + Nunito, pill controls.     |
| `electric`       | Soft (10 px)     | Neon glow           | Pulsing             | 700              | Comfortable | DM Serif Display headings + warmth.    |
| `control-center` | Sharp (4 px)     | Medium grid-pattern | Stepped             | 500–600          | Compact     | Grid background, JetBrains Mono body.  |
| `foundation`     | Sharp (0 px)     | None                | None                | 500              | Compact     | Pure system fonts, no chrome.          |

> Full configuration for each personality lives in `personalities.ts`; the table above summarises the dimensions a designer or reviewer is most likely to validate by eye.

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

- **Tags:** gentle, calming, wellness, friendly
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

- **Tags:** organic, warm, gentle, soft, friendly
- **Category:** casual
- **Used by:** `local-hub` (Towne Square)
- **Best for:** Form-heavy UIs, community apps, anything that should feel inviting and unhurried.

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
- **Best for:** Prototypes, getting-started kits, utilitarian internal tooling.

## Declaring a Personality in an App

Apps declare their canonical personality in two places that must stay aligned:

1. **`PRODUCT_PERSONALITIES`** entry in `libs/theme-models/src/lib/product-personalities.ts`.
2. **`apps/<project>/src/index.html`** sets `<body data-personality="…">` so the initial CSS render matches the personality even before Angular hydrates.

Switching the canonical personality requires updating both the mapping and the matching app `index.html` body attribute. Marketing docs, design-system docs, and comparison UI use the mapping as the canonical product catalog reference.

## Verification

- **Unit test:** `libs/theme-models/src/lib/product-personalities.spec.ts` asserts that every product maps to a registered personality.
- **Storybook:** the personality showcase stories in `libs/theme-ui` render the catalog and let a reviewer compare personalities side-by-side.
- **Live comparison:** the `<otui-personality-comparison>` component (see `libs/theme-ui/src/lib/theme-ui/personality-comparison.component.ts`) renders the same UI primitives across multiple personalities and can be embedded in apps or stories.

## Accessibility

All personalities inherit:

- A `minimumRatio` of at least **4.5** and an `enhancedRatio` of **7** (WCAG AA / AAA targets).
- `prefersReducedMotion` handling on personalities with stronger motion (`minimal`, `soft`, `professional`, `soft-touch`, `control-center`, `foundation`).
- Touch target sizes ≥ 44 px on mobile breakpoints.

When introducing a new personality, validate it with the existing contrast and theme-validation harnesses in `libs/theme-lib` before adding it to the registry.

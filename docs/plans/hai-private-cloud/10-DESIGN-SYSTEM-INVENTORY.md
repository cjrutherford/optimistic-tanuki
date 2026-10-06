# Design-System Inventory

Produced in S001 on 2026-10-05. It records what the HAI site is actually built
from, so new private-cloud pages can reuse it. Rendered values were measured
from a local production build (`node dist/apps/hai/server/server.mjs`) in
Chromium at 1440 px and 375 px, in light and dark mode, with no saved user
theme.

## How colour works

Colour is not authored in the HAI app. `provideProductTheme('hai')` hands
`ThemeService` a default personality (`foundation`), mode (`light`), and
primary (`#204434`). The service generates the full palette and emits it as
CSS custom properties on `:root`. A visitor who picks a different mode,
personality, or colour in the **Appearance** menu overrides all of it, and
their choice is saved.

New styles must therefore read colour from variables only (D008). The values
below are what the defaults produce today. They are for orientation, **not
values to copy**.

| Token                            | Light     | Dark      | Role                                      |
| -------------------------------- | --------- | --------- | ----------------------------------------- |
| `--background`                   | `#ffffff` | `#272f2c` | page                                      |
| `--surface`                      | `#fcfcfd` | `#333d39` | panels                                    |
| `--foreground`                   | `#0c0d0d` | `#ffffff` | body text                                 |
| `--foreground-muted` / `--muted` | `#6b7671` | —         | secondary text                            |
| `--primary`                      | `#33cc88` | `#33cc88` | brand fills, CTAs                         |
| `--primary-text`                 | `#1c704b` | `#8fe3be` | primary-coloured text that meets contrast |
| `--on-primary`                   | `#000000` | `#000000` | text on `--primary`                       |
| `--secondary`                    | `#ce4b85` | `#ce4b85` | second accent (pink)                      |
| `--border`                       | `#d7dad9` | `#495550` | hairlines                                 |

The configured primary `#204434` renders as `#33cc88`: the service adjusts
it to the personality's colour harmony. Under the defaults the site is light,
green, and pink. Dark mode is charcoal-green. Neither matches the "deep teal /
charcoal, cyan, restrained orange" description in
`02-BRAND-AND-DESIGN-CONSTRAINTS.md`; per D008 that description is the
intended feel, and reaching it is a theme and personality question, not a
stylesheet one.

Other variables the app uses: `--surface-variant`, `--success`, `--warning`,
`--danger`, `--accent` (empty under `foundation`), `--gradient-primary`,
`--gradient-animated`.

### The `foundation` personality

`libs/theme-models/src/lib/personalities.ts` (`foundationPersonality`):

- radius `sharp` ×0.75 → `--personality-card-radius` and
  `--personality-button-radius` render as **0 px**;
- border style `none`, width `0px` → `--personality-border-width` is **0 px**;
- shadow intensity `none`;
- spacing `compact` ×0.85 (`--spacing-md` = 13.6 px);
- fonts: Public Sans (body and headings), SF Mono stack (mono);
- animation speed `instant` (normal 75 ms); minimum contrast ratio 7.

So under the defaults every HAI panel is **square and borderless**. The
"rounded outlined panels" in doc 02 only appear under personalities that
declare radius and borders. Changing that is a decision for the owner: pick a
different default personality for `hai` in
`libs/theme-models/src/lib/product-personalities.ts`, or accept `foundation`.
Styles must not hard-code radius or borders to compensate.

## HAI-local tokens

Declared on `.landing-shell` in
`apps/hai/src/app/components/landing/landing.component.scss`. Each wraps a
personality variable with a fallback.

| Token                     | Value                                                                 |
| ------------------------- | --------------------------------------------------------------------- |
| `--hai-radius-panel`      | `var(--personality-card-radius, 1.75rem)`                             |
| `--hai-radius-pill`       | `var(--personality-button-radius, 999px)`                             |
| `--hai-border-width`      | `var(--personality-border-width, 1px)`                                |
| `--hai-border-style`      | `var(--personality-border-style, solid)`                              |
| `--hai-shadow-panel`      | `var(--personality-card-shadow, <literal>)`                           |
| `--hai-shadow-hover`      | two `color-mix()` shadows from `--foreground` and `--primary`         |
| `--hai-transition`        | `var(--personality-transition, 180ms cubic-bezier(0.22, 1, 0.36, 1))` |
| `--hai-panel-background`  | surface/primary gradient                                              |
| `--hai-panel-strong`      | surface/secondary/primary gradient (hero surfaces)                    |
| `--hai-outline`           | `--border` at 70%                                                     |
| `--hai-scroll-margin-top` | `clamp(4.5rem, 8vw, 6rem)`                                            |

**These tokens exist only inside `.landing-shell`.** Section components
inherit them because they render inside it. A page on any other route will
not get them. S002 should move them to a scope every route shares before
placeholder pages are added.

## Typography

| Element          | Rendered (1440 / 375)             | Defined as                                                                         | Source                                            |
| ---------------- | --------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------- |
| Font family      | Public Sans                       | `var(--font-body, var(--personality-font-family, …))`                              | personality                                       |
| `h1` (hero)      | 92.8 px / 38.4 px                 | `clamp(3rem, 7vw, 5.8rem)`; ≤640 px `clamp(2.4rem, 8vw, 3.2rem)`; line-height 0.95 | `landing.component.scss`                          |
| Section `h2`     | 51.2 px / 32 px                   | `clamp(2rem, 4.2vw, 3.2rem)` (12 copies across 9 files)                            | each section's SCSS                               |
| Eyebrow          | 12.48 px, 700, 0.18 em, uppercase | `font: 700 0.78rem/1.1`, colour `--foreground` 62% + `--secondary`                 | redefined in 9 files                              |
| Lede             | 1.15 rem / 1.8                    | `max-width: 44rem`, `--foreground` 74%                                             | `landing`, `hardware-catalog`, `solutions-matrix` |
| Base line height | 1.5                               | `libs/theme-styles/src/lib/base.scss`                                              | —                                                 |

The theme also emits a type scale (`--type-display` 2.488 rem, `--type-h1`
2.074 rem, `--type-h2` 1.728 rem, `--type-body` 1 rem, `--type-small` 0.833
rem). **The HAI app uses none of it**; it has its own larger fluid clamps.

`apps/hai/src/index.html` loads Cormorant Garamond and Manrope from Google
Fonts. **Nothing renders in either font**: every rule resolves to the
personality font first. Those are two wasted render-blocking requests (S017).

## Spacing and layout

- Page gutter: `.landing-shell` padding `1.75rem clamp(1rem, 3vw, 2.5rem) 5rem`.
- Panels: fluid padding clamps, e.g. `clamp(1.6rem, 3.5vw, 3rem)` (hero),
  `clamp(2.5rem, 5vw, 4rem) clamp(1.6rem, 3vw, 2.5rem)` (sections). No shared
  scale.
- The theme emits `--spacing-*` and `--layout-max-width` (80 rem); the app
  uses neither. Sections fill the gutter width with no max width.
- Layout is CSS grid within each component (`hero-panel`: `1.2fr 0.8fr`,
  collapsing to one column at 960 px).

## Breakpoints

All `max-width`, chosen per component: 420, 480, 640 (7 uses), 700, 760, 800,
960 (5), 1024 (2), 1100 px. The common collapse points are **960 px** (two
columns → one) and **640 px** (stacked CTAs, tighter padding). Neither page
size showed horizontal overflow at 1440 or 375 px.

## Light and dark mode

- Default `light`. The **Appearance** menu (`lib-theme-toggle`) switches mode
  and personality; the choice persists in `localStorage`.
- Dark mode sets `html[data-theme='dark']`. `base.scss` switches
  `color-scheme`. `apps/hai/src/styles.scss` also has a `body.dark` rule, but
  the measured body class was `personality-foundation` in both modes, so that
  selector never matches.
- Everything that uses variables follows the mode. The 13 colour literals
  listed in `01-CURRENT-STATE.md` do not.

## Components

### In use

| Component            | Selector                                                                                     | Library         | Notes                                                                                                                                                                              |
| -------------------- | -------------------------------------------------------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Card                 | `otui-card`                                                                                  | `common-ui`     | `tone` (`neutral`/`info`/`success`/`warning`/`danger`/`brand`), `emphasis` (`solid`/`soft`/`outline`/`ghost`), `size`, `CardVariant`; HAI uses `brand`/`soft` and `neutral`/`soft` |
| Badge                | `otui-badge`                                                                                 | `common-ui`     | same tone/emphasis contract                                                                                                                                                        |
| Tabs                 | `otui-tabs`                                                                                  | `common-ui`     | industry stacks                                                                                                                                                                    |
| Nav sidebar          | `otui-nav-sidebar`                                                                           | `navigation-ui` | mobile nav                                                                                                                                                                         |
| Theme toggle         | `lib-theme-toggle`                                                                           | `theme-ui`      | Appearance menu                                                                                                                                                                    |
| Personality backdrop | `lib-personality-backdrop`                                                                   | `theme-ui`      | page pattern layer                                                                                                                                                                 |
| Contact form         | `lib-contact-form`                                                                           | `blogging-ui`   | title, button text, subjects, initial message                                                                                                                                      |
| About tag            | `hai-about-tag`                                                                              | `hai-ui`        | floating bottom-left badge on every page                                                                                                                                           |
| Motion scenes        | `otui-personality-scene`, `otui-topographic-drift`, `otui-pulse-rings`, `otui-aurora-ribbon` | `motion-ui`     | decorative; take `reducedMotion`                                                                                                                                                   |

### Available, not yet used by HAI

From `libs/common-ui/src/lib/common-ui/`: `otui-button` (tone, emphasis,
size, `useGradient`), `otui-section-heading` (eyebrow, heading,
subheading), `otui-hero-section`, `otui-content-section` (max width),
`otui-grid`, `otui-flex-layout`, `otui-accordion` (useful for FAQs),
`otui-tile`, `otui-metric-tile`. Each takes colour and spacing overrides as
inputs; new pages should leave those unset so the theme drives them.

## Page patterns

These are the building blocks a native-looking private-cloud page reuses.

1. **Section shell:** a `<section>` with an anchor id, eyebrow → `h2` → lede
   or copy block → content grid. Every landing section follows it, and each
   restyles it locally.
2. **Hero panel:** `data-theme-surface="hero"` (gets `--hai-panel-strong`),
   outline from `--hai-outline`, two-column copy plus `otui-card` aside,
   decorative motion layer behind, collapsing at 960 px.
3. **CTA pair:** `a.cta.primary` (fill `--primary`, text `--on-primary`) and
   `a.cta.secondary` (surface fill, border mix), pill radius from the
   personality, full width at ≤640 px, lift on hover, motion disabled under
   reduced motion. The `data-tone`/`data-emphasis`/`data-size` attributes on
   these anchors are **not styled by anything**; the look comes entirely from
   `.cta` rules in `landing.component.scss`, which are encapsulated to the
   landing component.
4. **Card grid:** `otui-card` (`brand`/`soft`) tiles in a CSS grid (services,
   hardware tiers, ecosystem).
5. **Anchor target:** `.anchor-target` 1 px marker with `scroll-margin-top`
   so the sticky header doesn't cover headings.
6. **Freedom statement:** the hero card's "How we work" note already carries
   the freedom principle in heading type.

## Motion and reduced motion

- Decorative canvas scenes behind the page and hero; the page scene is
  browser-only and 50% opacity.
- `LandingComponent.reducedMotion` reads `prefers-reduced-motion` and is
  passed to every motion component and to smooth scrolling.
- Three `@media (prefers-reduced-motion: reduce)` blocks remove CTA
  transitions and lifts.

## Defects found

Not fixed in S001 (inventory only). Each is assigned to the slice that should
own it.

| Defect                                                                                                                                                                       | Evidence                                                    | Owner slice                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------- |
| `--border-color` is never emitted by `ThemeService` and has no fallback, so 11 border declarations in `hardware-catalog` and `solutions-matrix` are invalid and draw nothing | measured `.spec-section` `border-top-style: none`           | S009 / S010 (when those files are touched), or S012  |
| Header "Schedule Free Audit" text fails WCAG AA on its gradient: white text 1.76–5.18:1 in light, dark text 1.93–5.69:1 in dark                                              | `title-bar.component.scss:104–105`, measured gradient stops | S016                                                 |
| `--hai-*` tokens only exist inside `.landing-shell`                                                                                                                          | `landing.component.scss`                                    | S002                                                 |
| Eyebrow and `h2` styles duplicated in 9 files                                                                                                                                | grep across `components/`                                   | S012                                                 |
| 13 colour literals ignore the theme (D008)                                                                                                                                   | `01-CURRENT-STATE.md`                                       | whichever slice touches each file; remainder in S012 |
| Unused Google Fonts request                                                                                                                                                  | `index.html`                                                | S017                                                 |
| `body.dark` rule never matches                                                                                                                                               | `styles.scss`, measured body class                          | S012                                                 |
| Every logo asset includes `dev`                                                                                                                                              | `apps/hai/public/`                                          | S003, needs owner asset                              |

## Guidance for later slices

- Colour, radius, border, shadow, and font come from theme or personality
  variables. Use `var(--token, fallback)`, with fallbacks that are themselves
  variables where possible.
- Reuse `otui-card`, `otui-badge`, and the `.cta` / section-shell patterns
  before writing new ones. Prefer `otui-section-heading` and `otui-accordion`
  over new local equivalents.
- Collapse at 960 px and 640 px to match the existing sections.
- Pass `reducedMotion` to any motion component, and guard transitions.
- Keep each component stylesheet under the 8 kB warning budget (16 kB
  error).

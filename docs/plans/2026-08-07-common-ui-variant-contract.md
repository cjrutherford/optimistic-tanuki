# Common-UI Canonical Variant Contract

Date: 2026-08-07

## Problem

HAI's landing sections are hand-rolled SCSS that consume `--personality-*`
variables directly and bypass `common-ui` primitives entirely. Changing the
"look and feel" therefore has no shared surface to act on. Compounding this,
`common-ui` has **four incompatible variant conventions**:

- **Rich decorative** — `card` via `Variantable`/`VariantOptions`
  (`@Input() CardVariant`, ~40-field option bag).
- **Semantic string unions** — `button`
  (`primary|secondary|outlined|text|warning|danger|success|rounded`),
  `chip` (`primary|secondary|success|warning|error`).
- **`default|glass|gradient`** — `accordion`, `breadcrumb`, `modal`.
- **Orthogonal axes (the intended direction)** — `badge` (`tone` + `shape` +
  `size`, with a `@deprecated variant` bridge), `state-message` (`kind` +
  `tone`).

Value vocabularies clash (`error` vs `danger`, `primary` vs `brand`,
`glass/gradient` vs `outlined/text`) and input names clash (`variant` vs
`CardVariant` vs `tone/shape` vs `kind`).

## Goal

Standardize a single canonical variant contract, built on top of the existing
theme + personality systems, and migrate the core primitives to it with
backward-compatible deprecation bridges. This is the foundation that makes real
visual variability possible (a later track adopts it in HAI; copy is a separate
track).

## Canonical Contract

`libs/common-ui/src/lib/common-ui/interfaces/variant.contract.ts`

```ts
export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'brand';
export type Emphasis = 'solid' | 'soft' | 'outline' | 'ghost';
export type VariantSize = 'sm' | 'md' | 'lg';
export interface VariantContract {
  tone: Tone;
  emphasis: Emphasis;
  size: VariantSize;
}
```

- **tone** binds to theme tokens already emitted by `ThemeService`:
  `--<tone>` + `--on-<tone>`. `brand` -> `--primary`/`--on-primary`;
  `neutral` -> `--surface-variant`/`--foreground`. No theme-layer changes.
- **emphasis** is the visual treatment: `solid|soft|outline` from the badge
  pattern, plus new `ghost` (transparent, no border, tone-colored text —
  replaces button `text`).
- **size** unifies the `sm|md|lg` scale.

Personality remains authoritative for radius, border width/style, shadow
profile and fonts; the contract only owns tone color + emphasis treatment.

## Shared Mixin

`libs/common-ui/src/lib/common-ui/interfaces/_variant.scss` — promotes the
badge's `data-tone`/`data-emphasis` -> `--variant-bg-source`/`--variant-fg-source`
mechanism into a single `@mixin variant-surface`. Every primitive `@use`s it so
all render identically. `brand+solid` on button keeps the existing gradient path.

## Per-Component Migration (all keep legacy inputs as `@deprecated` aliases)

- **Button**: legacy union -> `{tone,emphasis}` map
  (primary=brand/solid, secondary=neutral/solid, outlined=brand/outline,
  text=brand/ghost, warning/danger/success=same/solid, rounded=brand/solid+pill).
  New inputs `tone`, `emphasis`, `size`. Gradient path preserved for brand+solid.
- **Chip**: `error->danger`, `primary->brand`, `secondary->neutral`; add
  `emphasis` (default soft) + `size`.
- **Badge**: already correct; realign `shape` -> shared `emphasis` (keep `shape`
  as deprecated alias), adopt shared mixin.
- **Card**: keep heavyweight `CardVariant` decorative system as-is; add
  orthogonal tone/emphasis/size for the common case. Non-breaking.
- **Accordion + Modal**: retain `default|glass|gradient` as `@deprecated surface`
  alias; add tone/emphasis. glass/gradient map to soft emphasis + surface flag.

## Testing / Verification

- TDD: red spec per component — new axes render `data-*` attributes AND legacy
  alias still maps — before implementation.
- `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test common-ui` + lint + build.
- Spot-build a heavy consumer (`business-portal-ui` and/or `hai`).

## Out of Scope

- HAI landing adoption of the new components (separate track).
- Copy pass on the HAI page (separate independent track).
- Deleting the legacy `VariantOptions` bag.

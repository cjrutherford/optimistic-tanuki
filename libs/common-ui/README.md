# Common UI

`common-ui` contains shared Angular UI primitives and styles used across multiple applications. Its source lives under `libs/common-ui/src/lib/common-ui` and `libs/common-ui/src/lib/styles`.

## Repo Role

- common presentation building blocks
- reduces duplication across app-specific UI libraries

## Key Surfaces

- buttons, cards, badges, and other shared primitives
- shared style helpers under `libs/common-ui/src/lib/styles`

## Documentation

- generated API reference in `ui-playground`: `/docs/api/common-ui`
- use `pnpm exec nx run ui-playground:api-docs-content` to regenerate the curated API index

## Nx Commands

```bash
pnpm exec nx build common-ui
pnpm exec nx test common-ui
pnpm exec nx storybook common-ui          # interactive
pnpm exec nx build-storybook common-ui    # static build → dist/storybook/common-ui
```

## Primitives

These shared primitives are the supported entry points for new UI work.
Each ships a Storybook story under `Primitives/*` exercising every personality
(via the global **Personality** toolbar) and both light / dark modes (via
the **Mode** toolbar). Prefer them over re-rolling per-app variants.

| Primitive                 | Selector               | Stories                      |
| ------------------------- | ---------------------- | ---------------------------- |
| `MetricTileComponent`     | `otui-metric-tile`     | `Primitives/MetricTile`      |
| `StateMessageComponent`   | `otui-state-message`   | `Primitives/StateMessage`    |
| `EmptyStateComponent`     | `otui-empty-state`     | `Primitives/StateMessage`    |
| `LoadingStateComponent`   | `otui-loading-state`   | `Primitives/StateMessage`    |
| `ErrorStateComponent`     | `otui-error-state`     | `Primitives/StateMessage`    |
| `SectionHeadingComponent` | `otui-section-heading` | `Primitives/SectionHeading`  |
| `TileComponent`           | `otui-tile`            | `TileComponent`              |
| `NotificationComponent`   | `otui-notification`    | `Components/Notification`    |
| `ButtonComponent`         | `otui-button`          | `Components/Button` (legacy) |

### Theming contract

Primitives only read **semantic theme tokens** written by
`@optimistic-tanuki/theme-lib`'s `ThemeService`:

- `--background`, `--foreground`
- `--surface`, `--muted`, `--muted-foreground`, `--border`
- `--primary`, `--secondary`, `--tertiary` (+ `-foreground` / `--on-*` pairs)
- `--success`, `--danger`, `--warning`

Per-component overrides go through documented custom properties on the host
(e.g. `--metric-tile-background`, `--section-heading-radius`) rather than
ad-hoc inputs or inline styles. Translucent shades use
`color-mix(in oklab, var(--token) X%, transparent)` so they adapt to mode.

### Migration recipes

Every app slice in `docs/plans/2026-05-30-ui-audit-remediation/` used the same
three moves. Use these as the canonical references when porting a legacy app.

#### 1. Hard-coded gradient → token pair

Per-app gradient endpoints belong in `styles.scss` `:root` as semantic
tokens, not in component SCSS.

**Before** (`apps/leads-app/src/app/dashboard.component.scss` pre-`b255074f`):

```scss
&.auto {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
}
&.manual {
  background: linear-gradient(135deg, #10b981, #34d399);
}
&.value {
  background: linear-gradient(135deg, #f59e0b, #fbbf24);
}
```

**After** (`b255074f`):

```scss
// apps/leads-app/src/styles.scss
:root {
  --stat-auto-start: #6366f1;
  --stat-auto-end: #8b5cf6;
  --stat-manual-start: #10b981;
  --stat-manual-end: #34d399;
  --stat-value-start: #f59e0b;
  --stat-value-end: #fbbf24;
}

// apps/leads-app/src/app/dashboard.component.scss
&.auto {
  background: linear-gradient(135deg, var(--stat-auto-start), var(--stat-auto-end));
}
&.manual {
  background: linear-gradient(135deg, var(--stat-manual-start), var(--stat-manual-end));
}
&.value {
  background: linear-gradient(135deg, var(--stat-value-start), var(--stat-value-end));
}
```

The literal hex values stay in `:root` as SSR / pre-`ThemeService` fallbacks
— the UI-heuristics scanner deliberately ignores `:root` and
`[data-theme=...]` declaration blocks.

#### 2. Inline style inputs → host CSS custom properties

Legacy primitives accepted style props like `background` / `padding` /
`borderRadius`. New code should drive appearance via documented custom
properties so personality + mode toggles still take effect.

**Before:**

```html
<otui-section-heading heading="Dashboard" background="#0b1a2c" color="#ffffff" padding="2rem" borderRadius="16px"></otui-section-heading>
```

**After:**

```html
<otui-section-heading heading="Dashboard" class="dashboard-hero"></otui-section-heading>
```

```scss
.dashboard-hero {
  --section-heading-background: color-mix(in oklab, var(--primary) 18%, var(--surface));
  --section-heading-color: var(--foreground);
  --section-heading-padding: 2rem;
  --section-heading-radius: 16px;
}
```

The deprecated inputs remain on `SectionHeadingComponent` for back-compat
(see the `LegacyInputs` story) but should not be set in new code.

#### 3. Translucent overlays → `color-mix`

Hand-tuned `rgba(0, 0, 0, 0.4)` overlays do not adapt to dark mode.

**Before:**

```scss
.overlay {
  background: rgba(0, 0, 0, 0.4);
}
.muted-text {
  color: #6b7280;
}
```

**After:**

```scss
.overlay {
  background: color-mix(in oklab, var(--foreground) 40%, transparent);
}
.muted-text {
  color: var(--muted-foreground);
}
```

### Verification

A repo-wide heuristic scanner enforces this contract. To check a single app:

```bash
pnpm run ui:heuristics                          # human-readable
pnpm run ui:heuristics:ci                       # CI gate (uses tools/scripts/ui-heuristics-allowlist.json)
```

All 20 client apps are pinned at a budget of `0` findings — any regression
will fail the `lint` workflow.

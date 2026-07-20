# Theme Styles Library

`theme-styles` is a source-only SCSS library: a curated set of Sass partials
shared across workspace UI component libraries. It has no build output and no
runtime JS API beyond a small `MIXIN_CATEGORIES` metadata export.

## Repo Role

- shared SCSS partials for component libraries (personality shadow/transition
  contract today; grows as new consumers land)
- documents the CSS custom-property contracts emitted by `theme-lib`'s
  `ThemeService`, rather than hand-authoring competing values

## Import mechanism

There is **no** bare-specifier import (`@optimistic-tanuki/theme-styles/...`)
— no project depends on this package, and no tsconfig path maps it. That
usage was documented previously but never worked.

The real mechanism: `nx.json`'s `targetDefaults` sets
`stylePreprocessorOptions.includePaths: ["libs/theme-styles/src/lib"]` for the
Angular application builders (`@angular/build:application` and
`@angular-devkit/build-angular:application`). Every component `.scss` file
compiled through an app build — or a Storybook build, which delegates to an
app's browser target — can resolve directories under
`libs/theme-styles/src/lib` as Sass load paths. No per-project
`stylePreprocessorOptions`, path mapping, or package dependency is needed.

```scss
// any component .scss compiled through an Angular/Nx build
@use 'personality' as p;

.card {
  @include p.shadow('md');

  &:hover {
    @include p.shadow('lg');
    @include p.personality-transition(box-shadow);
  }
}
```

`personality/_index.scss` (`@forward 'shadows';`) is the curated entry point.
Add partials to `libs/theme-styles/src/lib/personality/` only as new
consumers land (see the shadow/background/surface workstreams in
`docs/plans/2026-07-18-personality-styles-refactor.md`) — do not recreate the
old wholesale `personality-tokens.scss` / `personality-effects.scss` estate
that this replaced (a CI guard, `pnpm run check:no-personality-scss`, blocks
those filenames from reappearing under `libs/*/src/lib/styles/`).

## Available mixins

### `personality/_shadows.scss`

Thin wrappers over CSS custom properties emitted by `theme-lib`'s
`ThemeService` — no shadow/duration values are authored here.

- `shadow($size: 'md')` — emits `box-shadow: var(--shadow-#{$size})`.
  `$size` is one of `none | sm | md | lg | xl`.
- `personality-transition($properties: transform, $speed: 'fast')` — emits a
  `transition-property` / `transition-duration` / `transition-timing-function`
  triplet driven by `var(--animation-duration-#{$speed})` and
  `var(--animation-easing)`. `$speed` is one of `fast | normal | slow`.

See the header comment in `personality/_shadows.scss` for the full
`--shadow-*` / `--shadow-color` / `--shadow-opacity` variable contract.

### `components/toolbar.scss`

Predates the includePaths mechanism and has no current consumer. It is not
part of the curated `personality/` surface — treat it as a reference file
pending its own migration, not a supported import target.

## Nx Commands

```bash
pnpm exec nx test theme-styles   # only if/when a project.json + test target exist
```

`theme-styles` has no `project.json` today (no build/lint/test targets); it
is consumed purely as SCSS source via the includePaths mechanism above.

## Accessibility

The variable contract this library wraps is expected to respect user
preferences upstream (in `theme-lib`'s `ThemeService`):

- **Reduced Motion**: consumers of `personality-transition` should still
  guard animated properties with `prefers-reduced-motion` where appropriate.
- **Contrast**: shadow/opacity values are mode-scaled by the theme service.

// Theme Styles Library - shared SCSS partials for UI component libraries
//
// theme-styles is a *source-only* SCSS library. Nothing here is imported as a
// TypeScript/bare-specifier package (`@optimistic-tanuki/theme-styles/...`) —
// that never worked (no tsconfig path mapping, no package export, no project
// declares it as a dependency) and is not the mechanism this library uses.
//
// ## Usage
//
// The workspace's `nx.json` `targetDefaults` sets
// `stylePreprocessorOptions.includePaths: ["libs/theme-styles/src/lib"]` for
// the Angular application builders (`@angular/build:application` and
// `@angular-devkit/build-angular:application`). Every component style file
// compiled through an app build (or a Storybook build, which delegates to an
// app's browser target) can therefore resolve directories under
// `libs/theme-styles/src/lib` as Sass load paths — no per-project
// `stylePreprocessorOptions`, path mapping, or package dependency needed.
//
// ### Curated personality partials
//
// ```scss
// // any component .scss compiled through an Angular/Nx build
// @use 'personality' as p;
//
// .card {
//   @include p.shadow('md');
//
//   &:hover {
//     @include p.shadow('lg');
//     @include p.personality-transition(box-shadow);
//   }
// }
// ```
//
// `personality/_index.scss` forwards only the partials that have a real
// consumer today (see `personality/_shadows.scss` for the documented
// `--shadow-*` / `--animation-*` variable contract this wraps). Grow this
// set deliberately as new consumers land — do not recreate the old
// wholesale `personality-tokens.scss` / `personality-effects.scss` estate
// (removed; see docs/plans/2026-07-18-personality-styles-refactor.md).
//
// ### Component styles (`components/toolbar.scss`)
//
// `components/toolbar.scss` predates the includePaths mechanism and has no
// current consumer. It is not part of the curated `personality/` surface;
// treat it as a reference file pending its own migration, not a supported
// import target.

// Version
export const VERSION = '1.0.0';

// Re-export any TypeScript utilities
export { MIXIN_CATEGORIES } from './lib/mixins/index';

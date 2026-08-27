/**
 * Personality Backdrop Component (Workstream C2, 2026-07-18
 * personality-styles-refactor plan)
 *
 * The single, reusable delivery mechanism for a personality's page
 * background pattern, replacing one-off per-app `styles.scss` recipes.
 * Paints `--page-background-pattern` (emitted by `ThemeService` once the
 * C0 encoding fix landed — see `theme.service.ts`) as a fixed,
 * non-interactive layer sitting behind the app's real content.
 *
 * Deliberately a *component* (with an encapsulated stylesheet), not a
 * directive that sets inline styles like `ThemeHostBindingsDirective`
 * does: `@media (prefers-contrast: more)`, `(forced-colors: active)`, and
 * `(prefers-reduced-motion: reduce)` are stylesheet-only concerns — there
 * is no equivalent inline-style guard — and all three are mandatory here
 * (the pattern must disappear for high-contrast/forced-colors users, and
 * the fade-in must not run for reduced-motion users).
 *
 * Usage: drop `<lib-personality-backdrop />` once near the top of an app's
 * root component template (see `apps/ui-playground` and
 * `apps/forgeofwill` for the reference integration). If the app's
 * `styles.scss` already paints `--page-background-pattern` on `body`
 * directly (the documented alternative, e.g. the pre-C2 `forgeofwill`
 * recipe), remove that rule when adopting this component so the pattern
 * isn't painted twice.
 *
 * SSR note: `applyPersonalityTheme` is browser-only, so `--page-background
 * -pattern` is unset during server-rendered first paint; the fade-in below
 * makes the pattern's later arrival read as an intentional reveal rather
 * than a flash, once the client sets the variable.
 */
import { Component } from '@angular/core';

@Component({
  selector: 'lib-personality-backdrop',
  standalone: true,
  template: '',
  styleUrl: './personality-backdrop.component.scss',
})
export class PersonalityBackdropComponent {}

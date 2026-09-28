import { InjectionToken } from '@angular/core';

/**
 * Kill switch for the personality extension layer (expression, type scale,
 * atmosphere, motion and their wiring variables). Defaults to `true`.
 *
 * When `false`, `ThemeService` skips `resolveExtensionVariables` entirely, so
 * the app renders exactly as it did before the extension layer. Opting a
 * personality in changes every app that uses it at once; an app whose
 * components have not adopted the mixins yet provides `false` until they do.
 * It is also the fastest rollback for a bad opt-in.
 */
export const PERSONALITY_EXTENSIONS_ENABLED = new InjectionToken<boolean>(
  'PERSONALITY_EXTENSIONS_ENABLED',
  { providedIn: 'root', factory: () => true }
);

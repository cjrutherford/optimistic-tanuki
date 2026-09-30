import {
  EnvironmentProviders,
  InjectionToken,
  makeEnvironmentProviders,
} from '@angular/core';
import type { Observable } from 'rxjs';

/** The part of a personality `otui-personality-scene` reads (`motion.scenes`). */
export interface ScenePersonality {
  id?: string;
  motion?: { scenes?: readonly string[] };
}

/**
 * The active personality, for `otui-personality-scene`. motion-ui doesn't
 * depend on theme-lib, so apps supply it with `provideScenePersonality()`.
 * Without it, the host shows its `fallbackScene`.
 */
export const SCENE_PERSONALITY = new InjectionToken<
  Observable<ScenePersonality | null | undefined>
>('SCENE_PERSONALITY');

/**
 * Supplies `SCENE_PERSONALITY`. The factory runs in an injection context:
 *
 *   provideScenePersonality(() => inject(ThemeService).personality$)
 */
export function provideScenePersonality(
  source: () => Observable<ScenePersonality | null | undefined>
): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: SCENE_PERSONALITY, useFactory: source },
  ]);
}

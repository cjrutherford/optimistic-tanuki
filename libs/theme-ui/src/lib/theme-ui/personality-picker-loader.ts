import { InjectionToken } from '@angular/core';
import type { EventEmitter, Type } from '@angular/core';
import type { Personality } from '@optimistic-tanuki/theme-lib';

export interface PersonalityPickerHostContract {
  personalities: Personality[];
  currentPersonality: Personality | null;
  titleId: string;
  personalitySelected: EventEmitter<Personality>;
  closed: EventEmitter<void>;
}

export type PersonalityPickerLoader = () => Promise<
  Type<PersonalityPickerHostContract>
>;

export const THEME_PERSONALITY_PICKER_LOADER =
  new InjectionToken<PersonalityPickerLoader>(
    'Theme personality picker loader',
    {
      providedIn: 'root',
      factory: () => () =>
        import('./personality-picker-host.component').then(
          ({ PersonalityPickerHostComponent }) => PersonalityPickerHostComponent
        ),
    }
  );

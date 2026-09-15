import type { Decorator, Preview } from '@storybook/angular';
import { applicationConfig, moduleMetadata } from '@storybook/angular';
import { provideAnimations } from '@angular/platform-browser/animations';
import {
  PREDEFINED_PERSONALITIES,
  StorybookThemeBridgeComponent,
} from '@optimistic-tanuki/theme-lib';

/**
 * Wraps every story in the theme bridge so the Personality and Mode toolbar
 * selections are applied through ThemeService, exactly as they are in apps.
 */
const themeBridgeDecorator: Decorator = (story, context) => {
  const storyResult = story();
  return {
    ...storyResult,
    props: {
      ...storyResult.props,
      storybookPersonalityId: context.globals['personalityId'] ?? 'classic',
      storybookColorMode: context.globals['colorMode'] ?? 'light',
    },
    template: `<lib-storybook-theme-bridge [personalityId]="storybookPersonalityId" [mode]="storybookColorMode">${
      storyResult.template ?? '<story />'
    }</lib-storybook-theme-bridge>`,
  };
};

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

/**
 * The Storybook preview shared by every UI library and by ui-playground, which
 * composes the libraries' stories. Library-specific additions are passed as
 * overrides; decorators are appended after the theme bridge.
 */
export function createPreview(overrides: Preview = {}): Preview {
  return {
    ...overrides,
    globalTypes: {
      personalityId: {
        name: 'Personality',
        description: 'Design personality preset',
        toolbar: {
          icon: 'paintbrush',
          dynamicTitle: true,
          items: PREDEFINED_PERSONALITIES.map((personality) => ({
            value: personality.id,
            title: personality.name,
          })),
        },
      },
      colorMode: {
        name: 'Mode',
        description: 'Theme mode',
        toolbar: {
          icon: 'mirror',
          dynamicTitle: true,
          items: [
            { value: 'light', title: 'Light' },
            { value: 'dark', title: 'Dark' },
          ],
        },
      },
      ...overrides.globalTypes,
    },
    initialGlobals: {
      personalityId: 'classic',
      colorMode: 'light',
      ...overrides.initialGlobals,
    },
    decorators: [
      applicationConfig({
        providers: [provideAnimations()],
      }),
      moduleMetadata({
        imports: [StorybookThemeBridgeComponent],
      }),
      themeBridgeDecorator,
      ...asArray(overrides.decorators),
    ],
  };
}

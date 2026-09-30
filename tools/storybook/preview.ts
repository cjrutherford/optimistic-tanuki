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
      storybookPrimaryColor: context.globals['primaryColor'] ?? '#3f51b5',
    },
    template: `<lib-storybook-theme-bridge [personalityId]="storybookPersonalityId" [mode]="storybookColorMode" [primaryColor]="storybookPrimaryColor">${
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
      primaryColor: {
        name: 'Primary',
        description: "The user's primary colour",
        toolbar: {
          icon: 'circle',
          dynamicTitle: true,
          items: [
            { value: '#3f51b5', title: 'Indigo' },
            { value: '#d97706', title: 'Amber' },
            { value: '#0d9488', title: 'Teal' },
          ],
        },
      },
      ...overrides.globalTypes,
    },
    initialGlobals: {
      personalityId: 'classic',
      colorMode: 'light',
      primaryColor: '#3f51b5',
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

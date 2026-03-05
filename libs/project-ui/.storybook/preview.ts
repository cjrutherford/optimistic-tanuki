import type { Preview } from '@storybook/angular';
import { applicationConfig, moduleMetadata } from '@storybook/angular';
import { provideAnimations } from '@angular/platform-browser/animations';
import { StorybookThemeBridgeComponent } from '@optimistic-tanuki/theme-lib';

const allPersonalities = [
  'classic',
  'minimal',
  'bold',
  'soft',
  'professional',
  'playful',
  'elegant',
  'architect',
  'soft-touch',
  'electric',
  'control-center',
  'foundation',
];

const preview: Preview = {
  globalTypes: {
    personalityId: {
      name: 'Personality',
      description: 'Design personality preset',
      defaultValue: 'classic',
      toolbar: {
        icon: 'paintbrush',
        items: allPersonalities,
      },
    },
    colorMode: {
      name: 'Mode',
      description: 'Theme mode',
      defaultValue: 'light',
      toolbar: {
        icon: 'mirror',
        items: ['light', 'dark'],
      },
    },
  },
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
  },
  decorators: [
    applicationConfig({
      providers: [provideAnimations()],
    }),
    moduleMetadata({
      imports: [StorybookThemeBridgeComponent],
    }),
    (story, context) => {
      const storyResult = story();
      return {
        ...storyResult,
        props: {
          ...storyResult.props,
          personalityId: context.globals['personalityId'] ?? 'classic',
          mode: context.globals['colorMode'] ?? 'light',
        },
        template: `<lib-storybook-theme-bridge [personalityId]="personalityId" [mode]="mode">${
          storyResult.template ?? '<story />'
        }</lib-storybook-theme-bridge>`,
      };
    },
  ],
};

export default preview;

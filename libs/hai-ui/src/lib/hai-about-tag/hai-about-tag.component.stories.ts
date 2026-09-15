import { provideHttpClient } from '@angular/common/http';
import {
  applicationConfig,
  type Meta,
  type StoryObj,
} from '@storybook/angular';
import { HaiAboutConfig } from '../hai-types/hai-app.config';
import { HaiAboutTagComponent } from './hai-about-tag.component';

const config: HaiAboutConfig = {
  appId: 'forgeofwill',
  appName: 'Forge of Will',
  appTagline: 'Focused project execution with daily momentum.',
  appDescription:
    'Forge of Will is an HAI app for planning projects, tracking tasks, and keeping daily progress visible.',
  appUrl: '/forgeofwill',
};

const meta: Meta<HaiAboutTagComponent> = {
  component: HaiAboutTagComponent,
  title: 'About Tag',
  tags: ['autodocs'],
  decorators: [applicationConfig({ providers: [provideHttpClient()] })],
  args: { config },
};

export default meta;
type Story = StoryObj<HaiAboutTagComponent>;

export const Default: Story = {};

export const LongAppName: Story = {
  args: {
    config: {
      ...config,
      appId: 'christopherrutherford-net',
      appName: 'Christopher Rutherford Consulting',
    },
  },
};

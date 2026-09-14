import { provideHttpClient } from '@angular/common/http';
import {
  applicationConfig,
  type Meta,
  type StoryObj,
} from '@storybook/angular';
import { HaiAboutModalComponent } from './hai-about-modal.component';

const meta: Meta<HaiAboutModalComponent> = {
  component: HaiAboutModalComponent,
  title: 'About Modal',
  tags: ['autodocs'],
  decorators: [applicationConfig({ providers: [provideHttpClient()] })],
  args: {
    visible: true,
    config: {
      appId: 'd6',
      appName: 'd6',
      appTagline: 'Personal daily practice and self-reflection tooling.',
      appDescription:
        'd6 is an HAI app for structured reflection, personal practice, and guided day-to-day self-management workflows.',
      appUrl: '/d6',
    },
  },
  argTypes: {
    close: { action: 'close' },
  },
};

export default meta;
type Story = StoryObj<HaiAboutModalComponent>;

export const Open: Story = {};

export const Closed: Story = {
  args: { visible: false },
};

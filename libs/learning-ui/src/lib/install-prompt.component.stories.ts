import type { Meta, StoryObj } from '@storybook/angular';
import { InstallPromptComponent } from './install-prompt.component';

const meta: Meta<InstallPromptComponent> = {
  component: InstallPromptComponent,
  title: 'Install Prompt',
  tags: ['autodocs'],
  args: { available: true },
  argTypes: { install: { action: 'install' }, dismiss: { action: 'dismiss' } },
};

export default meta;
type Story = StoryObj<InstallPromptComponent>;

export const Available: Story = {};
export const Unavailable: Story = { args: { available: false } };

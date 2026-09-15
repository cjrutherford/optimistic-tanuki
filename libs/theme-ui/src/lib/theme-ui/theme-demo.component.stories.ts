import type { Meta, StoryObj } from '@storybook/angular';
import { ThemeDemoComponent } from './theme-demo.component';

const meta: Meta<ThemeDemoComponent> = {
  component: ThemeDemoComponent,
  title: 'Theme Demo',
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<ThemeDemoComponent>;

export const Default: Story = {};

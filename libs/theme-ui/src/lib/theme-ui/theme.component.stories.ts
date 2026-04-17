import type { Meta, StoryObj } from '@storybook/angular';
import { ThemeToggleComponent } from './theme.component';

const meta: Meta<ThemeToggleComponent> = {
  component: ThemeToggleComponent,
  title: 'Theme/Theme Toggle',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<ThemeToggleComponent>;

export const Primary: Story = {
  render: () => ({
    template: `<lib-theme-toggle></lib-theme-toggle>`,
  }),
};

export const DarkMode: Story = {
  render: () => ({
    template: `<lib-theme-toggle></lib-theme-toggle>`,
  }),
  parameters: {
    globals: {
      colorMode: 'dark',
    },
  },
};

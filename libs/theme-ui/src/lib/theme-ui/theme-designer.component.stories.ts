import { Meta, StoryObj } from '@storybook/angular';
import { ThemeDesignerComponent } from './theme-designer.component';
import { ThemeService } from '@optimistic-tanuki/theme-lib';

const meta: Meta<ThemeDesignerComponent> = {
  component: ThemeDesignerComponent,
  title: 'Theme/ThemeDesigner',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<ThemeDesignerComponent>;

export const Default: Story = {
  args: {},
};

export const DarkMode: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const component = (canvasElement as any).__ngContext__?.[8]?.component;
    if (component) {
      component.currentTheme = 'dark';
      component.toggleTheme();
    }
  },
};

export const WithCustomColors: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const component = (canvasElement as any).__ngContext__?.[8]?.component;
    if (component) {
      component.accentColor = '#ff6b6b';
      component.complementaryColor = '#4ecdc4';
      component.updateAccentColor();
    }
  },
};

import type { Meta, StoryObj } from '@storybook/angular';
import { PaletteSelectorComponent } from './palette-selector.component';

const meta: Meta<PaletteSelectorComponent> = {
  title: 'Theme UI/Palette Selector',
  component: PaletteSelectorComponent,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Interactive component for selecting predefined color palettes or creating custom ones. This component showcases the new streamlined theme system with standardized CSS variables and design tokens.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<PaletteSelectorComponent>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story: 'The default palette selector showing all available predefined palettes. Click on any palette to see the theme change throughout the application.',
      },
    },
  },
};

export const DarkMode: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Palette selector in dark mode. The theme automatically adapts background and foreground colors based on the selected mode.',
      },
    },
  },
  beforeEach: async () => {
    // This would need to be implemented based on your Storybook setup
    // document.documentElement.setAttribute('data-theme', 'dark');
  },
};

export const WithCustomColors: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates the custom color mode where users can pick their own accent and complementary colors using color pickers.',
      },
    },
  },
};
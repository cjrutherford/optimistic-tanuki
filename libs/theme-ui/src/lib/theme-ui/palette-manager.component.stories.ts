import type { Meta, StoryObj } from '@storybook/angular';
import { PaletteManagerComponent } from './palette-manager.component';

const meta: Meta<PaletteManagerComponent> = {
  title: 'Theme UI/Palette Manager',
  component: PaletteManagerComponent,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Advanced component for creating, editing, and managing custom color palettes. This component allows users to create their own palettes and save them for future use, in addition to viewing all predefined palettes.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<PaletteManagerComponent>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story: 'The default palette manager view showing the create button and existing palettes. You can create new palettes, edit existing ones, or delete custom palettes.',
      },
    },
  },
};

export const WithCustomPalettes: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates the palette manager with some custom palettes already created. This shows how the component looks when users have saved their own color schemes.',
      },
    },
  },
  beforeEach: () => {
    // Add some mock custom palettes to localStorage for demo purposes
    const mockPalettes = [
      {
        name: 'My Brand Colors',
        description: 'Custom palette for my company branding',
        accent: '#ff6600',
        complementary: '#0066ff',
        tertiary: '#ffcc00',
        background: { light: '#ffffff', dark: '#1a1a2e' },
        foreground: { light: '#212121', dark: '#ffffff' }
      },
      {
        name: 'Sunset Vibes',
        description: 'Warm and welcoming sunset colors',
        accent: '#ff7043',
        complementary: '#26c6da',
        tertiary: '#ff9800',
        background: { light: '#fff3e0', dark: '#1e1e1e' },
        foreground: { light: '#2c2c2c', dark: '#f5f5f5' }
      }
    ];
    
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('customPalettes', JSON.stringify(mockPalettes));
    }
  },
};

export const CreatingNewPalette: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Shows the palette creation form where users can define all aspects of a new palette including name, description, colors, and theme-specific backgrounds and foregrounds.',
      },
    },
  },
};

export const EditingPalette: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates editing an existing custom palette. Users can modify any aspect of their saved palettes.',
      },
    },
  },
};

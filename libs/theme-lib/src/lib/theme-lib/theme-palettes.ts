import { ColorPalette } from './theme.interface';

export const PREDEFINED_PALETTES: ColorPalette[] = [
  {
    name: 'Optimistic Blue',
    description: 'A vibrant blue palette with orange complementary',
    accent: '#3f51b5',
    complementary: '#c0af4b',
    tertiary: '#7e57c2',
    background: {
      light: '#ffffff',
      dark: '#1a1a2e'
    },
    foreground: {
      light: '#212121',
      dark: '#ffffff'
    }
  },
  {
    name: 'Electric Sunset',
    description: 'Warm sunset colors with electric blue accents',
    accent: '#ff6b35',
    complementary: '#359dff',
    tertiary: '#ff35a6',
    background: {
      light: '#fafafa',
      dark: '#1e1e1e'
    },
    foreground: {
      light: '#2c2c2c',
      dark: '#f5f5f5'
    }
  },
  {
    name: 'Forest Dream',
    description: 'Nature-inspired greens with earth tones',
    accent: '#4caf50',
    complementary: '#af4c95',
    tertiary: '#ff9800',
    background: {
      light: '#f1f8e9',
      dark: '#1b2e1b'
    },
    foreground: {
      light: '#2e7d32',
      dark: '#c8e6c9'
    }
  },
  {
    name: 'Cyberpunk Neon',
    description: 'Futuristic neon colors on dark backgrounds',
    accent: '#00ffff',
    complementary: '#ff00ff',
    tertiary: '#ffff00',
    background: {
      light: '#f0f0f0',
      dark: '#0a0a0a'
    },
    foreground: {
      light: '#1a1a1a',
      dark: '#ffffff'
    }
  },
  {
    name: 'Royal Purple',
    description: 'Elegant purple and gold combination',
    accent: '#673ab7',
    complementary: '#ffc107',
    tertiary: '#e91e63',
    background: {
      light: '#faf8ff',
      dark: '#2a1a3a'
    },
    foreground: {
      light: '#4a148c',
      dark: '#e1bee7'
    }
  },
  {
    name: 'Ocean Breeze',
    description: 'Cool blues and teals like ocean waves',
    accent: '#0097a7',
    complementary: '#ff7043',
    tertiary: '#26c6da',
    background: {
      light: '#e0f2f1',
      dark: '#1a2e3a'
    },
    foreground: {
      light: '#00695c',
      dark: '#b2dfdb'
    }
  },
  {
    name: 'Retro Gaming',
    description: 'Classic 80s gaming aesthetic',
    accent: '#e91e63',
    complementary: '#1ee963',
    tertiary: '#63e91e',
    background: {
      light: '#fff3e0',
      dark: '#0f0f23'
    },
    foreground: {
      light: '#bf360c',
      dark: '#ff8a65'
    }
  },
  {
    name: 'Minimal Monochrome',
    description: 'Clean black and white with subtle accents',
    accent: '#424242',
    complementary: '#bdbdbd',
    tertiary: '#2196f3',
    background: {
      light: '#ffffff',
      dark: '#121212'
    },
    foreground: {
      light: '#212121',
      dark: '#ffffff'
    }
  }
];

export function getPaletteByName(name: string): ColorPalette | undefined {
  return PREDEFINED_PALETTES.find(palette => palette.name === name);
}

export function getRandomPalette(): ColorPalette {
  return PREDEFINED_PALETTES[Math.floor(Math.random() * PREDEFINED_PALETTES.length)];
}
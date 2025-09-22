# Enhanced Theme System Documentation

## Overview

The theme system has been completely streamlined to provide a consistent, maintainable approach to styling across the entire workspace. This system includes:

- **Predefined Color Palettes**: 8 carefully crafted color schemes
- **Standardized CSS Variables**: Consistent naming convention for all theme variables  
- **Design Tokens**: Standardized spacing, shadows, typography, and other design elements
- **Utility Classes**: Ready-to-use CSS classes for common patterns

## Key Features

### 1. Predefined Color Palettes

Choose from 8 beautiful predefined palettes:

- **Optimistic Blue**: Classic blue with orange complementary
- **Electric Sunset**: Warm sunset colors with electric blue accents
- **Forest Dream**: Nature-inspired greens with earth tones
- **Cyberpunk Neon**: Futuristic neon colors on dark backgrounds
- **Royal Purple**: Elegant purple and gold combination
- **Ocean Breeze**: Cool blues and teals like ocean waves
- **Retro Gaming**: Classic 80s gaming aesthetic
- **Minimal Monochrome**: Clean black and white with subtle accents

### 2. Standardized CSS Variables

All theme variables now follow a consistent naming convention:

#### Color Variables
```css
/* Primary Colors */
--accent: #3f51b5          /* Primary accent color */
--complement: #c0af4b      /* Complementary color */
--tertiary: #7e57c2        /* Tertiary accent */
--success: #4caf50         /* Success state color */
--danger: #f44336          /* Error/danger color */
--warning: #ff9800         /* Warning color */
--background: #ffffff      /* Background color */
--foreground: #212121      /* Text color */

/* Color Shades (0-9, lighter to darker) */
--accent-0: #e8eaf6        /* Lightest shade */
--accent-1: #c5cae9
--accent-2: #9fa8da
--accent-3: #7986cb
--accent-4: #5c6bc0
--accent-5: #3f51b5        /* Base color */
--accent-6: #3949ab
--accent-7: #303f9f
--accent-8: #283593
--accent-9: #1a237e        /* Darkest shade */

/* Gradients */
--accent-gradient-light: linear-gradient(...)
--accent-gradient-dark: linear-gradient(...)
--accent-gradient-fastCycle: linear-gradient(...)
```

#### Design Token Variables
```css
/* Spacing */
--spacing-xs: 4px
--spacing-sm: 8px
--spacing-md: 16px
--spacing-lg: 24px
--spacing-xl: 32px
--spacing-xxl: 48px

/* Shadows */
--shadow-none: none
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05)
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1)
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1)
--shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1)

/* Border Radius */
--border-radius-none: 0
--border-radius-sm: 2px
--border-radius-md: 4px
--border-radius-lg: 8px
--border-radius-xl: 12px
--border-radius-full: 50%

/* Typography */
--font-size-xs: 0.75rem
--font-size-sm: 0.875rem
--font-size-base: 1rem
--font-size-lg: 1.125rem
--font-size-xl: 1.25rem
--font-size-xxl: 1.5rem

/* Z-Index */
--z-index-base: 0
--z-index-dropdown: 1000
--z-index-modal: 1050
--z-index-tooltip: 1070
--z-index-overlay: 1080
```

### 3. Utility Classes

The system includes comprehensive utility classes:

#### Spacing Utilities
```css
.p-xs, .p-sm, .p-md, .p-lg, .p-xl, .p-xxl    /* Padding */
.m-xs, .m-sm, .m-md, .m-lg, .m-xl, .m-xxl    /* Margin */
```

#### Color Utilities
```css
.bg-accent, .bg-complement, .bg-tertiary       /* Background colors */
.text-accent, .text-complement, .text-tertiary /* Text colors */
.border-accent, .border-complement             /* Border colors */
```

#### Component Base Classes
```css
.button-base    /* Base button styles */
.card-base      /* Base card styles */
.input-base     /* Base input styles */
```

## Usage

### Using the ThemeService

```typescript
import { ThemeService } from '@optimistic-tanuki/theme-ui';

export class MyComponent {
  constructor(private themeService: ThemeService) {}

  // Set a predefined palette
  selectPalette() {
    this.themeService.setPalette('Electric Sunset');
  }

  // Set custom colors
  setCustomColors() {
    this.themeService.setAccentColor('#ff6b35', '#359dff');
  }

  // Toggle theme mode
  toggleTheme() {
    const current = this.themeService.getTheme();
    this.themeService.setTheme(current === 'light' ? 'dark' : 'light');
  }
}
```

### Using the Palette Selector Component

```html
<theme-palette-selector></theme-palette-selector>
```

### Writing Component Styles

Use the standardized variables in your component styles:

```scss
.my-component {
  background-color: var(--background);
  color: var(--foreground);
  border: 1px solid var(--complement);
  border-radius: var(--border-radius-lg);
  padding: var(--spacing-md);
  box-shadow: var(--shadow-md);
  
  &:hover {
    background-color: var(--accent);
    color: var(--background);
    box-shadow: var(--shadow-lg);
  }
}

.my-button {
  @extend .button-base;  /* Use utility base class */
  background-color: var(--accent);
  
  &:disabled {
    background-color: var(--accent-7);
  }
}
```

## Migration Guide

### From Old Variable Names

| Old | New |
|-----|-----|
| `--accent-color` | `--accent` |
| `--foreground-color` | `--foreground` |
| `--complementary-color` | `--complement` |
| `--accent-shade-darken-30` | `--accent-3` |
| `--accent-shade-lighten-70` | `--accent-7` |

### Replacing Hardcoded Values

| Hardcoded | Design Token |
|-----------|--------------|
| `margin: 16px` | `margin: var(--spacing-md)` |
| `border-radius: 8px` | `border-radius: var(--border-radius-lg)` |
| `box-shadow: 0 4px 6px rgba(0,0,0,0.1)` | `box-shadow: var(--shadow-md)` |
| `font-size: 1.125rem` | `font-size: var(--font-size-lg)` |

## API Reference

### ThemeService Methods

- `setPalette(paletteName: string)`: Set a predefined palette
- `setAccentColor(accent: string, complement?: string)`: Set custom colors
- `setTheme(theme: 'light' | 'dark')`: Change light/dark mode
- `getTheme()`: Get current theme mode
- `getCurrentPalette()`: Get currently selected palette
- `getPaletteMode()`: Get palette mode ('predefined' | 'custom')

### Available Palettes

Access predefined palettes via:
```typescript
import { PREDEFINED_PALETTES, getPaletteByName } from '@optimistic-tanuki/theme-ui';
```

### Design Tokens

Access design tokens via:
```typescript
import { DEFAULT_DESIGN_TOKENS } from '@optimistic-tanuki/theme-ui';
```

## Best Practices

1. **Always use CSS variables** instead of hardcoded colors
2. **Use design tokens** for spacing, shadows, and typography
3. **Extend utility base classes** when creating new components
4. **Test in both light and dark modes** when developing
5. **Use semantic color names** (accent, complement) rather than specific colors
6. **Leverage color shades** (0-9) for hover states and variations

## Examples

See the Storybook stories for the PaletteSelectorComponent for interactive examples of the new theme system in action.
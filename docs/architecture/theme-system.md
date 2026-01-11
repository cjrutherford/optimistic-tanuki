# Theme System Reference Guide

Comprehensive reference for the Optimistic Tanuki theme system.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Core Concepts](#core-concepts)
3. [API Reference](#api-reference)
4. [Configuration](#configuration)
5. [Best Practices](#best-practices)
6. [Examples](#examples)

## Architecture Overview

The theme system is organized into three main layers:

```
┌─────────────────────────────────────────────────┐
│           Application Layer                      │
│  (Components use theme via directives/services) │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│           Theme UI Layer                         │
│  (PaletteSelectorComponent, ThemeToggleComponent)│
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│           Theme Library Layer                    │
│  (ThemeService, Directives, Configuration)      │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│           CSS Variables Layer                    │
│  (Applied to document.documentElement.style)    │
└─────────────────────────────────────────────────┘
```

### Key Components

- **ThemeService**: Core service managing theme state and color generation
- **ThemeHostBindingsDirective**: Applies theme variables to component hosts
- **ThemeVariableService**: Helper service for advanced variable management
- **theme-config.ts**: Centralized configuration and constants
- **theme-palettes.ts**: Predefined color palettes
- **design-tokens.ts**: Standardized design tokens (spacing, shadows, etc.)

## Core Concepts

### 1. Standardized Variable Names

All theme variables use a consistent naming convention:

```typescript
// Core colors
--background
--foreground
--accent
--complement
--tertiary
--success
--danger
--warning

// Color shades (0-9, lighter to darker)
--accent-0 through --accent-9
--complement-0 through --complement-9
// ... same for all colors

// Gradients
--accent-gradient-light
--accent-gradient-dark
--accent-gradient-fastCycle
// ... same for all colors

// Design tokens
--spacing-xs, --spacing-sm, --spacing-md, etc.
--shadow-none, --shadow-sm, --shadow-md, etc.
--border-radius-sm, --border-radius-md, etc.
--font-size-xs, --font-size-sm, etc.
--z-index-dropdown, --z-index-modal, etc.
```

### 2. Color Generation

The system automatically generates:
- **Color shades**: 10 shades (0-9) for each color
- **Gradients**: 3 gradient variants per color
- **Semantic colors**: Success, danger, warning derived from accent
- **Complementary colors**: Calculated or from palette definition

### 3. Theme Modes

Two theme modes are supported:
- **light**: Light background, dark text
- **dark**: Dark background, light text

Palettes can define custom background/foreground for each mode.

### 4. Palette Modes

Two palette modes are supported:
- **predefined**: Using one of 8 built-in palettes
- **custom**: User-defined accent and complementary colors

## API Reference

### ThemeService

#### Properties

```typescript
theme$(): Observable<'light' | 'dark' | undefined>
themeColors$: Observable<ThemeColors | undefined>
availablePalettes$: Observable<ColorPalette[]>
```

#### Methods

```typescript
// Set theme mode
setTheme(theme: 'light' | 'dark'): void

// Set custom colors
setAccentColor(accent: string, complement?: string): void

// Set predefined palette
setPalette(paletteName: string): void

// Getters
getTheme(): 'light' | 'dark'
getAccentColor(): string
getComplementaryColor(): string
getCurrentPalette(): ColorPalette | undefined
getPaletteMode(): 'custom' | 'predefined'
```

#### Usage Example

```typescript
import { ThemeService } from '@optimistic-tanuki/theme-lib';

@Component({
  // ...
})
export class MyComponent {
  constructor(private themeService: ThemeService) {}

  ngOnInit() {
    // Subscribe to theme changes
    this.themeService.themeColors$.subscribe(colors => {
      if (colors) {
        console.log('Current accent:', colors.accent);
      }
    });

    // Set a predefined palette
    this.themeService.setPalette('Ocean Breeze');

    // Or set custom colors
    this.themeService.setAccentColor('#ff6b35', '#359dff');

    // Toggle theme mode
    this.themeService.setTheme('dark');
  }
}
```

### ThemeHostBindingsDirective

Declaratively bind theme variables to component elements.

#### Inputs

```typescript
@Input() themeHostBindings: HostThemeBindings
@Input() useThemeColors: boolean = true
@Input() useLocalScope: boolean = true
```

#### HostThemeBindings Interface

```typescript
interface HostThemeBindings {
  // Core colors
  accent?: string;
  complement?: string;
  tertiary?: string;
  success?: string;
  danger?: string;
  warning?: string;
  background?: string;
  foreground?: string;

  // Design tokens
  spacing?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
  shadow?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  borderRadius?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
  fontSize?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | 'xxl';

  // Custom variables
  customVars?: Record<string, string>;
}
```

#### Usage Example

```typescript
import { ThemeHostBindingsDirective } from '@optimistic-tanuki/theme-lib';

@Component({
  imports: [ThemeHostBindingsDirective],
  template: `
    <!-- Automatically applies global theme colors -->
    <div [themeHostBindings]="{}">
      <p>Uses global theme</p>
    </div>

    <!-- Override specific colors -->
    <div [themeHostBindings]="{ accent: '#ff0000' }">
      <p>Custom accent</p>
    </div>

    <!-- Apply design tokens -->
    <div [themeHostBindings]="{ 
      spacing: 'lg',
      shadow: 'md',
      borderRadius: 'lg'
    }">
      <p>With design tokens</p>
    </div>

    <!-- Custom variables -->
    <div [themeHostBindings]="{ 
      customVars: { 'my-custom-var': '#00ff00' }
    }">
      <p style="color: var(--local-my-custom-var)">Custom variable</p>
    </div>
  `
})
export class MyComponent {}
```

### ThemeVariableService

Advanced helper service for theme variable management.

#### Methods

```typescript
// Apply variables to an element
applyThemeVariables(
  elementRef: ElementRef<HTMLElement>,
  variables: Record<string, string>,
  scope: 'local' | 'inherited' = 'local'
): void

// Create standardized host bindings
createStandardizedHostBindings(
  bindings: Record<string, string>
): Record<string, string>

// Generate CSS variables for components
generateComponentCSSVariables(
  themeColors: Record<string, string>,
  localOverrides?: Record<string, string>
): Record<string, string>

// Remove local variables
clearLocalVariables(elementRef: ElementRef<HTMLElement>): void

// Create CSS variable fallback chain
createFallbackChain(variables: string[]): string
```

#### Usage Example

```typescript
import { ThemeVariableService } from '@optimistic-tanuki/theme-lib';

@Component({
  // ...
})
export class MyComponent {
  constructor(
    private themeVarService: ThemeVariableService,
    private elementRef: ElementRef
  ) {}

  ngOnInit() {
    // Apply local-scoped variables
    this.themeVarService.applyThemeVariables(
      this.elementRef,
      { accent: '#ff0000', complement: '#00ff00' },
      'local'
    );

    // Create fallback chain for use in templates
    const colorWithFallback = this.themeVarService.createFallbackChain([
      '--local-accent',
      '--accent',
      '#3f51b5'
    ]);
    // Returns: 'var(--local-accent), var(--accent), #3f51b5'
  }
}
```

## Configuration

### STANDARD_THEME_VARIABLES

Defines all standardized CSS variable names.

```typescript
import { STANDARD_THEME_VARIABLES } from '@optimistic-tanuki/theme-lib';

const accentVar = STANDARD_THEME_VARIABLES.ACCENT; // '--accent'
const spacingPrefix = STANDARD_THEME_VARIABLES.SPACING_PREFIX; // '--spacing-'
```

### DEFAULT_THEME_CONFIG

Default theme configuration values.

```typescript
import { DEFAULT_THEME_CONFIG } from '@optimistic-tanuki/theme-lib';

const defaultTheme = DEFAULT_THEME_CONFIG.theme; // 'light'
const defaultAccent = DEFAULT_THEME_CONFIG.accentColor; // '#3f51b5'
```

### THEME_STORAGE_CONFIG

Configuration for theme persistence.

```typescript
import { THEME_STORAGE_CONFIG } from '@optimistic-tanuki/theme-lib';

const storageKey = THEME_STORAGE_CONFIG.STORAGE_KEY;
const palettesKey = THEME_STORAGE_CONFIG.CUSTOM_PALETTES_KEY;
```

### Helper Functions

```typescript
import { getAllVariableNames, getStandardVariable } from '@optimistic-tanuki/theme-lib';

// Get all names (standard + legacy) for a variable
const allAccentNames = getAllVariableNames('--accent');
// Returns: ['--accent', '--accent-color']

// Get standard variable by key
const accentVar = getStandardVariable('ACCENT');
// Returns: '--accent'
```

## Best Practices

### 1. Always Use ThemeService for Programmatic Changes

```typescript
// ✅ Good - Uses the service
this.themeService.setAccentColor('#ff0000');

// ❌ Bad - Direct DOM manipulation
document.documentElement.style.setProperty('--accent', '#ff0000');
```

### 2. Use Directive for Component Theming

```typescript
// ✅ Good - Declarative and type-safe
<div [themeHostBindings]="{ accent: customAccent }">

// ❌ Bad - Manual host bindings (harder to maintain)
@Component({
  host: { '[style.--accent]': 'customAccent' }
})
```

### 3. Prefer Standardized Variable Names in SCSS

```scss
// ✅ Good - Standard names
.my-component {
  background: var(--background);
  color: var(--foreground);
  border: 1px solid var(--accent);
}

// ❌ Bad - Legacy names (deprecated)
.my-component {
  background: var(--background-color);
  color: var(--foreground-color);
}
```

### 4. Use Design Tokens for Consistent Spacing and Styling

```scss
// ✅ Good - Uses design tokens
.card {
  padding: var(--spacing-lg);
  border-radius: var(--border-radius-md);
  box-shadow: var(--shadow-md);
}

// ❌ Bad - Hardcoded values
.card {
  padding: 24px;
  border-radius: 4px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
}
```

### 5. Leverage Color Shades for Variations

```scss
// ✅ Good - Uses generated shades
.button {
  background: var(--accent-5); // Base color
  
  &:hover {
    background: var(--accent-3); // Lighter
  }
  
  &:active {
    background: var(--accent-7); // Darker
  }
}

// ❌ Bad - Manual color calculations
.button {
  background: #3f51b5;
  
  &:hover {
    background: lighten(#3f51b5, 20%);
  }
}
```

### 6. Subscribe to Theme Changes for Dynamic Behavior

```typescript
// ✅ Good - Reactive to theme changes
ngOnInit() {
  this.themeService.themeColors$.subscribe(colors => {
    if (colors) {
      this.updateDynamicContent(colors);
    }
  });
}

// ❌ Bad - One-time read
ngOnInit() {
  const colors = this.themeService.themeColors$.value;
  this.updateDynamicContent(colors);
}
```

## Examples

### Example 1: Basic Component with Theme

```typescript
import { Component } from '@angular/core';
import { ThemeService, ThemeColors } from '@optimistic-tanuki/theme-lib';

@Component({
  selector: 'app-themed-card',
  template: `
    <div class="card">
      <h2>Themed Card</h2>
      <p>This card uses the current theme.</p>
    </div>
  `,
  styles: [`
    .card {
      background: var(--background);
      color: var(--foreground);
      border: 2px solid var(--accent);
      border-radius: var(--border-radius-lg);
      padding: var(--spacing-lg);
      box-shadow: var(--shadow-md);
    }

    h2 {
      color: var(--accent);
      margin-bottom: var(--spacing-sm);
    }
  `]
})
export class ThemedCardComponent {}
```

### Example 2: Component with Custom Theme Overrides

```typescript
import { Component } from '@angular/core';
import { ThemeHostBindingsDirective } from '@optimistic-tanuki/theme-lib';

@Component({
  selector: 'app-custom-themed-card',
  imports: [ThemeHostBindingsDirective],
  template: `
    <div 
      class="card"
      [themeHostBindings]="{ 
        accent: '#ff6b35',
        complement: '#359dff',
        spacing: 'xl'
      }"
    >
      <h2>Custom Themed Card</h2>
      <p>This card overrides the global theme.</p>
    </div>
  `,
  styles: [`
    .card {
      background: var(--local-background, var(--background));
      color: var(--local-foreground, var(--foreground));
      border: 2px solid var(--local-accent, var(--accent));
      padding: var(--local-spacing, var(--spacing-md));
    }

    h2 {
      color: var(--local-accent, var(--accent));
    }
  `]
})
export class CustomThemedCardComponent {}
```

### Example 3: Theme Switcher Component

```typescript
import { Component, signal } from '@angular/core';
import { ThemeService, PREDEFINED_PALETTES } from '@optimistic-tanuki/theme-lib';

@Component({
  selector: 'app-theme-switcher',
  template: `
    <div class="theme-switcher">
      <button (click)="toggleTheme()">
        {{ currentTheme() === 'light' ? '🌙' : '☀️' }}
      </button>
      
      <select (change)="onPaletteChange($event)">
        <option value="">Select Palette</option>
        @for (palette of palettes; track palette.name) {
          <option [value]="palette.name">{{ palette.name }}</option>
        }
      </select>
    </div>
  `,
  styles: [`
    .theme-switcher {
      display: flex;
      gap: var(--spacing-md);
      padding: var(--spacing-md);
      background: var(--background);
      border: 1px solid var(--complement);
      border-radius: var(--border-radius-md);
    }

    button, select {
      padding: var(--spacing-sm) var(--spacing-md);
      background: var(--accent);
      color: var(--background);
      border: none;
      border-radius: var(--border-radius-sm);
      cursor: pointer;
      font-size: var(--font-size-base);
    }

    button:hover, select:hover {
      background: var(--accent-3);
    }
  `]
})
export class ThemeSwitcherComponent {
  palettes = PREDEFINED_PALETTES;
  currentTheme = signal<'light' | 'dark'>('light');

  constructor(private themeService: ThemeService) {
    this.currentTheme.set(this.themeService.getTheme());
  }

  toggleTheme() {
    const newTheme = this.currentTheme() === 'light' ? 'dark' : 'light';
    this.themeService.setTheme(newTheme);
    this.currentTheme.set(newTheme);
  }

  onPaletteChange(event: Event) {
    const paletteName = (event.target as HTMLSelectElement).value;
    if (paletteName) {
      this.themeService.setPalette(paletteName);
    }
  }
}
```

### Example 4: Dynamic Theme-Based Styling

```typescript
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { ThemeService, ThemeColors } from '@optimistic-tanuki/theme-lib';

@Component({
  selector: 'app-dynamic-content',
  template: `
    <div class="content" [style.background]="dynamicBackground">
      <h1 [style.color]="headingColor">Dynamic Content</h1>
      <p>Content that adapts to the theme</p>
    </div>
  `,
  styles: [`
    .content {
      padding: var(--spacing-xl);
      border-radius: var(--border-radius-lg);
      box-shadow: var(--shadow-lg);
    }
  `]
})
export class DynamicContentComponent implements OnInit, OnDestroy {
  dynamicBackground = '';
  headingColor = '';
  private destroy$ = new Subject<void>();

  constructor(private themeService: ThemeService) {}

  ngOnInit() {
    this.themeService.themeColors$
      .pipe(takeUntil(this.destroy$))
      .subscribe((colors: ThemeColors | undefined) => {
        if (colors) {
          // Use gradient from theme
          this.dynamicBackground = colors.accentGradients['light'];
          // Use complementary color for heading
          this.headingColor = colors.complementary;
        }
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
```

## Advanced Topics

### Creating Custom Palettes Programmatically

```typescript
import { ColorPalette } from '@optimistic-tanuki/theme-lib';

const customPalette: ColorPalette = {
  name: 'My Custom Palette',
  description: 'A unique color scheme',
  accent: '#ff6b35',
  complementary: '#359dff',
  tertiary: '#ff35a6',
  background: {
    light: '#ffffff',
    dark: '#1a1a1a'
  },
  foreground: {
    light: '#212121',
    dark: '#f5f5f5'
  }
};

// Save to localStorage
const customPalettes = JSON.parse(
  localStorage.getItem('optimistic-tanuki-custom-palettes') || '[]'
);
customPalettes.push(customPalette);
localStorage.setItem(
  'optimistic-tanuki-custom-palettes',
  JSON.stringify(customPalettes)
);

// Apply the palette
this.themeService.setPalette('My Custom Palette');
```

### Server-Side Rendering (SSR) Considerations

The theme system is SSR-safe:

```typescript
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';

constructor(
  private themeService: ThemeService,
  @Inject(PLATFORM_ID) private platformId: object
) {}

ngOnInit() {
  if (isPlatformBrowser(this.platformId)) {
    // Only run in browser
    this.themeService.setTheme('dark');
  }
}
```

### Performance Optimization

For components that don't need reactive theme updates:

```typescript
// Instead of subscribing
this.themeService.themeColors$.subscribe(/*...*/);

// Use one-time read if theme won't change
const colors = this.themeService.themeColors$.value;
```

## Troubleshooting

### Theme not applying

1. Check ThemeService is provided at root
2. Verify CSS variables are being set: Inspect element in DevTools
3. Ensure component is using standardized variable names

### Colors look wrong

1. Verify palette is correctly set
2. Check browser console for errors
3. Ensure no conflicting CSS overrides

### Performance issues

1. Unsubscribe from observables in ngOnDestroy
2. Use OnPush change detection strategy
3. Minimize theme changes during runtime

## Summary

The Optimistic Tanuki theme system provides:
- ✅ Consistent and maintainable theming
- ✅ Type-safe API with TypeScript support
- ✅ Flexible configuration and customization
- ✅ Automatic color generation and shading
- ✅ Design token standardization
- ✅ SSR-safe implementation
- ✅ Backward compatibility

For migration from the old system, see [THEME_MIGRATION_GUIDE.md](./THEME_MIGRATION_GUIDE.md).

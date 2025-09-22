# Host Binding Migration Guide

## Overview

This guide explains how to migrate components from the old CSS variable host binding approach to the new standardized system that provides better DOM cascade handling and consistent variable naming.

## Problem with Old Approach

The previous system had several issues:

1. **Inconsistent variable naming**: `--accent` vs `--accent-color`
2. **No cascade handling**: Variables set at component level could not be overridden by child components
3. **Manual theme synchronization**: Each app component manually set document-level variables
4. **No fallback chain**: Variables didn't have proper fallbacks

## New Approach

### 1. Standardized Variable Names

All CSS variables now use consistent naming:

```typescript
// OLD (inconsistent)
'[style.--accent-color]': 'accent',
'[style.--foreground-color]': 'foreground',
'[style.--complementary-color]': 'complement',

// NEW (standardized)
'[style.--local-accent]': 'accent',
'[style.--local-foreground]': 'foreground', 
'[style.--local-complement]': 'complement',
```

### 2. Local Variable Pattern

Components now use local variables that fall back to global theme variables:

```scss
/* In component styles */
.my-component {
  /* This provides a cascade: local override → global theme → fallback */
  background-color: var(--local-background, var(--background, #ffffff));
  color: var(--local-foreground, var(--foreground, #212121));
  border-color: var(--local-complement, var(--complement, #c0af4b));
}
```

### 3. Enhanced Theme Service

The theme service now automatically sets all global variables, so app components don't need to manually set them:

```typescript
// OLD - Manual variable setting
ngOnInit() {
  this.themeService.themeColors$.subscribe(colors => {
    document.documentElement.style.setProperty('--accent', colors.accent);
    document.documentElement.style.setProperty('--complementary', colors.complementary);
    // ... more manual assignments
  });
}

// NEW - Use predefined palettes, variables auto-managed
ngOnInit() {
  this.themeService.setPalette('Ocean Breeze');
  // All theme variables are automatically applied!
}
```

## Migration Steps

### 1. Update Host Bindings

Replace old host bindings with standardized local variable names:

```typescript
// Before
host: {
  '[style.--background]': 'background',
  '[style.--foreground]': 'foreground',
  '[style.--accent]': 'accent',
  '[style.--complement]': 'complement',
}

// After  
host: {
  '[style.--local-background]': 'background',
  '[style.--local-foreground]': 'foreground',
  '[style.--local-accent]': 'accent',
  '[style.--local-complement]': 'complement',
}
```

### 2. Update Component Styles

Update CSS to use the new fallback pattern:

```scss
/* Before */
.my-component {
  background-color: var(--background);
  color: var(--foreground);
  border-color: var(--complement);
}

/* After */
.my-component {
  background-color: var(--local-background, var(--background, #ffffff));
  color: var(--local-foreground, var(--foreground, #212121));
  border-color: var(--local-complement, var(--complement, #c0af4b));
}
```

### 3. Update applyTheme Methods

Use standardized color properties and design tokens:

```typescript
// Before
override applyTheme(colors: ThemeColors): void {
  this.background = colors.background;
  this.accent = colors.accent;
  this.complement = colors.complementary;
  this.transitionDuration = '0.3s';
}

// After
override applyTheme(colors: ThemeColors): void {
  this.background = colors.background;
  this.accent = colors.accent;
  this.complement = colors.complementary;
  this.tertiary = colors.tertiary; // Now available
  this.transitionDuration = '0.15s'; // Standardized duration
}
```

### 4. Remove Manual Variable Setting

Remove manual `document.documentElement.style.setProperty` calls for theme colors:

```typescript
// Before - Remove this code
this.themeService.themeColors$.subscribe(colors => {
  document.documentElement.style.setProperty('--accent', colors.accent);
  document.documentElement.style.setProperty('--complementary', colors.complementary);
  // etc...
});

// After - Only set app-specific variables
this.themeService.themeColors$.subscribe(colors => {
  // Only set non-theme variables like patterns, app-specific styling
  document.documentElement.style.setProperty('--background-pattern', myPattern);
});
```

## Benefits of New System

### 1. Better Cascade Control

```scss
/* Global theme variables (set by ThemeService) */
:root {
  --accent: #3f51b5;
  --complement: #c0af4b;
}

/* Component-level overrides */
.my-component {
  --local-accent: #ff6b35;  /* This component uses different accent */
}

/* Child components inherit the override */
.my-component .child {
  background: var(--local-accent, var(--accent)); /* Uses #ff6b35 */
}
```

### 2. Automatic Theme Management

- Theme service handles all global variable updates
- Components automatically receive theme changes
- No manual synchronization needed
- Predefined palettes work out of the box

### 3. Design Token Integration

Components can now use design tokens in their host bindings:

```typescript
// Using the new ThemeHostBindingsDirective (advanced usage)
@Component({
  selector: 'my-component',
  template: '<div themeHostBindings [themeHostBindings]="bindings">Content</div>'
})
export class MyComponent {
  bindings = {
    accent: '#custom-color',
    spacing: 'lg',        // Uses --spacing-lg
    shadow: 'md',         // Uses --shadow-md
    borderRadius: 'xl'    // Uses --border-radius-xl
  };
}
```

## Examples of Updated Components

See the following updated components for reference:
- `CardComponent` - Complex variant system with local overrides
- `TextInputComponent` - Form component with focus states
- `BlogComposeComponent` - Complex component with multiple theme elements
- `AboutComponent` - Page component with predefined palette usage

## Testing Your Migration

1. **Visual Testing**: Ensure components look the same after migration
2. **Theme Switching**: Test light/dark mode transitions
3. **Palette Selection**: Test with different predefined palettes
4. **Override Testing**: Verify local overrides work correctly

## Troubleshooting

### Component Not Updating with Theme Changes

Ensure your component extends `Themeable` and implements `applyTheme`:

```typescript
export class MyComponent extends Themeable {
  override applyTheme(colors: ThemeColors): void {
    // Update your component properties here
  }
}
```

### CSS Variables Not Working

Check the fallback chain in your CSS:

```scss
/* Ensure proper fallback order */
.element {
  color: var(--local-accent, var(--accent, #3f51b5));
  /*      ^local override  ^global theme ^fallback */
}
```

### Missing Design Tokens

Import the new design tokens:

```typescript
import { DEFAULT_DESIGN_TOKENS } from '@optimistic-tanuki/theme-ui';
```

The enhanced theme system provides much better maintainability and flexibility while maintaining backward compatibility.
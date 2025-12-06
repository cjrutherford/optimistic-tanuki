# Theme System Migration Guide

This guide helps you migrate to the improved, standardized theme system in Optimistic Tanuki.

## Overview of Changes

The theme system has been significantly improved with:

1. **Centralized Configuration**: All theme variables are now defined in `theme-config.ts`
2. **Standardized Variable Names**: Consistent naming convention across all components
3. **Better Type Safety**: TypeScript enums and types for all theme variables
4. **Backward Compatibility**: Legacy variable names continue to work
5. **Improved Reliability**: Enhanced directive and service implementations

## What Changed?

### CSS Variable Names

The theme system now uses standardized CSS variable names:

| Old Variable Name          | New Standard Name  | Status     |
|---------------------------|--------------------|------------|
| `--accent-color`          | `--accent`         | Deprecated |
| `--complementary-color`   | `--complement`     | Deprecated |
| `--background-color`      | `--background`     | Deprecated |
| `--foreground-color`      | `--foreground`     | Deprecated |
| `--tertiary-color`        | `--tertiary`       | Deprecated |
| `--success-color`         | `--success`        | Deprecated |
| `--danger-color`          | `--danger`         | Deprecated |
| `--warning-color`         | `--warning`        | Deprecated |

**Note**: Legacy names still work but will be removed in a future version.

### Import Changes

#### Theme Interfaces

**Before:**
```typescript
import { ThemeColors } from '@optimistic-tanuki/common-ui';
```

**After (Recommended):**
```typescript
import { ThemeColors } from '@optimistic-tanuki/theme-lib';
```

**Note**: Importing from `common-ui` still works but is deprecated.

### New Exports

The `theme-lib` now exports additional utilities:

```typescript
import {
  // Core service and types
  ThemeService,
  ThemeColors,
  ColorPalette,
  
  // Configuration and constants
  STANDARD_THEME_VARIABLES,
  LEGACY_VARIABLE_MAPPINGS,
  DEFAULT_THEME_CONFIG,
  THEME_STORAGE_CONFIG,
  
  // Helper functions
  getAllVariableNames,
  getStandardVariable,
  
  // Directives and services
  ThemeHostBindingsDirective,
  ThemeVariableService,
  
  // Palettes and tokens
  PREDEFINED_PALETTES,
  getPaletteByName,
  DEFAULT_DESIGN_TOKENS,
  generateDesignTokenCSSVariables
} from '@optimistic-tanuki/theme-lib';
```

## Migration Steps

### Step 1: Update CSS Variable Usage

Update your component stylesheets to use the new standardized names:

**Before:**
```scss
.my-component {
  background-color: var(--background-color);
  color: var(--foreground-color);
  border: 1px solid var(--accent-color);
}

.button {
  background: var(--complementary-color);
}
```

**After:**
```scss
.my-component {
  background-color: var(--background);
  color: var(--foreground);
  border: 1px solid var(--accent);
}

.button {
  background: var(--complement);
}
```

### Step 2: Update Host Bindings

If you're using host bindings in your components, update to standardized names:

**Before:**
```typescript
@Component({
  // ...
  host: {
    '[style.--accent-color]': 'accentColor',
    '[style.--complementary-color]': 'complementaryColor'
  }
})
```

**After:**
```typescript
@Component({
  // ...
  host: {
    '[style.--accent]': 'accentColor',
    '[style.--complement]': 'complementaryColor'
  }
})
```

**Better (Using the directive):**
```typescript
import { ThemeHostBindingsDirective } from '@optimistic-tanuki/theme-lib';

@Component({
  // ...
  imports: [ThemeHostBindingsDirective],
  template: `
    <div [themeHostBindings]="{ accent: customAccent }">
      <!-- content -->
    </div>
  `
})
```

### Step 3: Update TypeScript Imports

Update your imports to use `theme-lib` directly:

**Before:**
```typescript
import { ThemeColors, ThemeGradients } from '@optimistic-tanuki/common-ui';
```

**After:**
```typescript
import { ThemeColors, ThemeGradients } from '@optimistic-tanuki/theme-lib';
```

### Step 4: Use Standardized Configuration

When working with theme variables programmatically, use the standardized configuration:

**Before:**
```typescript
document.documentElement.style.setProperty('--accent-color', '#ff0000');
document.documentElement.style.setProperty('--complementary-color', '#00ff00');
```

**After:**
```typescript
import { STANDARD_THEME_VARIABLES } from '@optimistic-tanuki/theme-lib';

document.documentElement.style.setProperty(
  STANDARD_THEME_VARIABLES.ACCENT, 
  '#ff0000'
);
document.documentElement.style.setProperty(
  STANDARD_THEME_VARIABLES.COMPLEMENT, 
  '#00ff00'
);
```

**Better (Using ThemeService):**
```typescript
import { ThemeService } from '@optimistic-tanuki/theme-lib';

constructor(private themeService: ThemeService) {}

ngOnInit() {
  this.themeService.setAccentColor('#ff0000', '#00ff00');
}
```

## New Features

### ThemeHostBindingsDirective

Use the directive for type-safe theme variable binding:

```typescript
import { ThemeHostBindingsDirective } from '@optimistic-tanuki/theme-lib';

@Component({
  imports: [ThemeHostBindingsDirective],
  template: `
    <div [themeHostBindings]="{
      accent: customAccent,
      complement: customComplement,
      spacing: 'lg',
      shadow: 'md'
    }">
      <!-- Automatically applies theme variables -->
    </div>
  `
})
```

### ThemeVariableService

Use the service for advanced theme variable management:

```typescript
import { ThemeVariableService } from '@optimistic-tanuki/theme-lib';

constructor(
  private themeVarService: ThemeVariableService,
  private elementRef: ElementRef
) {}

ngOnInit() {
  // Apply variables with local scope
  this.themeVarService.applyThemeVariables(
    this.elementRef,
    { accent: '#ff0000', complement: '#00ff00' },
    'local'
  );
  
  // Create fallback chains
  const colorValue = this.themeVarService.createFallbackChain([
    '--local-accent',
    '--accent',
    '#3f51b5'
  ]);
}
```

### Centralized Configuration Access

```typescript
import {
  STANDARD_THEME_VARIABLES,
  DEFAULT_THEME_CONFIG,
  THEME_STORAGE_CONFIG
} from '@optimistic-tanuki/theme-lib';

// Use standardized constants
const accentVar = STANDARD_THEME_VARIABLES.ACCENT; // '--accent'
const defaultAccent = DEFAULT_THEME_CONFIG.accentColor; // '#3f51b5'
const storageKey = THEME_STORAGE_CONFIG.STORAGE_KEY; // 'optimistic-tanuki-theme'
```

## Backward Compatibility

### What Still Works

- ✅ **Legacy CSS variable names**: All old variable names continue to work
- ✅ **Existing imports from common-ui**: Re-exported for compatibility
- ✅ **Current ThemeService API**: No breaking changes to existing methods
- ✅ **Existing component host bindings**: Old variable names in host bindings still function

### What Will Be Removed Eventually

The following deprecated features will be removed in version 2.0:

- ❌ Legacy CSS variable names (`--accent-color`, etc.)
- ❌ Theme interface imports from `common-ui`
- ❌ Direct theme.interface.ts import from common-ui

### Deprecation Timeline

- **Current Version**: All legacy features work with deprecation warnings in console
- **Next Minor Version (1.x)**: Continue support with stronger warnings
- **Next Major Version (2.0)**: Remove legacy support

## Testing Your Migration

### 1. Check for Console Warnings

Run your application and check the browser console for any deprecation warnings.

### 2. Verify CSS Variables

Open browser DevTools and inspect elements to ensure CSS variables are applied correctly:

```javascript
// In browser console
const styles = getComputedStyle(document.documentElement);
console.log('Accent:', styles.getPropertyValue('--accent'));
console.log('Complement:', styles.getPropertyValue('--complement'));
```

### 3. Test Theme Switching

Verify that theme switching still works correctly:

```typescript
this.themeService.setTheme('dark');
this.themeService.setPalette('Electric Sunset');
```

### 4. Run Unit Tests

Ensure all existing unit tests pass:

```bash
npx nx test your-app-name
npx nx test theme-lib
```

## Common Issues and Solutions

### Issue: Colors Not Applying

**Problem**: Component styles show default colors instead of theme colors.

**Solution**: 
1. Verify you're using standardized variable names
2. Check that ThemeService is properly initialized in your app
3. Ensure the component subscribes to theme changes if needed

### Issue: TypeScript Errors on Import

**Problem**: TypeScript can't find types after migration.

**Solution**:
```typescript
// Add explicit import from theme-lib
import { ThemeColors, ColorPalette } from '@optimistic-tanuki/theme-lib';
```

### Issue: Host Bindings Not Working

**Problem**: Host binding values aren't reflected in component styles.

**Solution**: Use the new ThemeHostBindingsDirective or standardized variable names:

```typescript
// Option 1: Use directive
[themeHostBindings]="{ accent: myAccent }"

// Option 2: Update host binding
'[style.--accent]': 'myAccent'  // Not '[style.--accent-color]'
```

## Best Practices

### 1. Use ThemeService for Programmatic Changes

```typescript
// ✅ Good
this.themeService.setAccentColor('#ff0000');
this.themeService.setPalette('Ocean Breeze');

// ❌ Avoid
document.documentElement.style.setProperty('--accent', '#ff0000');
```

### 2. Use ThemeHostBindingsDirective for Component Theming

```typescript
// ✅ Good - Type-safe and maintainable
[themeHostBindings]="{ accent: customColor, spacing: 'lg' }"

// ❌ Avoid - Manual host bindings
'[style.--accent]': 'customColor'
```

### 3. Import from theme-lib

```typescript
// ✅ Good - Direct and clear
import { ThemeColors } from '@optimistic-tanuki/theme-lib';

// ❌ Avoid - Deprecated path
import { ThemeColors } from '@optimistic-tanuki/common-ui';
```

### 4. Use Standardized Constants

```typescript
// ✅ Good - Type-safe and maintainable
import { STANDARD_THEME_VARIABLES } from '@optimistic-tanuki/theme-lib';
const accentVar = STANDARD_THEME_VARIABLES.ACCENT;

// ❌ Avoid - Magic strings
const accentVar = '--accent';
```

## Need Help?

- Check the [THEME_SYSTEM.md](libs/theme-ui/THEME_SYSTEM.md) for comprehensive documentation
- Review [THEME_IMPLEMENTATION.md](THEME_IMPLEMENTATION.md) for examples
- Look at existing components using the theme system correctly
- File an issue on GitHub if you encounter problems

## Summary

The improved theme system provides:
- ✅ Better consistency across components
- ✅ Improved type safety
- ✅ Centralized configuration
- ✅ Enhanced developer experience
- ✅ Full backward compatibility during migration

Start migrating incrementally and test thoroughly. The system is designed to allow gradual adoption while maintaining full functionality.

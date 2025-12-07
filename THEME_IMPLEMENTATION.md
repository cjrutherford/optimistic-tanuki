# Theme Implementation for Client-Interface

This document describes the theme system implementation for the client-interface project, making it consistent with other projects like forgeofwill, digital-homestead, and christopherrutherford-net.

## Changes Made

### 1. Client-Interface Theme Integration

#### Updated Files:
- `apps/client-interface/src/app/app.component.ts`
- `apps/client-interface/src/styles.scss`

#### Changes:
1. **app.component.ts**: 
   - Integrated `ThemeService` from `@optimistic-tanuki/theme-lib`
   - Initialized theme on component startup
   - Subscribed to theme changes to update component properties
   - Properties now track: `background`, `foreground`, `accent`, and `backgroundGradient`

2. **styles.scss**:
   - Added global styles that use CSS variables from the theme system
   - Uses `var(--background)` for background color
   - Uses `var(--foreground)` for text color
   - Added smooth transitions for theme changes

### 2. Palette Manager Component (NEW)

A new component was created to allow users to create, edit, and manage custom color palettes.

#### File Location:
- `libs/theme-ui/src/lib/theme-ui/palette-manager.component.ts`
- `libs/theme-ui/src/lib/theme-ui/palette-manager.component.scss`
- `libs/theme-ui/src/lib/theme-ui/palette-manager.component.stories.ts`

#### Features:
- **Create New Palettes**: Users can create custom palettes with:
  - Name and description
  - Accent, complementary, and tertiary colors
  - Background and foreground colors for light and dark modes
  
- **Edit Existing Palettes**: Modify any custom palette
  
- **Delete Palettes**: Remove custom palettes (with confirmation)
  
- **View Predefined Palettes**: Browse all 8 built-in palettes:
  - Optimistic Blue
  - Electric Sunset
  - Forest Dream
  - Cyberpunk Neon
  - Royal Purple
  - Ocean Breeze
  - Retro Gaming
  - Minimal Monochrome

- **Apply Palettes**: Instantly apply any palette to see changes across the app

- **Persistent Storage**: Custom palettes are saved to localStorage

### 3. Theme Service Enhancements

#### Updated File:
- `libs/theme-lib/src/lib/theme-lib/theme.service.ts`

#### Changes:
1. **Custom Palette Support**: 
   - `setPalette()` now checks both predefined and custom palettes
   - New `loadCustomPalettes()` private method to load user-created palettes from localStorage

2. **Legacy Variable Support**:
   - Added backwards compatibility for older variable names
   - Sets both new (`--background`, `--foreground`) and legacy (`--background-color`, `--foreground-color`) variables
   - Ensures apps using old variable names continue to work

### 4. Export Updates

#### Updated File:
- `libs/theme-ui/src/index.ts`

#### Changes:
- Exported `PaletteManagerComponent` for use in other applications

## Usage

### Using Theme in Client-Interface

The theme is automatically initialized in `app.component.ts`. The component subscribes to theme changes and updates its properties accordingly.

### Using the Palette Selector

To add the palette selector to any component:

```typescript
import { PaletteSelectorComponent } from '@optimistic-tanuki/theme-ui';

@Component({
  imports: [PaletteSelectorComponent],
  template: `<theme-palette-selector></theme-palette-selector>`
})
```

### Using the Palette Manager

To add the palette manager (full create/edit functionality):

```typescript
import { PaletteManagerComponent } from '@optimistic-tanuki/theme-ui';

@Component({
  imports: [PaletteManagerComponent],
  template: `<theme-palette-manager></theme-palette-manager>`
})
```

### Using Theme Variables in Styles

All theme variables are available globally:

```scss
.my-component {
  background-color: var(--background);
  color: var(--foreground);
  border: 1px solid var(--accent);
  
  &:hover {
    background-color: var(--accent);
    color: var(--background);
  }
}

// Using design tokens
.my-card {
  padding: var(--spacing-lg);
  border-radius: var(--border-radius-md);
  box-shadow: var(--shadow-lg);
}

// Using color shades
.my-button {
  background-color: var(--accent-5); // Base color
  
  &:hover {
    background-color: var(--accent-3); // Lighter shade
  }
}
```

## Available CSS Variables

### Colors
- `--background` / `--background-color` (legacy)
- `--foreground` / `--foreground-color` (legacy)
- `--accent` / `--accent-color` (legacy)
- `--complement` / `--complementary-color` (legacy)
- `--tertiary`
- `--success`
- `--danger`
- `--warning`

### Color Shades (0-9, lighter to darker)
- `--accent-0` through `--accent-9`
- `--complement-0` through `--complement-9`
- `--tertiary-0` through `--tertiary-9`
- `--success-0` through `--success-9`
- `--danger-0` through `--danger-9`
- `--warning-0` through `--warning-9`

### Gradients
- `--accent-gradient-light`
- `--accent-gradient-dark`
- `--accent-gradient-fastCycle`
(Similar gradients available for complement, tertiary, success, danger, warning)

### Design Tokens

#### Spacing
- `--spacing-xs` (4px)
- `--spacing-sm` (8px)
- `--spacing-md` (16px)
- `--spacing-lg` (24px)
- `--spacing-xl` (32px)
- `--spacing-xxl` (48px)

#### Shadows
- `--shadow-none`
- `--shadow-sm`
- `--shadow-md`
- `--shadow-lg`
- `--shadow-xl`

#### Border Radius
- `--border-radius-none`
- `--border-radius-sm` (2px)
- `--border-radius-md` (4px)
- `--border-radius-lg` (8px)
- `--border-radius-xl` (12px)
- `--border-radius-full` (50%)

#### Typography
- `--font-size-xs` (0.75rem)
- `--font-size-sm` (0.875rem)
- `--font-size-base` (1rem)
- `--font-size-lg` (1.125rem)
- `--font-size-xl` (1.25rem)
- `--font-size-xxl` (1.5rem)

## Testing

All changes have been tested and verified:
- ✅ Client-interface builds successfully
- ✅ Theme-lib tests pass
- ✅ Theme-ui tests pass
- ✅ Palette manager component created with full functionality
- ✅ Custom palettes persist in localStorage
- ✅ Legacy variable names supported for backwards compatibility

## Examples

The following projects demonstrate the theme system in action:
- **forgeofwill**: Uses theme system with custom background patterns
- **digital-homestead**: Uses theme system with predefined palettes
- **christopherrutherford-net**: Uses theme system with custom styling
- **client-interface**: Now implements the same theme system

## Next Steps

For developers working with the theme system:
1. Use the standardized CSS variables (`--background`, not `--background-color`)
2. Leverage design tokens for consistent spacing, shadows, and typography
3. Use the palette selector or manager components for theme customization
4. Test in both light and dark modes
5. Use color shades (0-9) for hover states and variations

## Additional Resources

- See `libs/theme-ui/THEME_SYSTEM.md` for comprehensive documentation
- Check Storybook stories for interactive examples
- Review `libs/theme-lib/src/lib/theme-lib/theme-palettes.ts` for predefined palettes

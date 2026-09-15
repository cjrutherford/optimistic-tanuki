# Personality System Documentation

## Overview

The Personality System is a centralized theming solution that provides application-wide design aesthetics. It allows the entire application to share a unified visual identity that can be changed at runtime.

## Architecture

### Core Components

1. **Personality Definition** (`libs/theme-models/src/lib/personalities.ts`)

   - Defines 12 predefined personalities with full configuration
   - Each personality includes: colors, typography, spacing, shadows, animations, borders

2. **ThemeService** (`libs/theme-lib/src/lib/theme-lib/theme.service.ts`)

   - Central service managing theme state
   - Generates CSS variables from personality configuration
   - Handles persistence (localStorage)

3. **CSS Variables** - Generated dynamically based on selected personality

## Available Personalities

### Original 7

| Personality  | Description                         | Best For                 |
| ------------ | ----------------------------------- | ------------------------ |
| Classic      | Balanced, versatile, system fonts   | General purpose          |
| Minimal      | Clean, spacious, refined whitespace | Dashboards, tools        |
| Bold         | High contrast, vibrant accents      | Marketing, landing pages |
| Soft         | Pastel tones, gentle, calming       | Wellness, lifestyle      |
| Professional | Conservative, trustworthy           | Enterprise, B2B          |
| Playful      | Energetic, bouncy animations        | Games, creative          |
| Elegant      | Serif accents, luxurious            | Premium, luxury brands   |

### Library-Promoted (5)

| Personality    | Description          | Characteristics                                |
| -------------- | -------------------- | ---------------------------------------------- |
| Architect      | Brutalist industrial | Oswald headings, IBM Plex Mono, hard shadows   |
| Soft Touch     | Organic warm         | Quicksand/Nunito, pill shapes, soft shadows    |
| Electric       | Vibrant kinetic      | DM Serif Display, warm gradients               |
| Control Center | Technical dashboard  | Space Grotesk, JetBrains Mono, grid background |
| Foundation     | Minimal functional   | System fonts, maximum clarity                  |

## How It Works

### 1. Personality Selection

```typescript
// Via ThemeService
this.themeService.setPersonality('bold');
```

### 2. CSS Variable Generation

The ThemeService generates comprehensive CSS variables when a personality is applied:

```css
/* Core colors */
--background
--foreground
--surface
--muted
--border

/* Brand colors */
--primary
--primary-0 through --primary-9 (shades)
--secondary
--tertiary
--success
--warning
--danger
--info

/* Gradients */
--primary-gradient
--secondary-gradient
--tertiary-gradient

/* Typography */
--font-heading
--font-body
--font-mono

/* Animation */
--animation-speed
--animation-easing
--animation-duration-fast
--animation-duration-normal
--animation-duration-slow

/* Design tokens */
--spacing-xs, --spacing-sm, --spacing-md, --spacing-lg, --spacing-xl
--shadow-inset, --shadow-sm, --shadow-md, --shadow-lg, --shadow-xl
--border-radius-sm, --border-radius-md, --border-radius-lg
```

`--shadow-inset` is the personality-aware recessed shadow for wells, editors,
and tactile controls. It is generated from the active shadow profile and mode,
rather than being a fixed application-level literal. Consumers that need an
SSR-safe adapter should provide a fallback:

```scss
--app-shadow-inset: var(--shadow-inset, inset 0 2px 6px rgba(0, 0, 0, 0.18));
```

### 3. Component Integration

Components use CSS variables instead of hardcoded values:

```scss
// ❌ Don't use hardcoded values
color: #3f51b5;
font-family: 'IBM Plex Mono', monospace;

// ✅ Use CSS variables
color: var(--primary);
font-family: var(--font-body);
```

### 4. Theme Subscription

Components can subscribe to theme changes:

```typescript
// In Angular component
this.themeService.generatedTheme$.subscribe((theme) => {
  // Access theme.colors, theme.fonts, theme.personality
});
```

Or extend the Themeable base class:

```typescript
export class MyComponent extends Themeable {
  override applyTheme(colors: ThemeColors): void {
    // Handle theme updates
  }
}
```

## Giving an App Its Personality by Default

Each app declares its default personality, mode, and primary colour once, in
`PRODUCT_THEME_DEFAULTS` (`libs/theme-models/src/lib/product-personalities.ts`),
and applies it in `app.config.ts`:

```typescript
import { provideProductTheme } from '@optimistic-tanuki/theme-lib';

export const appConfig: ApplicationConfig = {
  providers: [provideProductTheme('forgeofwill') /* ... */],
};
```

`provideThemeDefaults({ personalityId, mode, primaryColor })` does the same for
an explicit value. The theme service is created while the app initializes, so
the personality is on the page before the first component renders.

- The defaults show until the user saves a theme of their own. Any
  `setPersonality()`, `setTheme()`, or `setPrimaryColor()` call saves one, and
  a saved theme always wins on later loads. `hasStoredPreference()` reports
  which of the two is showing.
- Apps must not call `setPersonality()` during startup or on page init: it
  overwrites the user's choice every time the app loads.
- `mode: 'auto'` follows the operating system's colour-scheme preference.
- The resolved mode is stamped on `<html>` as both `data-mode` and
  `data-theme`.

Add the base layer ahead of the app stylesheet so page background, text
colour, typefaces, links, and focus rings come from the personality without
any app CSS:

```json
"styles": ["libs/theme-styles/src/lib/base.scss", "apps/<app>/src/styles.scss"]
```

Every rule in `base.scss` has zero specificity, so app styles override it.

## Using the Personality Selector

`<lib-personality-selector>` lists the theme service's personalities and applies
the one the user picks, unless `[personalities]` or `[applyOnSelect]="false"`
is passed. `<lib-theme-designer>` includes it, along with the mode switch and
primary colour. The theme-toggle component includes a popout personality selector:

1. Click the personality button to open dropdown
2. Personalities are grouped by category (Professional, Creative, Casual, Technical)
3. Select any personality - UI updates immediately
4. Selection persists via localStorage

## Migration from Library-Specific Personalities

The old library-specific system (`library-personalities.ts`) is deprecated. The 5 library personalities are now available as application-level choices:

- `architect` → Architect personality
- `soft-touch` → Soft Touch personality
- `electric` → Electric personality
- `control-center` → Control Center personality
- `foundation` → Foundation personality

## Customizing Within a Personality

Users can customize within a personality's constraints:

```typescript
// Change primary color within current personality
this.themeService.setPrimaryColor('#ff4081');

// Switch light/dark mode
this.themeService.setTheme('dark');
```

## File Structure

```
libs/theme-lib/src/lib/theme-lib/
├── personalities.ts           # All 12 personality definitions
├── personality.interface.ts   # TypeScript interfaces
├── theme.service.ts          # Main theme management
├── color-harmony.ts          # Color generation logic
├── personality-gradients.ts   # Gradient presets
└── design-tokens.ts          # Spacing/shadow scales
```

## Best Practices

1. **Always use CSS variables** - Never hardcode colors, fonts, or spacing
2. **Provide fallbacks** - `var(--primary, #3f51b5)` for unsupported browsers
3. **Use semantic colors** - `--primary` over specific hex values
4. **Test all personalities** - Verify components look good with each personality

## Troubleshooting

### Changes not applying?

- Ensure ThemeService is initialized in the app root
- Check that CSS variables are defined on `:root`
- Verify component subscribes to theme observables

### Personality not switching?

- Check browser console for errors
- Verify localStorage is not read-only
- Ensure personality ID matches definition

### Legacy `--lib-*` variables not working?

- These are deprecated - update to standard variables
- `--lib-font-body` → `--font-body`
- `--lib-shadow-sm` → `--shadow-sm`

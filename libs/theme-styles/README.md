# Theme Styles Library

Shared styles and mixins for Optimistic Tanuki UI components.

## Installation

```bash
npm install @optimistic-tanuki/theme-styles
```

## Usage

### Component Styles

Import specific component styles:

```typescript
import '@optimistic-tanuki/theme-styles/toolbar.scss';
```

### SCSS Mixins

Import and use mixins in your SCSS files:

```scss
@use '@optimistic-tanuki/theme-styles/mixins' as *;

.my-component {
  // Layout
  @include flex-center;
  @include flex-between;

  // Effects
  @include glass-morphism(10px, 0.2);
  @include box-shadow-glow(var(--accent), 12px, 4px);

  // Responsive
  @include mobile {
    flex-direction: column;
  }

  @include tablet-up {
    flex-direction: row;
  }
}
```

## Available Mixins

### Layout

- `flex-center` - Center content with flexbox
- `flex-column` - Flex column layout
- `flex-row` - Flex row layout
- `flex-between` - Space between alignment
- `hero-section` - Hero section layout
- `content-container` - Max-width container

### Visual Effects

- `glass-morphism` - Glassmorphism effect
- `gradient-background` - Gradient backgrounds
- `gradient-border` - Gradient borders
- `box-shadow-glow` - Glowing shadows
- `electric-border-effect` - Electric border animation

### Responsive Design

- `mobile` - Mobile breakpoint (max-width: 640px)
- `tablet` - Tablet breakpoint (641px - 1024px)
- `tablet-up` - Tablet and up (min-width: 641px)
- `desktop` - Desktop breakpoint (min-width: 1025px)
- `large-desktop` - Large desktop (min-width: 1440px)

### Container Queries

- `container-query($min-width)` - Custom container query
- `container-sm` - Small container (320px)
- `container-md` - Medium container (640px)
- `container-lg` - Large container (1024px)

### Accessibility

- `reduced-motion` - Respects prefers-reduced-motion

## CSS Variables

The theme system uses these CSS variables:

### Colors

- `--background` - Background color
- `--foreground` - Text color
- `--accent` - Primary accent color
- `--complement` - Complementary color
- `--tertiary` - Tertiary color

### Typography

- `--font-body` - Body font family
- `--font-heading` - Heading font family
- `--font-mono` - Monospace font family

### Spacing

- `--spacing-xs` - 4px
- `--spacing-sm` - 8px
- `--spacing-md` - 16px
- `--spacing-lg` - 24px
- `--spacing-xl` - 32px

### Gradients

- `--gradient-primary` - Primary gradient
- `--gradient-secondary` - Secondary gradient
- `--gradient-glow` - Glow effect gradient
- `--gradient-border` - Border gradient

## Accessibility

All styles respect user preferences:

- **Reduced Motion**: Animations are disabled when `prefers-reduced-motion: reduce` is set
- **Contrast**: All color combinations meet WCAG 2.1 AA standards (4.5:1 minimum)
- **Focus States**: All interactive elements have visible focus indicators

## Browser Support

- Chrome/Edge 88+
- Firefox 78+
- Safari 14+
- Supports CSS Grid, Flexbox, and Container Queries

## License

MIT

# Theme Designer and Layout Components

This document describes the new theme designer component, style mixins, and layout components added to the `theme-ui` and `common-ui` libraries.

## Theme Designer Component

The `ThemeDesignerComponent` provides a comprehensive interface for designing and customizing themes.

### Features

- **Color Selection**: Choose accent and complementary colors with color pickers
- **Gradient Generator**: Create custom gradients with multiple color stops
  - Support for linear, radial, conic, and repeating variants
  - Adjustable angles and directions
  - Live preview
  - Preset gradients (Sunset, Ocean, Forest, Purple Haze, Fire, Cosmic)
- **Shadow Generator**: Design custom box shadows
  - Adjustable blur, spread, color, and opacity
  - Live preview
  - Preset shadows (Subtle, Medium, Large, Glow variants)
- **Theme Mode Toggle**: Switch between light and dark themes

### Usage

```typescript
import { ThemeDesignerComponent } from '@optimistic-tanuki/theme-ui';

@Component({
  selector: 'app-settings',
  template: `<lib-theme-designer></lib-theme-designer>`,
  imports: [ThemeDesignerComponent]
})
export class SettingsComponent {}
```

## Style Mixins

A comprehensive set of SCSS mixins has been created to promote DRY (Don't Repeat Yourself) principles across components.

### Available Mixins

#### Gradient Mixins

```scss
@import '@optimistic-tanuki/common-ui/lib/styles/mixins.scss';

// Create gradient backgrounds
@include gradient-background('linear', 'to right', #3f51b5, #c0af4b);
@include gradient-background('radial', 'circle', #ff0000, #00ff00);
@include gradient-background('conic', '0deg', #667eea, #764ba2);

// Create gradient borders
@include gradient-border('linear', 'to right', 2px, #3f51b5, #c0af4b);

// Animated gradients
@include animated-gradient(8s, 200%);
```

#### Shadow Mixins

```scss
// Simple glow effect
@include box-shadow-glow(#3f51b5, 12px, 4px);

// Multi-color glow
@include box-shadow-multi-glow(#3f51b5, #c0af4b, 20px, 8px, 20px, 8px);

// Inset shadows
@include box-shadow-inset(#000, 8px, 0);

// Layered shadows
@include box-shadow-layered(#3f51b5, #c0af4b, #1a1a2e);
```

#### Layout Mixins

```scss
// Flexbox helpers
@include flex-center;
@include flex-column;
@include flex-row;
@include flex-between;

// Content containers
@include content-container(1200px, 2rem);

// Hero sections
@include hero-section(60vh, 2rem);
@include hero-overlay(0.4, #000);

// Card patterns
@include card-pattern(8px, 1.5rem);

// Grid layouts
@include grid-layout(3, 2rem, 250px);
```

#### Effect Mixins

```scss
// Glassmorphism effect
@include glass-morphism(10px, 0.2, 0.3, 10px);

// Glow layer
@include glow-layer(60px, -5%, 0);

// Pulse animation
@include pulse-animation(16s, (var(--accent), var(--complement)));

// Electric border effect
@include electric-border-effect(var(--complement));
```

#### Transition Mixins

```scss
// Basic transition
@include transition-base(all, 0.3s, ease-in-out);

// Multiple transitions
@include transition-multi(
  box-shadow 0.3s ease-in-out,
  transform 0.3s ease-in-out
);
```

#### Typography Mixins

```scss
// Responsive font sizing with clamp
@include responsive-font(1rem, 2rem, 320px, 1200px);
```

## Layout Components

### HeroSectionComponent

A reusable hero section component extracted from reference projects.

#### Features

- Background image support
- Background color support
- Customizable overlay (color and opacity)
- Adjustable minimum height
- Centered content option
- Responsive typography

#### Usage

```typescript
import { HeroSectionComponent } from '@optimistic-tanuki/common-ui';

@Component({
  template: `
    <otui-hero-section 
      [backgroundImage]="'url(/assets/hero.jpg)'"
      [overlayOpacity]="0.5"
      [minHeight]="'80vh'"
      [centerContent]="true">
      <h1>Welcome to Our Platform</h1>
      <p>Build amazing things</p>
    </otui-hero-section>
  `,
  imports: [HeroSectionComponent]
})
export class LandingComponent {}
```

#### Properties

- `backgroundImage?: string` - URL of background image
- `backgroundColor?: string` - Background color
- `overlayOpacity: number` - Overlay opacity (0-1), default: 0.4
- `overlayColor: string` - Overlay color, default: '#000000'
- `minHeight: string` - Minimum height, default: '60vh'
- `centerContent: boolean` - Center content vertically and horizontally, default: true

### ContentSectionComponent

A reusable content section component for consistent content layouts.

#### Features

- Constrained max width
- Customizable padding
- Optional background color
- Responsive typography
- Centered layout

#### Usage

```typescript
import { ContentSectionComponent } from '@optimistic-tanuki/common-ui';

@Component({
  template: `
    <otui-content-section 
      [maxWidth]="'1200px'"
      [padding]="'3rem'"
      [backgroundColor]="'#f5f5f5'">
      <h2>About Us</h2>
      <p>Our story begins...</p>
    </otui-content-section>
  `,
  imports: [ContentSectionComponent]
})
export class AboutComponent {}
```

#### Properties

- `maxWidth: string` - Maximum width, default: '1200px'
- `padding: string` - Padding, default: '2rem'
- `backgroundColor?: string` - Background color (optional)

## Component Variant Enhancements

### ButtonComponent

New gradient and glow variants have been added:

```html
<!-- Gradient glow variant -->
<otui-button variant="gradient-glow">Click Me</otui-button>

<!-- Radial gradient variant -->
<otui-button variant="gradient-radial">Click Me</otui-button>

<!-- Glow on hover -->
<otui-button variant="glow-on-hover">Click Me</otui-button>
```

### CardComponent and TileComponent

Both components have been refactored to use the new mixins, making the codebase more maintainable and reducing duplication.

## Integration Examples

### Blog Layout Example

```typescript
import { Component } from '@angular/core';
import { 
  HeroSectionComponent, 
  ContentSectionComponent 
} from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'app-blog-post',
  standalone: true,
  imports: [HeroSectionComponent, ContentSectionComponent],
  template: `
    <otui-hero-section 
      [backgroundImage]="post.heroImage"
      [minHeight]="'50vh'"
      [overlayOpacity]="0.3">
      <h1>{{ post.title }}</h1>
      <p>{{ post.subtitle }}</p>
    </otui-hero-section>
    
    <otui-content-section [maxWidth]="'800px'">
      <div [innerHTML]="post.content"></div>
    </otui-content-section>
  `
})
export class BlogPostComponent {
  post = {
    title: 'My Blog Post',
    subtitle: 'A great article',
    heroImage: '/assets/blog-hero.jpg',
    content: '<p>Article content...</p>'
  };
}
```

### Landing Page Example

```typescript
import { Component } from '@angular/core';
import { 
  HeroSectionComponent, 
  ContentSectionComponent,
  CardComponent 
} from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [
    HeroSectionComponent, 
    ContentSectionComponent,
    CardComponent
  ],
  template: `
    <otui-hero-section 
      [backgroundColor]="'#3f51b5'"
      [minHeight]="'80vh'">
      <h1>Transform Your Ideas</h1>
      <p>Build the future with our platform</p>
    </otui-hero-section>
    
    <otui-content-section>
      <h2>Why Choose Us</h2>
      <div class="features">
        <otui-card CardVariant="gradient-glow">
          <h3>Fast</h3>
          <p>Lightning-fast performance</p>
        </otui-card>
        <otui-card CardVariant="gradient-glow-card">
          <h3>Secure</h3>
          <p>Bank-level security</p>
        </otui-card>
        <otui-card CardVariant="electric-border">
          <h3>Scalable</h3>
          <p>Grows with you</p>
        </otui-card>
      </div>
    </otui-content-section>
  `
})
export class LandingComponent {}
```

## Testing

All new components include comprehensive unit tests. Run tests with:

```bash
npx nx test theme-ui
npx nx test common-ui
```

## Storybook

View and interact with the components in Storybook:

```bash
npx nx storybook theme-ui
npx nx storybook common-ui
```

## Future Enhancements

Potential future additions:

1. **Theme Presets**: Pre-configured theme packages (e.g., Material, Nord, Dracula)
2. **Pattern Library**: SVG pattern generator for backgrounds
3. **Animation Builder**: Interface for creating custom CSS animations
4. **Layout Designer**: Visual drag-and-drop layout builder
5. **Component Theme Overrides**: Per-component theme customization
6. **Export/Import**: Save and load theme configurations
7. **Accessibility Tools**: WCAG contrast checker and color blindness simulator

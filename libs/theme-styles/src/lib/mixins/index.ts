// Mixins for responsive design and accessibility
// Import mixins like: @use '@optimistic-tanuki/theme-styles/mixins.scss';

// Available mixins categories:
// 1. Gradient mixins - gradient-background, gradient-border, animated-gradient
// 2. Shadow mixins - box-shadow-glow, box-shadow-multi-glow, box-shadow-layered
// 3. Border mixins - border-base, border-radius-standard
// 4. Transition mixins - transition-base, transition-multi
// 5. Layout mixins - flex-center, flex-column, flex-row, flex-between
// 6. Effect mixins - glass-morphism, glow-layer, electric-border-effect
// 7. Typography mixins - responsive-font
// 8. Grid mixins - grid-layout
// 9. Responsive mixins - mobile, tablet, desktop, container-query
// 10. Accessibility mixins - reduced-motion

export const MIXIN_CATEGORIES = {
  gradients: ['gradient-background', 'gradient-border', 'animated-gradient'],
  shadows: [
    'box-shadow-glow',
    'box-shadow-multi-glow',
    'box-shadow-inset',
    'box-shadow-layered',
  ],
  borders: ['border-base', 'border-radius-standard'],
  transitions: ['transition-base', 'transition-multi'],
  layout: [
    'flex-center',
    'flex-column',
    'flex-row',
    'flex-between',
    'hero-section',
    'hero-overlay',
    'content-container',
  ],
  effects: ['glass-morphism', 'glow-layer', 'electric-border-effect'],
  typography: ['responsive-font'],
  grid: ['grid-layout'],
  responsive: ['mobile', 'tablet', 'tablet-up', 'desktop', 'large-desktop'],
  containerQueries: [
    'container-query',
    'container-query-max',
    'container-sm',
    'container-md',
    'container-lg',
  ],
  accessibility: ['reduced-motion'],
} as const;

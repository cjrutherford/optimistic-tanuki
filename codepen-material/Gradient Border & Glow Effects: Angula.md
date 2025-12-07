# Gradient Border, Electric Border & Glow Effects: Angular Implementation Spec (v4)

This spec describes a unified approach for robust, reusable Angular UI effects using a single Card, Tile, Table, and Modal component, each supporting multiple visual variants via the `Variantable` abstract class (extending `Themeable`). Key CSS rules from the HTML examples are included for reference.

---

## **Process Overview**

1. Refactor Card, Tile, Table, and Modal components to support variants via `Variantable`
2. Create shared SVG filter asset and SCSS mixins
3. Implement effect configuration and utilities in `Variantable`
4. Document usage in Storybook

---

## **Variantable Abstract Class**

```typescript
// filepath: libs/theme-ui/src/lib/theme-ui/variantable.interface.ts
import { Themeable } from './themeable.interface';
import { ThemeColors } from './theme.interface';

export type VariantType =
  | 'default'
  | 'gradient-glow'
  | 'electric-border'
  | 'gradient-glow-card'
  | 'gradient-background'
  | 'custom';

export interface VariantOptions {
  variant?: VariantType;
  borderColor?: string;
  borderRadius?: string;
  borderWidth?: string;
  gradientType?: 'linear' | 'conic' | 'radial';
  gradientStops?: string[];
  patternType?: string;
  svgPattern?: string;
  glowFilter?: string;
  gradientColors?: string[];
  [key: string]: any;
}

export abstract class Variantable extends Themeable {
  variant: VariantType = 'default';
  variantOptions: VariantOptions = {};

  /**
   * Apply the theme colors and variant options to generate styles.
   */
  abstract applyVariant(
    colors: ThemeColors,
    options?: VariantOptions
  ): void;

  /**
   * Utility: Generate gradient CSS string from theme colors and options.
   */
  protected buildGradient(
    colors: string[],
    type: 'linear' | 'conic' | 'radial' = 'linear',
    angle: string = '90deg'
  ): string {
    switch (type) {
      case 'linear':
        return `linear-gradient(${angle}, ${colors.join(', ')})`;
      case 'conic':
        return `conic-gradient(${colors.join(', ')})`;
      case 'radial':
        return `radial-gradient(${colors.join(', ')})`;
      default:
        return '';
    }
  }

  /**
   * Utility: Generate SVG pattern string (stub for extension).
   */
  protected buildSVGPattern(type: string, colors: string[]): string {
    // Implement SVG pattern generation logic as needed
    return '';
  }
}
```

---

## **Variantable Integration**

- **Card, Tile, Table, and Modal components** will each extend `Variantable`.
- Each component will support a `variant` input and relevant options for border, gradient, glow, and pattern effects.
- All visual effects are configured through the variant system, not separate components.

---

## **Key CSS Rules for Effects**

### **Gradient Glow Border**
```css
img, .card, .tile, .modal, .table {
  box-sizing: border-box;
  border: solid var(--b) #0000;
  border-radius: calc(2 * var(--b));
  background: repeating-conic-gradient(
      from var(--a, 0deg),
      var(--l, #0000 0% 70%, #0000ff7f)
    )
    border-box;
  filter: var(--f, url(#glow-0));
  animation: a 2s linear infinite;
}
@keyframes a {
  to {
    --a: 1turn;
  }
}
```

### **Electric Border**
```css
.card-container, .tile, .modal, .table {
  padding: 2px;
  border-radius: 24px;
  position: relative;
  background: linear-gradient(
      -30deg,
      var(--gradient-color),
      transparent,
      var(--gradient-color)
    ),
    linear-gradient(
      to bottom,
      var(--color-neutral-900),
      var(--color-neutral-900)
    );
}
.border-outer {
  border: 2px solid rgba(221, 132, 72, 0.5);
  border-radius: 24px;
  padding-right: 4px;
  padding-bottom: 4px;
}
.main-card, .tile, .modal, .table {
  border: 2px solid var(--electric-border-color);
  filter: url(#turbulent-displace);
}
.glow-layer-1, .glow-layer-2 {
  position: absolute;
  border-radius: 24px;
  width: 100%;
  height: 100%;
  top: 0; left: 0; right: 0; bottom: 0;
  filter: blur(1px) / blur(4px);
}
.overlay-1, .overlay-2 {
  position: absolute;
  width: 100%; height: 100%;
  border-radius: 24px;
  mix-blend-mode: overlay;
  transform: scale(1.1);
  filter: blur(16px);
  background: linear-gradient(
    -30deg,
    white,
    transparent 30%,
    transparent 70%,
    white
  );
}
.background-glow {
  position: absolute;
  width: 100%; height: 100%;
  border-radius: 24px;
  filter: blur(32px);
  transform: scale(1.1);
  opacity: 0.3;
  z-index: -1;
  background: linear-gradient(
    -30deg,
    var(--electric-light-color),
    transparent,
    var(--electric-border-color)
  );
}
```

### **Gradient Glow Card**
```css
.box, .card, .tile, .modal, .table {
  --list: #ffbc00, #ff0058;
  --grad: linear-gradient(45deg, var(--list));
  position: relative;
  border: solid 4px #0000;
  aspect-ratio: 7/10;
  border-radius: 1em;
  background: conic-gradient(rgb(0 0 0/ 0.75) 0 0) padding-box,
    var(--grad) border-box;
}
.box::before, .card::before, .tile::before, .modal::before, .table::before {
  position: absolute;
  inset: 0;
  z-index: -1;
  background: var(--grad);
  filter: blur(0.75em);
  content: '';
}
```

---

## **SVG Filter Assets**

- **Location:** `libs/common-ui/src/assets/svg-filters.svg`
- **Usage:** Reference filters via CSS `filter: url(#glow-0)` or `filter: url(#turbulent-displace)`

---

## **SCSS Mixins & Theme Variables**

- **Mixins:** `gradient-glow-border`, `electric-border`, `gradient-glow-card`
- **Location:** `libs/theme-ui/src/styles/`
- **Theme Variables:** Add gradient, glow, and electric border variables to global theme files

---

## **Accessibility & Responsiveness**

- Use Angular Flex Layout or CSS Grid for responsive layouts
- Ensure SVG filters are hidden from screen readers (`aria-hidden="true"`)
- Provide alt text for images via `@Input()`

---

## **Summary Table**

| Component | Variants Supported                | Customization Options                | Themeable Enforcement | Gradient Utilities |
|-----------|-----------------------------------|--------------------------------------|----------------------|-------------------|
| Card      | default, gradient-glow, electric  | borderColor, gradientStops, svgPattern | Yes                  | Yes               |
| Tile      | default, gradient, electric       | backgroundGradient, borderRadius     | Yes                  | Yes               |
| Modal     | default, gradient, electric       | overlayGradient, borderColor         | Yes                  | Yes               |
| Table     | default, gradient-background      | gradientColors, svgPattern           | Yes                  | Yes               |

---

## **Next Steps**

1. Refactor Card, Tile, Table, and Modal components to extend `Variantable`
2. Create shared SVG filter asset and SCSS mixins
3. Integrate effect configuration and utilities
4. Document all variants and options in Storybook

---

## **Deliverables Checklist**

- [ ] Refactor to use `Variantable`
  - [x] Card, 
  - [ ] Tile, 
  - [ ] Table, 
  - [ ] Modal
- [ ] Create shared SVG filter asset in `libs/common-ui/src/assets/svg-filters.svg`
- [ ] Develop SCSS mixins in `libs/theme-ui/src/styles/`
- [ ] Integrate theme variables for gradients, glow, and electric borders
- [ ] Ensure responsive layout and accessibility
- [ ] Document all features and enhancements
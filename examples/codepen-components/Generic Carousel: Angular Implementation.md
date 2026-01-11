# Generic Carousel: Angular Implementation Recommendations

This breakdown analyzes the visual effects and UI patterns in `project-carousel.html` and recommends a **generic, reusable Angular carousel** component for your Nx workspace. The carousel should allow declarative definition of children via the template and provide directives for effects on carousel content, with all effects configurable via a standard options interface.

---

## 1. **Generic Carousel Component**

### **Effect**
- Swipeable, animated carousel supporting any child content.
- Effects (holographic borders, glows, HUD overlays, etc.) are applied via directives and are fully configurable.
- Responsive, interactive navigation with keyboard, mouse, and touch support.

### **Angular Implementation**

#### **A. New Component: `CarouselComponent`**
- **Location:** `libs/common-ui/src/lib/carousel/`
- **Inputs:**
  - `activeIndex: number` (optional, for controlled carousel)
  - `options: CarouselOptions` (see below)
- **Features:**
  - Renders projected child content in a swipeable carousel.
  - Emits events on active slide change.
  - Handles keyboard, mouse, and touch navigation.
  - Provides context for child directives (e.g., active/prev/next state).

**Sample Usage:**
```html
<common-ui-carousel [options]="carouselOptions" (activeSlideChange)="onSlideChange($event)">
  <ng-container *ngFor="let item of items">
    <div commonUiCarouselCard [carouselCardOptions]="item.options">
      <!-- Custom content here -->
    </div>
  </ng-container>
</common-ui-carousel>
```

#### **B. Carousel Options Interface**

```typescript
export interface CarouselOptions {
  cardWidth?: string;
  cardHeight?: string;
  showIndicators?: boolean;
  showNavigation?: boolean;
  effect?: 'holographic' | 'glow' | 'hud' | 'none';
  effectOptions?: Record<string, any>;
  responsive?: boolean;
  animation?: 'slide' | 'fade' | 'none';
}
```

---

## 2. **Carousel Card Directive**

### **Effect**
- Applies visual effects (holographic border, glow, HUD overlay, etc.) to carousel content.
- Configurable via directive options.

### **Angular Implementation**

#### **A. New Directive: `CarouselCardDirective`**
- **Location:** `libs/common-ui/src/lib/carousel-card.directive.ts`
- **Inputs:**
  - `carouselCardOptions: CarouselCardOptions`
- **Features:**
  - Applies selected effect to the host element.
  - Supports active/prev/next state styling.

**Sample Usage:**
```html
<div commonUiCarouselCard [carouselCardOptions]="{ effect: 'holographic', glowColor: '#00fff7' }">
  <!-- Custom content -->
</div>
```

#### **B. Carousel Card Options Interface**

```typescript
export interface CarouselCardOptions {
  effect?: 'holographic' | 'glow' | 'hud' | 'none';
  glowColor?: string;
  borderRadius?: string;
  animation?: 'floating' | 'glitch' | 'none';
  [key: string]: any;
}
```

---

## 3. **Carousel Navigation & Indicators**

### **Effect**
- Futuristic navigation buttons and indicator dots.

### **Angular Implementation**

#### **A. New Component: `CarouselNavigationComponent`**
- **Location:** `libs/common-ui/src/lib/carousel-navigation/`
- **Inputs:**
  - `activeIndex: number`
  - `total: number`
- **Outputs:**
  - `navigate: EventEmitter<'prev' | 'next'>`
  - `select: EventEmitter<number>`
- **Features:**
  - Renders prev/next buttons and indicator dots.
  - Handles click and keyboard events.

---

## 4. **SCSS Mixins & CSS Variables**

### **Effect**
- Uses CSS custom properties for glow colors, neon gradients, border radius, and animation.

### **Angular Implementation**

#### **A. SCSS Mixins:**
- `carousel-card`
- `holographic-border`
- `hud-overlay`
- **Location:** `libs/theme-ui/src/styles/_carousel-card.scss`, `_holographic-border.scss`, `_hud-overlay.scss`
- **Usage:**
  - Import and use in carousel and card component styles.
  - Centralize variables for easy theme customization.

#### **B. Theme Integration**
- Add neon, glow, and holographic variables to global theme files for consistency.

---

## 5. **Accessibility & Responsiveness**

### **Effect**
- Responsive layout, accessible navigation, and alt text for images.

### **Angular Implementation**

#### **A. Responsive Layout**
- Use Angular Flex Layout or CSS Grid in the carousel template.
- Ensure cards scale and maintain aspect ratio.

#### **B. Accessibility**
- Ensure navigation buttons are keyboard accessible.
- Provide alt text for images via `@Input()` or projected content.

---

## 6. **Animation & Effects**

### **Effect**
- Floating, glitch, scan line, and progress bar animations.

### **Angular Implementation**

#### **A. Animation Utilities**
- Use Angular animation APIs or encapsulate CSS keyframes in SCSS.
- Optionally, provide a service for triggering scan/glitch effects.

---

## **Summary Table**

| Feature                | Implementation                        | Library/Location                |
|------------------------|---------------------------------------|---------------------------------|
| Generic Carousel       | `CarouselComponent`                   | `libs/common-ui`                |
| Carousel Card Directive| `CarouselCardDirective`               | `libs/common-ui`                |
| Carousel Navigation    | `CarouselNavigationComponent`         | `libs/common-ui`                |
| SCSS Mixins            | `_carousel-card.scss`, `_holographic-border.scss`, `_hud-overlay.scss` | `libs/theme-ui`      |
| Theme Variables        | Add to global theme                   | `libs/theme-ui`                 |

---

## **Next Steps**

1. Scaffold `CarouselComponent`, `CarouselCardDirective`, and `CarouselNavigationComponent` in `common-ui`.
2. Create SCSS mixins and theme variables for carousel and holographic effects.
3. Document usage in


---

## **Deliverables Checklist**

- [ ] Scaffold `CarouselComponent` in `libs/common-ui/src/lib/carousel/`
- [ ] Define `CarouselOptions` interface for configurable carousel features
- [ ] Implement event emission for active slide changes and navigation support
- [ ] Scaffold `CarouselCardDirective` in `libs/common-ui/src/lib/carousel-card.directive.ts`
- [ ] Define `CarouselCardOptions` interface for effect configuration
- [ ] Apply active/prev/next state styling in card directive
- [ ] Scaffold `CarouselNavigationComponent` in `libs/common-ui/src/lib/carousel-navigation/`
- [ ] Implement navigation buttons and indicator dots with keyboard/click support
- [ ] Create SCSS mixins: `carousel-card`, `holographic-border`, `hud-overlay` in `libs/theme-ui/src/styles/`
- [ ] Add neon, glow, and holographic CSS variables to global theme files in `libs/theme-ui`
- [ ] Ensure responsive layout using Angular Flex Layout or CSS Grid
- [ ] Implement accessibility features for navigation and images
- [ ] Add animation utilities for floating, glitch, scan line, and progress bar effects
- [ ] Document usage and integration in workspace README or component docs
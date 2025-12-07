# Glass Effects: Angular Implementation Recommendations

This spec analyzes the glassmorphism effects in `swiper-card-music-player.html` and recommends how to implement reusable glass effect utilities and directives in the `common-ui` library.

---

## 1. **Glass Effect Utility**

### **Effect**
- Frosted glass backgrounds using `backdrop-filter: blur(...)`, semi-transparent backgrounds, and subtle borders.
- Used for containers, overlays, cards, and player backgrounds.

### **Angular Implementation**

#### **A. SCSS Mixin: `glass-effect`**
- **Location:** `libs/common-ui/src/lib/styles/_glass-effect.scss`
- **Features:**
  - Applies glassmorphism styles: background, blur, border, shadow.
  - Accepts parameters for blur amount, background color, border radius.

**Sample Mixin:**
```scss
@mixin glass-effect($blur: 10px, $bg: rgba(255,255,255,0.2), $radius: 15px) {
  background: $bg;
  backdrop-filter: blur($blur);
  -webkit-backdrop-filter: blur($blur);
  border-radius: $radius;
  border: 1px solid rgba(255,255,255,0.5);
  box-shadow: 0 4px 16px rgba(0,0,0,0.1);
}
```

#### **B. Directive: `GlassEffectDirective`**
- **Location:** `libs/common-ui/src/lib/glass-effect.directive.ts`
- **Inputs:**
  - `blur: string`
  - `background: string`
  - `radius: string`
- **Features:**
  - Applies glass effect to any element.
  - Configurable via directive inputs.

**Sample Usage:**
```html
<div commonUiGlassEffect [blur]="'12px'" [background]="'rgba(53,54,72,0.2)'" [radius]="'20px'">
  <!-- Content -->
</div>
```

#### **C. Enhancement: Add Glass Effect Option to Card/Modal Components**
- **Location:** `libs/common-ui/src/lib/card/`, `libs/common-ui/src/lib/modal/`
- **Modification:**
  - Add `@Input() glassEffect: boolean` and related style inputs.
  - Apply glass effect styles conditionally.

---

## 2. **Theme Integration**

- Add glass effect variables to theme files for easy customization.
- Document usage in Storybook for all affected components.

---

## **Next Steps**

1. Scaffold `GlassEffectDirective` in `common-ui`.
2. Create SCSS mixin for glass effect.
3. Enhance card and modal components to support glass effect.
4. Add documentation and Storybook stories.

---

## **Deliverables Checklist**

- [ ] Create SCSS mixin `glass-effect` in `libs/common-ui/src/lib/styles/_glass-effect.scss`
- [ ] Implement `GlassEffectDirective` in `libs/common-ui/src/lib/glass-effect.directive.ts` with configurable inputs
- [ ] Enhance card and modal components to support glass effect via `@Input() glassEffect` and related style inputs
- [ ] Add glass effect variables to theme files for customization
- [ ] Document glass effect usage in Storybook for all affected components
- [ ] Write usage documentation for SCSS mixin and directive

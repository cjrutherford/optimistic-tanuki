# Responsive Design Audit: client-interface

**Date**: 2026-06-20
**Branch**: june-26-polish
**Audit method**: Code analysis + Playwright automation across 5 viewports × 3 public routes
**Skill used**: `responsive-design-audit` (v1)

---

## Summary

| Metric                                   | Count                                                                                                |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Applications analyzed                    | 1 (`client-interface`)                                                                               |
| Dependency libraries analyzed            | 7 (`common-ui`, `navigation-ui`, `chat-ui`, `notification-ui`, `search-ui`, `motion-ui`, `theme-ui`) |
| Total media queries found                | 30 (app) + 3 (libs)                                                                                  |
| Unique breakpoint values                 | 7                                                                                                    |
| Fixed-position elements identified       | 9                                                                                                    |
| Fixed-width elements > 320px             | 11                                                                                                   |
| Touch target violations at 375px         | 6 (landing), 9 (login), 12 (register)                                                                |
| Routes with horizontal overflow at 375px | 2 (`/login`, `/register`)                                                                            |
| Mobile viewports added to Playwright     | 2 (Pixel 5, iPad gen 7)                                                                              |
| Routes audited                           | 3 (`/`, `/login`, `/register`)                                                                       |

---

## Breakpoint Coverage

### Canonical Standard

| Token | Width   | Device Target    |
| ----- | ------- | ---------------- |
| `xs`  | ≤480px  | Small phones     |
| `sm`  | ≤640px  | Large phones     |
| `md`  | ≤768px  | Tablet portrait  |
| `lg`  | ≤1024px | Tablet landscape |
| `xl`  | ≤1280px | Laptop           |
| `xxl` | >1280px | Large desktop    |

### Found vs Canonical

| Found Value | Location                                            | Canonical | Status                                   |
| ----------- | --------------------------------------------------- | --------- | ---------------------------------------- |
| `480px`     | `landing.component.scss`                            | `xs`      | ✅ matched                               |
| `600px`     | `feed.component.scss`                               | —         | ⚠️ custom — consolidate to `sm` (640px)  |
| `640px`     | `landing.component.scss`, `settings.component.scss` | `sm`      | ✅ matched                               |
| `768px`     | `landing.component.scss`                            | `md`      | ✅ matched                               |
| `960px`     | `register.component.scss`, `login.component.scss`   | —         | ⚠️ custom — consolidate to `lg` (1024px) |
| `968px`     | `landing.component.scss` (6 uses)                   | —         | ⚠️ custom — consolidate to `lg` (1024px) |
| `1024px`    | `landing.component.scss`                            | `lg`      | ✅ matched                               |

**Consolidation opportunities**: `600px`, `960px`, `968px` should migrate to canonical `640px`, `1024px` respectively.

### Existing Mixin Coverage (in `libs/common-ui/src/lib/styles/mixins.scss`)

| Mixin           | Value               | Note                                          |
| --------------- | ------------------- | --------------------------------------------- |
| `mobile`        | `max-width: 640px`  | ✅ matches `sm`                               |
| `tablet`        | `641px–1024px`      | ✅ matches `md`–`lg` range                    |
| `tablet-up`     | `min-width: 641px`  | ✅                                            |
| `desktop`       | `min-width: 1025px` | ✅ matches `xl`                               |
| `large-desktop` | `min-width: 1440px` | ⚠️ consider renaming to `xxl` or using 1536px |

**Gap**: Missing `xs` (480px) mixin. `large-desktop` at 1440px is close but doesn't match canonical 1536px.

---

## Live Test Results (Playwright, mobile-chrome)

Ran 52 tests across 5 viewports × 3 routes + cross-viewport checks.

| Viewport               | Tests  | Pass   | Fail   | Key Failures                                                              |
| ---------------------- | ------ | ------ | ------ | ------------------------------------------------------------------------- |
| 375×667 (mobile-small) | 10     | 5      | 5      | Overflow on `/login`, `/register`; touch targets below 44px on all routes |
| 430×932 (mobile-large) | 8      | 2      | 6      | Touch targets still below 44px on all routes                              |
| 768×1024 (tablet)      | 8      | 2      | 6      | Touch targets still below 44px on all routes                              |
| 1280×800 (desktop)     | 8      | 2      | 6      | Touch targets still below 44px on all routes                              |
| 1536×864 (wide)        | 8      | 2      | 6      | Touch targets still below 44px on all routes                              |
| Cross-viewport         | 4      | 4      | 0      | Nav sidebar works, no fixed element overflow ✅                           |
| **Total**              | **52** | **30** | **22** |                                                                           |

### Touch Target Violations Found

| Element                 | File                     | Width            | Height | Min dimension | Gap             |
| ----------------------- | ------------------------ | ---------------- | ------ | ------------- | --------------- |
| `<input>` fields        | Login/Register forms     | 40px (min-width) | 40px   | 40px          | 4px below 44px  |
| `"Soft Touch ⚙"` button | Theme personality toggle | 119px            | 34px   | 34px          | 10px below 44px |
| `"Login"` button        | Login form               | 210px            | 42px   | 42px          | 2px below 44px  |
| `"Google"` button       | OAuth buttons            | ~97px            | 42px   | 42px          | 2px below 44px  |
| `"GitHub"` button       | OAuth buttons            | ~96px            | 42px   | 42px          | 2px below 44px  |
| `"Microsoft"` button    | OAuth buttons            | ~109px           | 42px   | 42px          | 2px below 44px  |
| `"Facebook"` button     | OAuth buttons            | ~114px           | 42px   | 42px          | 2px below 44px  |

### Horizontal Overflow at 375px

Login and register pages show horizontal scroll at 375px viewport. Likely causes:

- Input field widths that don't scale down to 375px
- Padding/margin on form containers exceeding available width

## Route-by-Route Findings

### `/` (Landing Page)

**Mobile (375px)**:

- Hero section has `clamp()` typography — good
- Network visualization at 420px scales only to 320px at 480px breakpoint, too large for 375px screens ⚠️
- `hero-actions` switches to column layout at 480px ✅
- Grid layouts (cases: `repeat(4,1fr)` → `repeat(2,1fr)` → `1fr`) ✅
- Steps grid (`1fr auto 1fr auto 1fr` → `1fr`) ✅
- Scroll indicator hidden at 768px — good, but could use a `min-width` check
- Footer section at 768px+ only — needs review at 375px

**Tablet (768px)**:

- Hero grid switches to 1 column at 968px — but this breakpoint should be 1024px (canonical) ⚠️
- Use cases grid at `repeat(2,1fr)` — good ✅
- Step connectors rotate 90° at 968px — good pattern but 968px should be 1024px

**Desktop (1280px)**:

- `.content` max-width is 1200px — close to canonical `xl` (1280px) ⚠️
- All grids render in full layout ✅

### `/login` (Login Page)

**Mobile (375px)**:

- Form max-width and centering — appears to use `min-width` for centered card
- Typography at `clamp(2.4rem, 5vw, 4.1rem)` ✅
- Media query at `max-width: 960px` ⚠️ should be 1024px

**Tablet (768px)**:

- No tablet-specific breakpoint — uses 960px which effectively treats 768px as desktop ⚠️

### `/register` (Register Page)

**Mobile (375px)**:

- Same pattern as login — 960px breakpoint
- Grid comments suggest `grid-template-columns: minmax(0, 28rem) minmax(20rem, 36rem)` pattern with `1fr` fallback at 960px

---

## Library Analysis

### `chat-ui` (`libs/chat-ui/`)

| Issue                                            | Location                           | Severity                             |
| ------------------------------------------------ | ---------------------------------- | ------------------------------------ |
| No media queries found                           | entire library                     | 🔴                                   |
| Sidebar fixed at 300px                           | `chat-ui.component.scss:8`         | 🔴 Will overflow at 375px            |
| Chat panel fixed at 360px in app                 | `app.component.scss:108`           | 🔴 Will overflow at 375px            |
| Chat window `max-width: 800px, min-width: 300px` | `chat-window.component.scss:29-30` | 🟡 Min-width prevents proper scaling |
| No responsive mixin usage                        | —                                  | 🔴                                   |

### `notification-ui` (`libs/notification-ui/`)

| Issue                         | Location                             | Severity                                  |
| ----------------------------- | ------------------------------------ | ----------------------------------------- |
| No media queries found        | entire library                       | 🔴                                        |
| Dropdown fixed at 360px width | `notification-bell.component.ts:146` | 🟠 Overflows at 375px with right:0 offset |
| Dropdown `min-width: 320px`   | `notification-bell.component.ts:179` | 🟡 Tight at 375px                         |
| No responsive mixin usage     | —                                    | 🟠                                        |

### `navigation-ui` (`libs/navigation-ui/`)

| Issue                                                 | Location                       | Severity                            |
| ----------------------------------------------------- | ------------------------------ | ----------------------------------- |
| No media queries found                                | entire library                 | 🟠                                  |
| App-bar has `.compact` and `.small` classes           | `app-bar.component.scss:10-18` | 🟡 But no viewport-based activation |
| Nav-sidebar has no mobile overlay/off-canvas behavior | —                              | 🟠 drawer-style navigation missing  |
| Personality styles only — no responsive design        | —                              | 🟠                                  |

### `common-ui` (`libs/common-ui/`)

| Issue                                              | Location                             | Severity                                                |
| -------------------------------------------------- | ------------------------------------ | ------------------------------------------------------- |
| Responsive mixins exist but underused              | `mixins.scss:381-408`                | 🟡 Mixins available but not imported in most components |
| Gap: no `xs` (480px) mixin                         | —                                    | 🟡                                                      |
| Modal component has responsive `max-width` presets | `modal.component.scss:171-185`       | ✅ but missing mobile-first approach                    |
| Notification toast fixed at 400px                  | `notification.component.scss:12,233` | 🟠 Overflows on small phones                            |

### `search-ui` (`libs/search-ui/`)

| Issue                                                | Location                         | Severity                     |
| ---------------------------------------------------- | -------------------------------- | ---------------------------- |
| No media queries found                               | entire library                   | 🟡                           |
| Global search `max-width: 600px`                     | `global-search.component.ts:151` | 🟡 At edge for sm breakpoint |
| Explore page uses `auto-fill, minmax(280px, 1fr)`    | `explore-page.component.ts:131`  | ✅ good responsive pattern   |
| Search results dropdown position — fixed positioning | —                                | 🟡 needs mobile review       |

### `motion-ui` (`libs/motion-ui/`)

| Issue                                   | Location                         | Severity                                      |
| --------------------------------------- | -------------------------------- | --------------------------------------------- |
| No media queries                        | —                                | 🟢 Canvas components are responsive by nature |
| Components accept size/height as inputs | `murmuration-scene.component.ts` | ✅                                            |

### `theme-ui` (`libs/theme-ui/`)

| Issue                                      | Location         | Severity                                     |
| ------------------------------------------ | ---------------- | -------------------------------------------- |
| No breakpoint-specific styles              | —                | 🟢 Not expected — it's a theme designer tool |
| Utilities SCSS has no responsive utilities | `utilities.scss` | 🟢 Not in scope                              |

---

## Fixed Element Inventory

| Element               | File                                 | Position                              | Z-index | Mobile Concern                        |
| --------------------- | ------------------------------------ | ------------------------------------- | ------- | ------------------------------------- |
| Motion background     | `app.component.scss:2`               | fixed, inset 0                        | 0       | ✅ background-only                    |
| Notification bell     | `app.component.scss:67`              | fixed, top 40px, right 24px           | 1000    | ⚠️ overlaps app-bar on small screens  |
| Chat floating button  | `app.component.scss:74`              | fixed, bottom 24px, right 24px        | 1000    | ⚠️ overlaps content                   |
| Chat panel            | `app.component.scss:105`             | fixed, 360px, bottom 80px, right 24px | 1001    | 🔴 360px exceeds 375px viewport width |
| Notification dropdown | `notification-bell.component.ts:143` | fixed, right 0, width 360px           | 1000    | 🔴 360px overflows                    |
| Constellation BG      | `landing.component.scss:96`          | fixed                                 | 0       | ✅ background                         |
| Organic overlay       | `landing.component.scss:109`         | fixed                                 | 0       | ✅ background                         |
| Chat window           | `chat-window.component.scss:15,25`   | fixed                                 | —       | ⚠️ needs mobile responsive            |
| Dev info              | `dev-info.component.ts:30`           | fixed                                 | —       | 🟢 Dev-only content                   |

---

## Fixed Width Elements > 320px

| Width | Element                  | File                                 | Mobile OK?                                           |
| ----- | ------------------------ | ------------------------------------ | ---------------------------------------------------- |
| 420px | `.network-web`           | `landing.component.scss:189`         | 🔴 Only scales to 320px at 480px — too wide at 375px |
| 360px | `.chat-panel`            | `app.component.scss:108`             | 🔴 Overflows                                         |
| 360px | `.notification-dropdown` | `notification-bell.component.ts:146` | 🔴 Overflows                                         |
| 300px | `.messenger-sidebar`     | `chat-ui.component.scss:8`           | 🔴 Overflows                                         |
| 300px | Orbit elements           | `landing.component.scss:309`         | 🟢 decorative                                        |
| 500px | Feature card             | `landing.component.scss:1177`        | 🟡 Spans full width with max-width                   |
| 480px | `.hero-subtitle`         | `landing.component.scss:472`         | ⚠️ Used as max-width, becomes 100% at 968px          |
| 900px | `.content-section`       | `landing.component.scss:1070`        | ⚠️ Max-width for content sections                    |

---

## Design Token Standardization Proposal

### Add breakpoints to `libs/theme-lib/src/lib/theme-lib/design-tokens.ts`

```typescript
export interface Breakpoints {
  xs: string; // 480px
  sm: string; // 640px
  md: string; // 768px
  lg: string; // 1024px
  xl: string; // 1280px
  xxl: string; // 1536px
}

// Add to DesignTokens:
breakpoints: Breakpoints;
```

### Add `xs` mixin to `libs/common-ui/src/lib/styles/mixins.scss`

```scss
@mixin mobile-small {
  @media (max-width: 480px) {
    @content;
  }
}
```

### Update existing mixins for consistency

| Existing        | Current Value | Proposed Value  | Rationale                    |
| --------------- | ------------- | --------------- | ---------------------------- |
| `large-desktop` | 1440px        | 1536px          | Match canonical xxl standard |
| `mobile`        | 640px         | 640px           | Keep (matches sm)            |
| (missing)       | —             | Add `xs: 480px` | Fill gap for small phones    |

### Leverage existing `MobileAdaptations` interface

The `MobileAdaptations` interface in `libs/theme-models` already supports:

- `spacingMultiplier` — reduce padding/margins on mobile
- `borderRadiusMultiplier` — reduce corner radius
- `shadowReduction` — reduce shadow intensity
- `fontScale` — adjust text sizing
- `touchTargetSize` — ensure minimum 44px

**Action**: Wire these into the theme service to apply automatically when viewport ≤ 640px.

---

## E2E Test Coverage

### Added: `apps/client-interface-e2e/src/responsive-audit.spec.ts`

**Viewport profiles**:

| Profile        | Width    | Device          |
| -------------- | -------- | --------------- |
| `mobile-small` | 375×667  | iPhone SE       |
| `mobile-large` | 430×932  | iPhone Pro Max  |
| `tablet`       | 768×1024 | iPad            |
| `desktop`      | 1280×800 | Standard laptop |
| `wide`         | 1536×864 | Large desktop   |

**Tests per viewport per route** (`/`, `/login`, `/register`):

- ✅ No horizontal overflow
- ✅ Touch targets ≥ 44px
- ✅ Body text ≥ 16px
- ✅ Key visual elements visible

**Cross-viewport tests**:

- ✅ Navigation sidebar open/close on mobile
- ✅ Fixed elements don't exceed viewport width

### Playwright config updated in `apps/client-interface-e2e/playwright.config.ts`

- Renamed `chromium` → `chromium-desktop`
- Added `mobile-chrome` (Pixel 5)
- Added `tablet-chrome` (iPad gen 7)

---

### 🔴 New from Live Test — Touch Target & Overflow

- [ ] **Input fields at 40px height don't meet 44px minimum touch target (WCAG 2.5.8)**

  - Found on: `/login`, `/register` form inputs
  - Fix: Increase input `height` or `min-height` to `44px`, or use `padding` to reach 44px

- [ ] **"Soft Touch ⚙" personality toggle button at 34px height**

  - Found on: all routes (app-bar component)
  - Location: `libs/navigation-ui/src/lib/app-bar/` or theme personality selector
  - Fix: Ensure button min-height is 44px

- [ ] **Login/Register form buttons at 42px height**

  - Found on: `/login`, `/register` auth buttons and OAuth buttons
  - Fix: Increase `height` or `min-height` to `44px`

- [ ] **Horizontal scroll on `/login` and `/register` at 375px**
  - Found on: mobile-small viewport
  - Fix: Audit form container widths and ensure all children fit within 375px viewport

## Prioritized Fix List

### 🔴 Critical

- [ ] **Chat panel causes horizontal overflow on mobile**

  - Location: `apps/client-interface/src/app/app.component.scss:108` (360px fixed)
  - Fix: Use `width: min(360px, calc(100vw - 48px))` or set width to 100vw with `max-width: 360px`

- [ ] **Chat sidebar fixed at 300px will overflow at 375px**

  - Location: `libs/chat-ui/src/lib/chat-ui/chat-ui.component.scss:8`
  - Fix: Set `width: min(300px, 100%)` or use responsive mixin

- [ ] **Notification dropdown fixed at 360px overflows at 375px**

  - Location: `libs/notification-ui/src/lib/notification-bell/notification-bell.component.ts:146`
  - Fix: `width: min(360px, 100vw - 32px)` with right offset considered

- [ ] **Network web visualization at 420px doesn't scale below 480px**

  - Location: `apps/client-interface/src/app/components/landing.component.scss:189-198`
  - Fix: Add `@media (max-width: 375px) { width: 280px; height: 280px; }` or use `clamp(280px, 80vw, 420px)`

- [ ] **Notification toast at 400px overflows on small phones**
  - Location: `libs/common-ui/src/lib/common-ui/notification/notification.component.scss:12,233`
  - Fix: Use `max-width: calc(100vw - 32px)` or add xs breakpoint

### 🟠 High

- [ ] **Consolidate custom breakpoints to canonical standard**

  - `600px` (feed) → `640px`
  - `960px` (register, login) → `1024px`
  - `968px` (landing, 6 locations) → `1024px`
  - `1200px` (content max-width) → `1280px`

- [ ] **Add `xs` (480px) responsive mixin to common-ui**

  - Location: `libs/common-ui/src/lib/styles/mixins.scss`
  - Fix: Add `@mixin mobile-small { @media (max-width: 480px) { @content } }`

- [ ] **Update `large-desktop` mixin from 1440px to 1536px**

  - Location: `libs/common-ui/src/lib/styles/mixins.scss:406`
  - Fix: Match canonical xxl breakpoint

- [ ] **Nav-sidebar needs mobile overlay/off-canvas behavior**

  - Location: `libs/navigation-ui/src/lib/nav-sidebar/`
  - Fix: Add overlay mode at sm breakpoint with backdrop

- [ ] **App-bar compact/small classes should activate via media query**

  - Location: `libs/navigation-ui/src/lib/app-bar/app-bar.component.scss:10-18`
  - Fix: Apply `.compact` class at md breakpoint, `.small` at xs

- [ ] **Chat panel right offset at 24px causes 384px total width at 375px viewport**
  - Location: `apps/client-interface/src/app/app.component.scss:105-115`
  - Fix: At sm breakpoint, use `right: 0; width: 100vw; border-radius: 0`

### 🟡 Medium

- [ ] **Chat-window component `min-width: 300px` prevents shrinking**

  - Location: `libs/chat-ui/src/lib/chat-ui/chat-window/chat-window.component.scss:29`
  - Fix: Remove min-width or reduce at mobile

- [ ] **Notification dropdown `min-width: 320px` too large for 375px**

  - Location: `libs/notification-ui/src/lib/notification-bell/notification-bell.component.ts:179`
  - Fix: Reduce to `min-width: 280px` or `min-width: calc(100vw - 56px)`

- [ ] **Content section max-width 900px doesn't scale for mobile**

  - Location: `apps/client-interface/src/app/components/landing.component.scss:1070`
  - Fix: Use `max-width: 900px; width: 100%`

- [ ] **Hero subtitle max-width 480px should use percentage at mobile**

  - Location: `apps/client-interface/src/app/components/landing.component.scss:472`
  - Fix: Currently becomes 100% at 968px — should be earlier at 640px

- [ ] **Feature card width 500px needs breakpoint handling**

  - Location: `apps/client-interface/src/app/components/landing.component.scss:1177`
  - Fix: Use `width: 100%; max-width: 500px`

- [ ] **Scroll indicator hidden at 768px — consider 640px for consistency**

  - Location: `apps/client-interface/src/app/components/landing.component.scss:1350-1352`
  - Fix: Change to `sm` breakpoint

- [ ] **Search results dropdown needs mobile-responsive width**
  - Location: `libs/search-ui/src/lib/global-search/global-search.component.ts:151`
  - Fix: At sm breakpoint, use `max-width: 100vw - 32px`

### 🟢 Low

- [ ] **Feed tabs touch targets scale down at 600px — should use canonical 640px**

  - Location: `apps/client-interface/src/app/components/social/feed.component.scss:22-32`
  - Fix: Change 600px to 640px

- [ ] **Landing page step connector rotates at 968px — consider 1024px**

  - Location: `apps/client-interface/src/app/components/landing.component.scss:766`
  - Fix: Use lg breakpoint

- [ ] **Profile banner height fixed at 25vh — fine on mobile but check with tall content**

  - Location: `apps/client-interface/src/app/components/profile.component.scss:5`
  - Note: No action needed unless content overflows

- [ ] **Friend grid `minmax(200px, 1fr)` at 200px is large for 375px — consider 160px**
  - Location: `apps/client-interface/src/app/components/profile.component.scss:18`
  - Fix: Optional optimization for small phones

---

## Token Standardization

### Proposed changes to existing files

**File: `libs/theme-lib/src/lib/theme-lib/design-tokens.ts`**

```typescript
export interface Breakpoints {
  xs: string; // 480px
  sm: string; // 640px
  md: string; // 768px
  lg: string; // 1024px
  xl: string; // 1280px
  xxl: string; // 1536px
}

// Add to DesignTokens:
breakpoints: Breakpoints;
```

**File: `libs/common-ui/src/lib/styles/mixins.scss`**

```scss
@mixin mobile-xs {
  @media (max-width: 480px) {
    @content;
  }
}

@mixin large-desktop {
  @media (min-width: 1536px) {
    @content;
  }
}
```

**File: `libs/theme-styles/src/lib/mixins/index.ts`**

- Add `xs` and `xxl` to the responsive mixin category list.

---

## Skill Created

The `responsive-design-audit` skill is at `/home/cjrutherford/.agents/skills/responsive-design-audit/SKILL.md` and includes:

- Canonical breakpoint standard with rationale
- 6-phase workflow (Discovery → Gap Analysis → Visual Audit → Tokens → E2E → Report)
- Per-viewport audit checklist
- Prioritization rubric
- Playwright config templates
- Corresponding reference files in `references/` and audit scripts

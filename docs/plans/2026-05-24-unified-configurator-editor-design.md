# Unified Configurator Editor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Converge the business configurator and owner-console configurator on one preview-first, schema-driven page editor with a unified design system.

**Architecture:** Keep one canonical config document runtime and make guided/studio presentation modes over the same document. Drive block editing from shared schema metadata in `app-config-models`, keep the rendered page as the primary editing surface, and route theme mode, primary color, and personality through `theme-lib`.

**Tech Stack:** Angular standalone components, Nx, Jest, `@optimistic-tanuki/app-config-models`, `@optimistic-tanuki/theme-lib`, `@optimistic-tanuki/form-ui`

---

### Phase 1: Shared Schema Spine

**Files:**

- Modify: `libs/app-config-models/src/lib/theme-config.model.ts`
- Modify: `libs/app-config-models/src/lib/app-configuration.model.ts`
- Test: `libs/app-config-models/src/lib/config-document.model.spec.ts`

**Outcome:**

- Explicit `theme.mode` and `theme.personalityId` in the shared app-config theme model.
- Shared landing-page block definitions with field schema, labels, placeholders, and select options.
- Tests proving block metadata and theme fields survive document conversion.

### Phase 2: Owner-Console First-Class Editor

**Files:**

- Modify: `apps/owner-console/src/app/components/app-config-designer/app-config-designer.component.ts`
- Modify: `apps/owner-console/src/app/components/app-config-designer/app-config-designer.component.html`
- Modify: `apps/owner-console/src/app/components/app-config-designer/app-config-designer.component.scss`
- Test: `apps/owner-console/src/app/components/app-config-designer/app-config-designer.component.spec.ts`

**Outcome:**

- Replace ad hoc inspector logic with schema-driven field rendering.
- Replace raw inspector controls with `form-ui` components.
- Promote theme editing into a unified design-system panel with explicit mode and personality.
- Drive `ThemeService` from explicit draft theme values instead of inferring from background color.

### Phase 3: Shared Inspector + Tree Runtime

**Files:**

- Create: `libs/config-editor-ui/src/...`
- Modify: `apps/owner-console/...`
- Modify: `libs/business-portal-ui/src/lib/business-site-editor-page.component.ts`

**Outcome:**

- Extract block tree, schema inspector, and design-system panels into shared editor UI primitives.
- Keep business and app-config surfaces on the same runtime with different block catalogs.
- Add preview overlays for selection, hover, insert-above/below, and device-width switching.

### Phase 4: Business Configurator Convergence

**Files:**

- Modify: `libs/business-portal-ui/src/lib/business-site-editor-page.component.ts`
- Modify: `libs/business-data-access/...`
- Test: `libs/business-portal-ui/...spec.ts`

**Outcome:**

- Move business section editing off the long-form bespoke controls and onto the same schema-driven inspector model.
- Preserve business-specific sections and media tools while sharing layout/design primitives with owner-console.

### Phase 5: Dark Mode and Visual Parity

**Files:**

- Modify: configurator SCSS and shared editor UI styles
- Test: targeted component tests where useful

**Outcome:**

- Remove light-only hardcoded backgrounds, shadows, and accent treatments.
- Ensure editor chrome, modals, preview shell, and form controls read correctly in dark mode.
- Standardize CSS variable use so light and dark produce the same level of polish.

### Verification

Run:

- `pnpm exec jest libs/app-config-models/src/lib/config-document.model.spec.ts -c libs/app-config-models/jest.config.ts --runInBand`
- `pnpm exec jest apps/owner-console/src/app/components/app-config-designer/app-config-designer.component.spec.ts -c apps/owner-console/jest.config.ts --runInBand`
- `pnpm nx test app-config-models --runInBand --outputStyle=static`
- `pnpm nx test owner-console --runInBand --outputStyle=static`
- `pnpm exec tsc -p apps/owner-console/tsconfig.app.json --noEmit`

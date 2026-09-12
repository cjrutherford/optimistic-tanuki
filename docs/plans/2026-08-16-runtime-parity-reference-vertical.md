# Runtime Parity Reference Vertical Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make business-site the reference configurable runtime whose owner preview and published page visibly handle every registered landing section, including unsupported persisted content.

**Architecture:** Keep the existing `BusinessLandingPageComponent` as the shared owner-preview and public renderer; it already receives a draft through the owner store and published configuration through the public route. Add a small, pure business-presence runtime capability contract so the block catalog, adapter, and renderer coverage can be checked together. The feature shell continues to describe public and owner placements, while business-site retains its fixed public, owner, booking, and client routes.

**Tech Stack:** Angular standalone components and signals, typed business configuration, Nx/Jest, SSR business-site routes.

---

### Task 1: Define the business presence runtime capability contract

**Files:**

- Create: `libs/business-presence-feature/src/lib/business-presence-runtime.ts`
- Modify: `libs/business-presence-feature/src/index.ts`
- Test: `libs/business-presence-feature/src/lib/business-presence-runtime.spec.ts`

**Step 1: Write the failing test**

Assert that every key in `BUSINESS_LANDING_PAGE_BLOCK_DEFINITIONS` is reported as supported by the business presence runtime, and that an arbitrary persisted type is unsupported.

**Step 2: Run the focused test to verify it fails**

Run: `NX_DAEMON=false NX_ISOLATE_PLUGINS=false NX_SKIP_NX_CACHE=true pnpm exec nx run business-presence-feature:test --runInBand --testPathPattern=business-presence-runtime.spec.ts`

Expected: failure because the runtime capability contract does not exist.

**Step 3: Write the minimal implementation**

Export a readonly set or `supportsBusinessPresenceSection(type: string): boolean` based on the ten renderer-supported business landing types. Keep this contract pure; it must not import Angular components, data stores, or routes.

**Step 4: Run the focused test to verify it passes**

Run the same Nx target and confirm the capability map exactly covers the catalog.

### Task 2: Make the business document adapter reject unsupported blocks safely

**Files:**

- Modify: `libs/business-presence-feature/src/lib/business-presence-document-adapter.ts`
- Modify: `libs/business-presence-feature/src/lib/business-presence-document-adapter.spec.ts`

**Step 1: Write the failing test**

Create a shared `ConfigDocument` containing a valid block and an unsupported block. Assert conversion back to `BusinessSiteConfig` retains only the supported block, maintains normalized order, and does not cast the unsupported type into the business domain model.

**Step 2: Run the focused test to verify it fails**

Run: `NX_DAEMON=false NX_ISOLATE_PLUGINS=false NX_SKIP_NX_CACHE=true pnpm exec nx run business-presence-feature:test --runInBand --testPathPattern=business-presence-document-adapter.spec.ts`

Expected: failure because the adapter currently casts `block.type` directly.

**Step 3: Write the minimal implementation**

Filter unsupported blocks using the runtime capability function before conversion. Do not change valid block data, business defaults, or persisted business configuration shape.

**Step 4: Run the focused test to verify it passes**

Run the same Nx target and confirm the existing round-trip/default tests remain green.

### Task 3: Render a visible fallback for unsupported persisted business sections

**Files:**

- Modify: `libs/business-public-ui/src/lib/business-landing-page.component.ts`
- Modify: `libs/business-public-ui/src/lib/business-landing-page.component.spec.ts`

**Step 1: Write the failing test**

Inject an enabled, otherwise-valid section with an unsupported type into a business config. Assert the public component renders a non-interactive `Unsupported section` fallback with `data-block-type` set to that type, rather than silently producing an empty section.

**Step 2: Run the focused test to verify it fails**

Run: `NX_DAEMON=false NX_ISOLATE_PLUGINS=false NX_SKIP_NX_CACHE=true pnpm exec nx run business-public-ui:test --runInBand --testPathPattern=business-landing-page.component.spec.ts`

Expected: failure because the template has no default switch branch.

**Step 3: Write the minimal implementation**

Add a presentational default branch inside the existing landing section switch. It must be safe for SSR, expose no draft data, and appear identically when the owner preview supplies the same section.

**Step 4: Run the focused test to verify it passes**

Run the same Nx target and confirm existing section rendering behavior remains unchanged.

### Task 4: Prove preview/public renderer parity without adding a second renderer

**Files:**

- Modify: `libs/business-portal-ui/src/lib/business-site-editor-page.component.spec.ts`
- Modify: `libs/business-public-ui/src/lib/business-landing-page.component.spec.ts`

**Step 1: Write the failing parity tests**

Use one fixture containing `hero`, `custom`, `image`, and `gallery` sections. Assert the owner editor preview embeds `BusinessLandingPageComponent`; assert the public renderer exposes matching section identities and the same unsupported-section fallback for equivalent input.

**Step 2: Run the focused tests to verify failure or identify pre-existing parity**

Run each targeted Nx test. If the existing shared component proves the valid-section half already, retain that evidence and add only the missing unsupported-section assertion.

**Step 3: Make only the minimal wiring change, if needed**

Do not create a generic business preview renderer. The editor must continue to use `BusinessLandingPageComponent`; adjust testable inputs or stable data attributes only when required for parity proof.

**Step 4: Run both focused test targets**

Confirm preview and public assertions are green without altering owner or public route ownership.

### Task 5: Verify fixed entry points, SSR safety, and tracker closeout

**Files:**

- Test: `apps/business-site/src/app/app.routes.spec.ts`
- Modify: `docs/reports/configurable-platform-program/index.html`

1. Run the feature, public renderer, owner editor, and business-site route test targets through Nx with `NX_DAEMON=false`, `NX_ISOLATE_PLUGINS=false`, and `NX_SKIP_NX_CACHE=true`.
2. Confirm the public `/sites/:siteSlug` route remains a live SSR route, while owner/client routes remain client-rendered and independently guarded.
3. Run `git diff --check`.
4. Update Slice 5 with test evidence, residual generic-app work, and score state. Mark it complete only when catalog coverage, unknown-section visibility, adapter safety, and preview/public parity are demonstrated.

## Explicitly deferred

- Replacing the generic configurable-client renderer’s six-type switch with this business contract.
- Dynamic manifest-to-route generation; fixed public/owner/booking/client entry points remain intentional.
- A visual redesign of supported sections or rich-content component fallback behavior.
- E2E publish/reload proof, which belongs with the next publish/audit trust slice unless an existing focused flow can cover it cheaply.

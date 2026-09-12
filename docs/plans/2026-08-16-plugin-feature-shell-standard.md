# Plugin Feature-Shell Standard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Establish a reusable, manifest-aware frontend feature-shell contract and prove it by routing the existing business-site public presence and owner editor through a lazy business plugin shell.

**Architecture:** `configurable-plugin-contracts` owns serializable shell metadata, capability matching, and host-safe component loaders. `business-presence-feature` owns only business-site presence registration and lazy references to existing editor/public UI; it does not own business records, persistence, booking, portals, finance, or workspace identity. The business-site app consumes the public feature API, preserving its current URLs and guards.

**Tech Stack:** Angular standalone routes/components, TypeScript, Nx module boundaries, Jest, `@optimistic-tanuki/app-config-models`.

---

### Task 1: Create shared feature-shell contracts

**Files:**

- Create: `libs/configurable-plugin-contracts/src/lib/configurable-feature-shell.ts`
- Create: `libs/configurable-plugin-contracts/src/lib/configurable-feature-shell.spec.ts`
- Create: `libs/configurable-plugin-contracts/src/index.ts`
- Create: `libs/configurable-plugin-contracts/project.json`, Jest/TypeScript support files
- Modify: `tsconfig.base.json`

**Step 1: Write failing tests**

Prove that a shell resolves only its enabled capability routes and that an unknown capability does not resolve. Keep route IDs, placement, and loader opaque to the shared contract.

**Step 2: Verify RED**

Run: `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm exec nx run configurable-plugin-contracts:test --runInBand`

Expected: failure because the contract library does not exist.

**Step 3: Implement the minimal contract**

Define `ConfigurableFeatureShell`, `ConfigurableFeatureRoute`, placement (`public` / `owner` / `client`), and `resolveEnabledFeatureRoutes(shell, manifest)`. A shell route is present only when its manifest capability is enabled. Do not depend on business types.

**Step 4: Verify GREEN**

Run the Task 1 test target; all tests pass.

### Task 2: Allow an intentional feature-shell-to-UI boundary

**Files:**

- Modify: `eslint.config.mjs`

**Step 1: Add a focused boundary test/check**

Use lint of the new reference feature project to demonstrate that `type:feature` can consume shared and scoped UI entry points while data-access/domain constraints remain unchanged.

**Step 2: Implement only the required constraint adjustment**

Add `type:ui` to the allowed dependencies for `type:feature`. Do not weaken any scope constraints.

**Step 3: Verify**

Run the feature-project lint target.

### Task 3: Add the Business Site Presence reference shell

**Files:**

- Create: `libs/business-presence-feature/src/lib/business-site-presence.feature.ts`
- Create: `libs/business-presence-feature/src/lib/business-site-presence.feature.spec.ts`
- Create: `libs/business-presence-feature/src/index.ts`
- Create: `libs/business-presence-feature/project.json`, Jest/TypeScript support files
- Modify: `tsconfig.base.json`

**Step 1: Write failing tests**

Assert the shell declares business-site presence with `business-site.presence` and exposes the existing public landing and owner editor as lazy route loaders. Assert routes resolve when the capability is enabled and do not resolve when disabled.

**Step 2: Verify RED**

Run: `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm exec nx run business-presence-feature:test --runInBand`

**Step 3: Implement the reference shell**

Export a typed `BUSINESS_SITE_PRESENCE_FEATURE` and helpers for public and owner route definitions. The loaders import only public API symbols from `business-public-ui` and `business-portal-ui`. Preserve direct product routes: booking, client portal, finance, commerce, and moderation are not registered here.

**Step 4: Verify GREEN**

Run the feature test target and lint.

### Task 4: Route the business host through the shell

**Files:**

- Modify: `apps/business-site/src/app/app.routes.ts`
- Modify: `apps/business-site/src/app/app.routes.spec.ts`

**Step 1: Write failing route assertions**

Assert the hosted public route and owner `site` route retain their URLs but obtain components through the business presence shell, while booking/client/finance routes remain unchanged.

**Step 2: Verify RED**

Run: `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm exec nx run business-site:test --testFile=apps/business-site/src/app/app.routes.spec.ts --runInBand`

**Step 3: Implement minimal host wiring**

Replace only the two selected inline loaders with shell-provided route helpers. Retain the existing owner guard and all route paths.

**Step 4: Verify GREEN**

Run focused and full business-site tests, then build the shared contract, feature, and business-site projects.

### Task 5: Update the tracker and review

**Files:**

- Modify: `docs/reports/configurable-platform-program/index.html`

Record active/complete status and evidence. Run a Luna spec review followed by a code-quality/adversarial review. Do not mark Slice 1 complete unless its focused tests, host build, and live tracker delivery pass.

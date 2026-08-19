# Business-site Reference Plugin Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make business-site the first complete manifest-aware reference plugin without moving product data or route ownership into the configurator.

**Architecture:** `business-presence-feature` owns the manifest-facing shell and business landing block catalog. `business-data-access` remains transport, authentication, persisted business configuration, and business domain types. `business-site` keeps its independent public, owner, booking, and client entry points, but resolves the presence capability through the feature shell.

**Tech Stack:** Angular standalone routes, typed configurable manifests, Nx/Jest.

---

### Task 1: Move the business editor catalog behind the feature package

**Files:**

- Create: `libs/business-presence-feature/src/lib/business-presence-block-catalog.ts`
- Modify: `libs/business-presence-feature/src/index.ts`
- Modify: `libs/business-data-access/src/index.ts`
- Modify: `libs/business-portal-ui/src/lib/business-site-editor-page.component.ts`
- Test: `libs/business-presence-feature/src/lib/business-presence-feature.spec.ts`
- Test: `libs/business-portal-ui/src/lib/business-site-editor-page.component.spec.ts`

1. Write a failing shell/catalog test proving the business catalog is exported from the feature package.
2. Run the focused feature test and confirm it is red.
3. Move the catalog without changing the business section model or renderer behavior.
4. Update the editor to consume the feature-owned catalog, not data access.
5. Run the focused feature and editor tests.

### Task 2: Resolve runtime routes through the presence shell

**Files:**

- Modify: `apps/business-site/src/app/app.routes.ts`
- Test: `apps/business-site/src/app/app.routes.spec.ts`

1. Write a failing route test that the public site and owner editor each match an enabled shell route.
2. Keep their existing URLs, guards, and lazy component ownership.
3. Add manifest-aware route metadata/resolution at the app boundary only.
4. Run the business-site route suite.

### Task 3: Verify and update the program tracker

**Files:**

- Modify: `docs/reports/configurable-platform-program/index.html`

1. Run the feature, editor, and business-site test targets through Nx.
2. Run the business-site build if the local Nx runner returns a final completion status; otherwise record the exact verification limitation.
3. Run `git diff --check`.
4. Mark Slice 4 complete only when the catalog is outside data access and the public/owner shell routes remain independently operational.

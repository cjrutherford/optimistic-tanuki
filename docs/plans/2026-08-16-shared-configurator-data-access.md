# Shared Configurator Editor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract the reusable configurator canvas, schema inspector, and rendered-preview workspace while retaining owner-scoped persistence at the application boundary.

**Architecture:** Keep `AppConfigDesignerComponent` responsible for configuration lifecycle and release policy. Move the coordinated visual workspace—block tree, schema inspector, responsive preview bridge, and mobile editor sheet—into `configurable-client-ui`, driven entirely by typed inputs and intent outputs. The owner-scoped client methods are a prerequisite only; they do not redefine this editor slice.

**Tech Stack:** Angular signals, RxJS, Jest, Nx, Nest gateway contracts.

---

### Task 1: Owner API client prerequisite

**Files:**

- Modify: `libs/app-config-data-access/src/lib/app-config-data-access.ts`
- Modify: `libs/app-config-data-access/src/lib/app-config.store.ts`
- Test: `libs/app-config-data-access/src/lib/app-config-data-access.spec.ts`
- Test: `libs/app-config-data-access/src/lib/app-config.store.spec.ts`

1. Add a failing test for the owner-only publish endpoint.
2. Run `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm exec nx run app-config-data-access:test --runInBand`; confirm red.
3. Add typed owner-only API methods. The gateway derives ownership from the session, so the client never provides tenant identifiers.
4. Re-run the library test target; confirm green.

### Task 2: Shared editor workspace

**Files:**

- Create: `libs/configurable-client-ui/src/lib/configurator-editor-workspace.component.ts`
- Modify: `libs/configurable-client-ui/src/index.ts`
- Modify: `apps/owner-console/src/app/components/app-config-designer/app-config-designer.component.ts`
- Modify: `apps/owner-console/src/app/components/app-config-designer/app-config-designer.component.html`
- Test: `libs/configurable-client-ui/src/lib/configurator-editor-workspace.component.spec.ts`
- Test: `apps/owner-console/src/app/components/app-config-designer/app-config-designer.component.spec.ts`

1. Add a failing shared-workspace test for preview selection and responsive inspector access.
2. Extract the canvas, schema inspector, rendered preview, and mobile sheet into the shared component. It receives the current typed configuration and emits intent only; it does not save, publish, or own tenant context.
3. Replace the duplicated Owner Console markup with the shared shell and keep the designer as the adapter from shell events to workspace commands.
4. Run the shared UI and Owner Console test targets and fix regressions.

### Task 3: Evidence and tracker

**Files:**

- Modify: `docs/reports/configurable-platform-program/index.html`

1. Record the scoped prerequisite as complete and Slice 3 as active; complete the slice only after shell extraction, owner adoption, and verification.
2. Run focused library and app verification plus `git diff --check` before reporting completion.

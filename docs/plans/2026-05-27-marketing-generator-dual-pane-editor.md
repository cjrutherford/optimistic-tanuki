# Marketing Generator Dual-Pane Editor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn the `marketing-generator` results experience into a preview-first dual-pane editor with high-fidelity mock rendering for web, email, social, and material outputs, while also documenting platform email setup clearly.

**Architecture:** Keep the existing generation, workspace, version, feedback, and telemetry models as the source of truth. Add a render-model layer inside the results page that maps channel outputs and material surfaces into editor surfaces and clickable preview regions. Rework the results page into a stable shell with a utility rail, a large preview workspace, and a contextual inspector instead of text-first cards and stacked textareas.

**Tech Stack:** Angular standalone components, signals/computed/effect, Jest, Nx, markdown docs, existing `MarketingGeneratorService`, `MarketingStateService`, and `MarketingInsightsService`.

---

### Task 1: Document Platform Email Setup

**Files:**

- Modify: `docs/guides/email-providers.md`
- Modify: `docs/README.md`

**Step 1: Update the guide**

Document:

- what the email system is in this repo
- how to choose between console, SMTP, and HTTP API providers
- how to configure local development email
- how to wire provider selection into NestJS modules
- what environment variables are expected
- how to verify provider connectivity

**Step 2: Add discoverability**

Make sure `docs/README.md` still points contributors to the email setup guide as the canonical platform email setup reference.

**Step 3: Verify docs generation**

Run the docs manifest build through `ui-playground` after edits.

### Task 2: Add Failing Tests For The Dual-Pane Editor Shell

**Files:**

- Modify: `apps/marketing-generator/src/app/pages/results-page.component.spec.ts`

**Step 1: Write the failing test**

Add a test that expects the results page to render:

- a `Preview workspace` section
- an `Inspector` section
- output switching UI for all output types
- a preview-first flow where editable content is selected from the preview surface

**Step 2: Run test to verify it fails**

Run only the targeted spec and confirm the failure is because the new editor shell does not exist yet.

### Task 3: Build The Render-Model Layer

**Files:**

- Modify: `apps/marketing-generator/src/app/pages/results-page.component.ts`

**Step 1: Add editor surface mapping**

Map the selected concept into editor surfaces:

- web landing page
- email draft
- social draft
- each material surface

Each surface should expose:

- id
- label
- type
- region list
- underlying output/material identifiers

**Step 2: Add preview-region mapping**

Map existing blocks/text blocks into clickable preview regions with:

- region id
- region label
- current value
- block role

**Step 3: Keep source-of-truth writes local**

Inspector edits must still write back through the existing channel/material update paths so workspace persistence and telemetry keep working.

### Task 4: Replace The Results Layout With A Dual-Pane Editor

**Files:**

- Modify: `apps/marketing-generator/src/app/pages/results-page.component.ts`

**Step 1: Rework page structure**

Introduce:

- compressed top utility rail for workspace/version/compare/export/provenance
- output switcher above the editor
- left preview workspace
- right inspector pane

**Step 2: Preserve existing workflow utilities**

Do not remove:

- concept selection
- compare/winner flow
- workspace controls
- export actions
- telemetry/feedback affordances

Move or compress them so they support the editor instead of dominating the page.

### Task 5: Build High-Fidelity Mock Rendering For All Output Types

**Files:**

- Modify: `apps/marketing-generator/src/app/pages/results-page.component.ts`
- Reuse or adapt: `apps/marketing-generator/src/app/components/material-template-preview.component.ts`

**Step 1: Web preview**

Render a full landing-page style surface with section hierarchy, proof bands, CTA treatment, and visible structure.

**Step 2: Email preview**

Render a framed email view with subject, preview line, body hierarchy, CTA, and message chrome.

**Step 3: Social preview**

Render a campaign/post-style preview that feels like a platform post, not a text dump.

**Step 4: Material preview**

Render a larger artboard-oriented asset surface so material editing feels like a page, not a small card.

### Task 6: Build The Inspector

**Files:**

- Modify: `apps/marketing-generator/src/app/pages/results-page.component.ts`

**Step 1: Selected region state**

Track selected surface and selected region. Default to the first region on surface change.

**Step 2: Inspector controls**

Show:

- region label
- editable value field
- regenerate action
- copy/download actions for the active surface
- feedback summary where appropriate

**Step 3: Keep preview primary**

The preview must remain the main focus. The inspector should respond to preview selection, not replace it.

### Task 7: Verification

**Files:**

- Test: `apps/marketing-generator/src/app/pages/results-page.component.spec.ts`

**Step 1: Run focused Jest coverage**

Run targeted `results-page` tests first until green.

**Step 2: Run sequential Nx verification**

Run:

```bash
env NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm exec nx reset
env NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm exec nx run ui-playground:docs-content
env NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm exec nx test marketing-generator --runInBand
env NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm exec nx build marketing-generator --configuration=development --outputStyle=static
env NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm exec nx build ui-playground --configuration=development --outputStyle=static
```

Expected:

- docs manifest generation passes
- marketing-generator tests pass
- marketing-generator build passes
- ui-playground build passes

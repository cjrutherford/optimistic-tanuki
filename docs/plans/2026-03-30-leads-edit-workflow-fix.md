# Leads Edit Workflow Fix Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the lead edit workflow operational in `leads-app` so users can open an existing lead, modify its fields, save the changes through the gateway to `lead-tracker`, and see the UI update correctly.

**Architecture:** Reuse the existing `PATCH /api/leads/:id` path already exposed by the gateway and `lead-tracker`. Add an edit mode to the existing lead form UX in `LeadsComponent` instead of inventing a separate page. Keep create and edit flows in one shared form state with explicit mode switching and focused component tests.

**Tech Stack:** Angular standalone app, template-driven forms, NestJS gateway, lead-tracker microservice, Jest, Angular testing utilities.

## Root Cause

The update path already exists end to end:

- `apps/leads-app/src/app/leads.service.ts` has `updateLead()`
- `apps/gateway/src/controllers/leads/leads.controller.ts` exposes `PATCH /api/leads/:id`
- `apps/lead-tracker/src/app/leads.controller.ts` and `apps/lead-tracker/src/app/leads.service.ts` handle updates

The workflow is broken in the frontend:

- `apps/leads-app/src/app/leads.component.ts` defines `editLead(lead)` as `console.log(...)`
- `apps/leads-app/src/app/leads.component.html` renders edit buttons in list and kanban views, but there is no edit modal/panel state, no populated form, and no save path
- there is no `LeadsComponent` spec covering edit behavior today

---

### Task 1: Add component-level test coverage for create/edit workflow state

**Files:**
- Create: `apps/leads-app/src/app/leads.component.spec.ts`
- Test: `apps/leads-app/src/app/leads.component.spec.ts`

**Step 1: Write the failing test**

Add tests for:

- loading leads into the component
- opening quick add from query param
- clicking edit populates the lead form with the selected lead
- edit mode changes the panel title and submit CTA
- saving in edit mode calls `LeadsService.updateLead()` with the correct lead id and dto
- successful save resets form state and reloads leads/stats
- canceling edit restores create mode

Example:

```typescript
it('loads a selected lead into the form when edit is clicked', () => {
  component.editLead(existingLead);

  expect(component.isEditingLead).toBe(true);
  expect(component.editingLeadId).toBe(existingLead.id);
  expect(component.newLead.name).toBe(existingLead.name);
  expect(component.newLead.company).toBe(existingLead.company);
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest apps/leads-app/src/app/leads.component.spec.ts --runInBand`
Expected: FAIL because `LeadsComponent` has no edit state or edit submit behavior.

**Step 3: Write minimal implementation**

No production code yet. Just confirm the missing behavior through tests.

**Step 4: Run test to verify it fails for the right reason**

Run: `npx jest apps/leads-app/src/app/leads.component.spec.ts --runInBand`
Expected: FAIL specifically on edit-mode expectations, not test setup.

**Step 5: Commit**

```bash
git add apps/leads-app/src/app/leads.component.spec.ts
git commit -m "test: add failing leads edit workflow specs"
```

### Task 2: Refactor `LeadsComponent` form state to support both create and edit modes

**Files:**
- Modify: `apps/leads-app/src/app/leads.component.ts`
- Test: `apps/leads-app/src/app/leads.component.spec.ts`

**Step 1: Write the failing test**

Add tests covering explicit mode transitions:

- default mode is create
- `editLead()` enters edit mode
- `closeQuickAdd()` exits edit mode and clears `editingLeadId`
- switching from edit back to create resets stale values

**Step 2: Run test to verify it fails**

Run: `npx jest apps/leads-app/src/app/leads.component.spec.ts --runInBand`
Expected: FAIL because the component does not track edit state separately from quick add.

**Step 3: Write minimal implementation**

Add component state such as:

```typescript
isEditingLead = false;
editingLeadId: string | null = null;
```

Refactor form helpers:

- `openCreateLeadPanel()`
- `editLead(lead: Lead)`
- `resetLeadForm()`
- `closeQuickAdd()`

Use one normalized form object for both modes.

**Step 4: Run test to verify it passes**

Run: `npx jest apps/leads-app/src/app/leads.component.spec.ts --runInBand`
Expected: PASS for state transitions.

**Step 5: Commit**

```bash
git add apps/leads-app/src/app/leads.component.ts apps/leads-app/src/app/leads.component.spec.ts
git commit -m "feat: add lead edit mode state to leads component"
```

### Task 3: Wire the panel submit action to `createLead()` or `updateLead()` based on mode

**Files:**
- Modify: `apps/leads-app/src/app/leads.component.ts`
- Modify: `apps/leads-app/src/app/leads.service.spec.ts`
- Test: `apps/leads-app/src/app/leads.component.spec.ts`
- Test: `apps/leads-app/src/app/leads.service.spec.ts`

**Step 1: Write the failing test**

Add tests asserting:

- create mode still calls `createLead()`
- edit mode calls `updateLead(editingLeadId, dto)`
- the outgoing DTO excludes read-only fields like `id`, `createdAt`, `updatedAt`, `flags`
- status/value/source edits are preserved in the payload

Example:

```typescript
it('submits an update when the form is in edit mode', () => {
  component.editLead(existingLead);
  component.newLead.status = LeadStatus.CONTACTED;

  component.saveLead();

  expect(leadsServiceStub.updateLead).toHaveBeenCalledWith(existingLead.id, {
    name: existingLead.name,
    company: existingLead.company,
    email: existingLead.email,
    phone: existingLead.phone,
    source: existingLead.source,
    status: LeadStatus.CONTACTED,
    value: existingLead.value,
    notes: existingLead.notes,
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest apps/leads-app/src/app/leads.component.spec.ts --runInBand`
Expected: FAIL because there is no save branching for edit mode.

**Step 3: Write minimal implementation**

Replace `createLead()` as the form submit entry point with a shared save method, for example:

- `saveLead()`
- `createLeadFromForm()`
- `updateLeadFromForm()`

Keep DTO shaping in one helper so create and edit do not diverge accidentally.

**Step 4: Run test to verify it passes**

Run:

```bash
npx jest apps/leads-app/src/app/leads.component.spec.ts --runInBand
npx jest apps/leads-app/src/app/leads.service.spec.ts --runInBand
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/leads-app/src/app/leads.component.ts apps/leads-app/src/app/leads.component.spec.ts apps/leads-app/src/app/leads.service.spec.ts
git commit -m "feat: wire leads panel save action to create and update flows"
```

### Task 4: Update the template so edit mode is visible and understandable

**Files:**
- Modify: `apps/leads-app/src/app/leads.component.html`
- Modify: `apps/leads-app/src/app/leads.component.scss`
- Test: `apps/leads-app/src/app/leads.component.spec.ts`

**Step 1: Write the failing test**

Add DOM-level tests for:

- panel heading switches from `Quick Add Lead` to `Edit Lead`
- submit button label switches from `Create Lead` to `Save Changes`
- a small mode badge or helper text appears in edit mode
- the edit button in list and kanban views opens the panel

**Step 2: Run test to verify it fails**

Run: `npx jest apps/leads-app/src/app/leads.component.spec.ts --runInBand`
Expected: FAIL because the UI does not distinguish create from edit.

**Step 3: Write minimal implementation**

Adjust the existing slide panel rather than introducing a second modal:

- dynamic header
- dynamic CTA label
- optional cancel-edit helper copy
- keep the current layout so this remains a contained change

**Step 4: Run test to verify it passes**

Run: `npx jest apps/leads-app/src/app/leads.component.spec.ts --runInBand`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/leads-app/src/app/leads.component.html apps/leads-app/src/app/leads.component.scss apps/leads-app/src/app/leads.component.spec.ts
git commit -m "feat: surface edit mode in leads panel ui"
```

### Task 5: Expand the lead form to cover the fields users expect to edit

**Files:**
- Modify: `apps/leads-app/src/app/leads.component.html`
- Modify: `apps/leads-app/src/app/leads.component.ts`
- Modify: `apps/leads-app/src/app/leads.component.spec.ts`
- Test: `apps/leads-app/src/app/leads.component.spec.ts`

**Step 1: Write the failing test**

Add tests covering editing of:

- `status`
- `source`
- `company`
- `email`
- `phone`
- `value`
- `notes`
- `nextFollowUp` if the product should support follow-up scheduling from the edit panel

**Step 2: Run test to verify it fails**

Run: `npx jest apps/leads-app/src/app/leads.component.spec.ts --runInBand`
Expected: FAIL for fields that are not currently editable in the panel.

**Step 3: Write minimal implementation**

Add only the missing fields that are already supported by `UpdateLeadDto`.

Recommendation:
- show `status` in the always-visible section for edit mode
- keep secondary fields under the existing “More details” section
- if `nextFollowUp` is included, use a date input and normalize the outbound payload format

**Step 4: Run test to verify it passes**

Run: `npx jest apps/leads-app/src/app/leads.component.spec.ts --runInBand`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/leads-app/src/app/leads.component.ts apps/leads-app/src/app/leads.component.html apps/leads-app/src/app/leads.component.spec.ts
git commit -m "feat: support editing core lead fields from leads panel"
```

### Task 6: Validate the gateway and service contract around lead updates

**Files:**
- Modify: `apps/gateway/src/controllers/leads/leads.controller.spec.ts`
- Modify: `apps/lead-tracker/src/app/leads.controller.spec.ts`
- Modify: `apps/lead-tracker/src/app/leads.service.spec.ts`
- Test: `apps/gateway/src/controllers/leads/leads.controller.spec.ts`
- Test: `apps/lead-tracker/src/app/leads.controller.spec.ts`
- Test: `apps/lead-tracker/src/app/leads.service.spec.ts`

**Step 1: Write the failing test**

Add or tighten tests to ensure:

- gateway `PATCH :id` forwards the DTO correctly
- lead-tracker returns the updated lead shape expected by the frontend
- partial updates preserve untouched fields

**Step 2: Run test to verify it fails**

Run:

```bash
npx jest apps/gateway/src/controllers/leads/leads.controller.spec.ts --runInBand
npx jest apps/lead-tracker/src/app/leads.controller.spec.ts --runInBand
npx jest apps/lead-tracker/src/app/leads.service.spec.ts --runInBand
```

Expected: FAIL only if the current update path does not match the edited payload assumptions.

**Step 3: Write minimal implementation**

Only patch backend behavior if tests demonstrate a real mismatch. Do not change backend contracts speculatively; current evidence suggests the UI is the broken layer.

**Step 4: Run test to verify it passes**

Run the same three commands.
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/gateway/src/controllers/leads/leads.controller.spec.ts apps/lead-tracker/src/app/leads.controller.spec.ts apps/lead-tracker/src/app/leads.service.spec.ts
git commit -m "test: verify lead update contract for edit workflow"
```

### Task 7: Verify the full edit workflow and development build

**Files:**
- Modify: none unless regressions are found
- Test: `apps/leads-app/src/app/leads.component.spec.ts`
- Test: `apps/leads-app/src/app/leads.service.spec.ts`
- Test: `apps/gateway/src/controllers/leads/leads.controller.spec.ts`
- Test: `apps/lead-tracker/src/app/leads.controller.spec.ts`
- Test: `apps/lead-tracker/src/app/leads.service.spec.ts`

**Step 1: Write the failing test**

No new tests. This is integration verification.

**Step 2: Run test to verify it fails**

Run:

```bash
npx jest apps/leads-app/src/app/leads.component.spec.ts --runInBand
npx jest apps/leads-app/src/app/leads.service.spec.ts --runInBand
npx jest apps/gateway/src/controllers/leads/leads.controller.spec.ts --runInBand
npx jest apps/lead-tracker/src/app/leads.controller.spec.ts --runInBand
npx jest apps/lead-tracker/src/app/leads.service.spec.ts --runInBand
npx tsc -p apps/leads-app/tsconfig.app.json --noEmit
npm run build:dev
```

Expected: all edit workflow tests pass and the dev build succeeds.

**Step 3: Write minimal implementation**

Fix only verification failures that directly block the edit workflow.

**Step 4: Run test to verify it passes**

Re-run the same commands until green.

**Step 5: Commit**

```bash
git add .
git commit -m "test: verify operational leads edit workflow"
```

## Notes

- Do not split editing into a separate route unless the current slide-panel interaction proves too constrained.
- Prefer a single shared form state over separate create/edit forms; the current component is already structured around one panel.
- Treat backend changes as conditional. Current evidence indicates the operational gap is frontend-only.

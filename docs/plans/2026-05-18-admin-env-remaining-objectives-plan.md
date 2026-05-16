# Admin Env Remaining Objectives Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete the original deployment-dashboard plan by finishing `admin-env` as a true menu-driven, document-style terminal application for authoring deployment workspaces, with contextual help integrated into every editing surface.

**Architecture:** Keep deployment state, generation, analysis, env backend handling, and workspace persistence in the existing `domain`, `configurator`, `generate`, and `output` packages. Finish the `tview` shell as the authoritative operator interface: top menu bar, section navigator, record lists where appropriate, a single active document editor, explicit focus/navigation semantics, and a contextual help panel or help region tied to the active field or selection. Treat generated deployment workspaces under `dist/admin-env/<deployment>/` as the production source of truth throughout the UI, docs, and apply flows.

**Tech Stack:** Go, `tview`, `tcell`, YAML, existing deployment configurator/generator/output layers, workspace-aware validation scripts.

---

## Current State

The following foundations already exist and should be preserved:

- generated deployment workspaces with `deployment.yaml` as the persistent model
- profile, dependency-analysis, image-binding, env backend, and ArgoCD workspace metadata
- `tview` shell with classic menu labels, mouse support, list/detail editing for `Databases` and `Services`, and anchored popup menus
- global database slots with service-level overrides and readiness analysis
- phased Compose startup metadata and workspace-aware validation/apply scripts

The main gap is no longer the backend model. The remaining work is primarily product-shaping work in the TUI and operator workflow:

- menus still behave like popup commands rather than a full desktop menu system
- several sections are still shallow forms rather than complete deployment documents
- contextual help is not yet first-class
- generation and diagnostics do not yet fully reflect the new database model or eventual `db-setup` flow
- docs still describe too much of the old interaction model

---

### Task 1: Add a contextual help model to the TUI

**Files:**

- Modify: `tools/admin-env-wizard/internal/tui/model.go`
- Modify: `tools/admin-env-wizard/internal/tui/model_test.go`
- Test: `tools/admin-env-wizard/internal/tui/dashboard_test.go`

**Step 1: Write the failing test**

Add tests that assert:

- the shell exposes a help region or help view that updates with the active section
- `Databases` and `Services` surface section-specific help text
- the help text explains inheritance, overrides, and generated-workspace intent

**Step 2: Run test to verify it fails**

Run: `GOCACHE=/tmp/go-build go test ./internal/tui -run 'Test(App|Dashboard).*Help'`
Expected: FAIL because the shell does not yet carry structured contextual help state.

**Step 3: Write minimal implementation**

Add:

- a small help registry keyed by section and optionally by field/control id
- a dedicated help region in the shell
- helper methods to set active help content when section/focus changes

Start with section-level help first. Do not yet over-engineer per-control reflection.

**Step 4: Run test to verify it passes**

Run: `GOCACHE=/tmp/go-build go test ./internal/tui -run 'Test(App|Dashboard).*Help'`
Expected: PASS

**Step 5: Commit**

```bash
git add tools/admin-env-wizard/internal/tui/model.go tools/admin-env-wizard/internal/tui/model_test.go tools/admin-env-wizard/internal/tui/dashboard_test.go
git commit -m "feat: add contextual help model to admin env tui"
```

### Task 2: Turn the top menu bar into a complete desktop-style menu system

**Files:**

- Modify: `tools/admin-env-wizard/internal/tui/model.go`
- Modify: `tools/admin-env-wizard/internal/tui/dashboard_test.go`

**Step 1: Write the failing test**

Add tests that assert:

- the active top-level menu is visually/statefully tracked
- `Left`, `Right`, `Down`, `Enter`, and `Esc` work consistently across menus
- menu selection can open a document or trigger an action without moving through the left navigator

**Step 2: Run test to verify it fails**

Run: `GOCACHE=/tmp/go-build go test ./internal/tui -run 'TestDashboard.*Menu'`
Expected: FAIL because the current menu model is still a light popup wrapper around button clicks.

**Step 3: Write minimal implementation**

Add:

- active menu index/state
- consistent keyboard and mouse routing for top-bar menus
- highlighted menu state in the top bar
- a small menu action dispatcher that is not coupled to button closures

Do not add accelerators that consume normal typing.

**Step 4: Run test to verify it passes**

Run: `GOCACHE=/tmp/go-build go test ./internal/tui -run 'TestDashboard.*Menu'`
Expected: PASS

**Step 5: Commit**

```bash
git add tools/admin-env-wizard/internal/tui/model.go tools/admin-env-wizard/internal/tui/dashboard_test.go
git commit -m "feat: complete desktop-style menu behavior in admin env tui"
```

### Task 3: Deepen the Deployment and Profile documents into full configuration editors

**Files:**

- Modify: `tools/admin-env-wizard/internal/tui/model.go`
- Modify: `tools/admin-env-wizard/internal/tui/dashboard_test.go`
- Check: `tools/admin-env-wizard/internal/domain/environment.go`

**Step 1: Write the failing test**

Add tests that assert:

- `Deployment` edits name, namespace, provider, target surfaces, output intent, and workspace metadata clearly
- `Profile` shows the profile choice plus cold-start/startup implications
- each relevant field updates contextual help

**Step 2: Run test to verify it fails**

Run: `GOCACHE=/tmp/go-build go test ./internal/tui -run 'TestDashboard.*(Deployment|Profile)'`
Expected: FAIL because those documents are still relatively shallow.

**Step 3: Write minimal implementation**

Expand the forms to show:

- workspace identity and target surfaces
- profile semantics, not just the selected value
- read-only generated consequences like startup mode, disabled services, and current profile warnings

Keep generation logic in backend packages; this is an editor surface, not business logic duplication.

**Step 4: Run test to verify it passes**

Run: `GOCACHE=/tmp/go-build go test ./internal/tui -run 'TestDashboard.*(Deployment|Profile)'`
Expected: PASS

**Step 5: Commit**

```bash
git add tools/admin-env-wizard/internal/tui/model.go tools/admin-env-wizard/internal/tui/dashboard_test.go
git commit -m "feat: deepen deployment and profile documents"
```

### Task 4: Complete the Databases document around slot lifecycle and db-setup intent

**Files:**

- Modify: `tools/admin-env-wizard/internal/tui/model.go`
- Modify: `tools/admin-env-wizard/internal/configurator/databases.go`
- Modify: `tools/admin-env-wizard/internal/configurator/databases_test.go`
- Modify: `tools/admin-env-wizard/internal/tui/dashboard_test.go`

**Step 1: Write the failing test**

Add tests that assert:

- slots can be added, selected, and deleted safely
- slot summaries show attached services and `db-setup` readiness
- help text explains managed vs external provisioning and create/migrate/seed flags

**Step 2: Run test to verify it fails**

Run: `GOCACHE=/tmp/go-build go test ./internal/configurator ./internal/tui -run 'Test.*Database'`
Expected: FAIL because slot lifecycle and readiness UX are not complete.

**Step 3: Write minimal implementation**

Add:

- delete/confirm behavior for slots
- warnings when deleting an attached slot
- clearer readiness summaries from `BuildDatabaseReadiness`
- read-only “future db-setup” summary fields in the document

Do not build the actual `db-setup` generator yet; surface readiness and intent only.

**Step 4: Run test to verify it passes**

Run: `GOCACHE=/tmp/go-build go test ./internal/configurator ./internal/tui -run 'Test.*Database'`
Expected: PASS

**Step 5: Commit**

```bash
git add tools/admin-env-wizard/internal/configurator/databases.go tools/admin-env-wizard/internal/configurator/databases_test.go tools/admin-env-wizard/internal/tui/model.go tools/admin-env-wizard/internal/tui/dashboard_test.go
git commit -m "feat: complete database slot document and readiness workflow"
```

### Task 5: Complete the Services document around effective deployment behavior

**Files:**

- Modify: `tools/admin-env-wizard/internal/tui/model.go`
- Modify: `tools/admin-env-wizard/internal/tui/dashboard_test.go`
- Check: `tools/admin-env-wizard/internal/configurator/databases.go`

**Step 1: Write the failing test**

Add tests that assert:

- the service document clearly shows inherited vs overridden database state
- effective image tag, replicas, infra requirements, and startup weight are visible
- help text explains when to override vs inherit

**Step 2: Run test to verify it fails**

Run: `GOCACHE=/tmp/go-build go test ./internal/tui -run 'TestDashboard.*Service'`
Expected: FAIL because the service document is still not a complete effective-configuration view.

**Step 3: Write minimal implementation**

Expand the service document to show:

- effective database binding preview
- required infra summary
- resolved image/tag source
- enabled/disabled implications for lean profiles
- clear override controls with matching help text

Avoid adding free-form fields that are not persisted or consumed.

**Step 4: Run test to verify it passes**

Run: `GOCACHE=/tmp/go-build go test ./internal/tui -run 'TestDashboard.*Service'`
Expected: PASS

**Step 5: Commit**

```bash
git add tools/admin-env-wizard/internal/tui/model.go tools/admin-env-wizard/internal/tui/dashboard_test.go
git commit -m "feat: complete service document editor"
```

### Task 6: Finish Images, Compose, Kubernetes, and Secrets as first-class documents

**Files:**

- Modify: `tools/admin-env-wizard/internal/tui/model.go`
- Modify: `tools/admin-env-wizard/internal/tui/dashboard_test.go`
- Check: `tools/admin-env-wizard/internal/domain/environment.go`

**Step 1: Write the failing test**

Add tests that assert:

- `Images` supports workspace-wide image/tag editing, not just a thin field list
- `Compose` shows startup/apply consequences and phased behavior
- `Kubernetes` shows overlay/app/source-path semantics for ArgoCD
- `Secrets` explains the structured backend and target-specific overrides

**Step 2: Run test to verify it fails**

Run: `GOCACHE=/tmp/go-build go test ./internal/tui -run 'TestDashboard.*(Images|Compose|Kubernetes|Secrets)'`
Expected: FAIL because these documents are still too shallow or rely on operator knowledge outside the UI.

**Step 3: Write minimal implementation**

Add richer document content and help text for each section. In particular:

- `Images`: show source, override, and affected services
- `Compose`: show startup phases, waits, and disabled services
- `Kubernetes`: show generated workspace path, repo URL, revision, and namespace intent
- `Secrets`: explain config vs secret vs target override materialization

**Step 4: Run test to verify it passes**

Run: `GOCACHE=/tmp/go-build go test ./internal/tui -run 'TestDashboard.*(Images|Compose|Kubernetes|Secrets)'`
Expected: PASS

**Step 5: Commit**

```bash
git add tools/admin-env-wizard/internal/tui/model.go tools/admin-env-wizard/internal/tui/dashboard_test.go
git commit -m "feat: complete document editors for image compose kubernetes and secrets"
```

### Task 7: Complete Apply and Diagnostics as operator workflow documents

**Files:**

- Modify: `tools/admin-env-wizard/internal/tui/model.go`
- Modify: `tools/admin-env-wizard/internal/tui/model_test.go`
- Modify: `tools/admin-env-wizard/internal/tui/dashboard_test.go`
- Check: `tools/admin-env-wizard/internal/configurator/deployment.go`

**Step 1: Write the failing test**

Add tests that assert:

- `Apply` shows what actions will happen before the operator executes them
- `Diagnostics` groups warnings by category
- help text explains when to regenerate vs refresh vs materialize

**Step 2: Run test to verify it fails**

Run: `GOCACHE=/tmp/go-build go test ./internal/tui -run 'Test(App|Dashboard).*(Apply|Diagnostics)'`
Expected: FAIL because these sections still function more like command buttons than operator documents.

**Step 3: Write minimal implementation**

Add:

- preview text for save/generate/refresh/materialize/apply intent
- grouped diagnostics for dependency, profile, startup, database, env backend, and ArgoCD concerns
- contextual help text for each apply action
- clearer status/confirmation messaging

**Step 4: Run test to verify it passes**

Run: `GOCACHE=/tmp/go-build go test ./internal/tui -run 'Test(App|Dashboard).*(Apply|Diagnostics)'`
Expected: PASS

**Step 5: Commit**

```bash
git add tools/admin-env-wizard/internal/tui/model.go tools/admin-env-wizard/internal/tui/model_test.go tools/admin-env-wizard/internal/tui/dashboard_test.go
git commit -m "feat: complete apply and diagnostics workflow documents"
```

### Task 8: Feed database slot intent into generation and deployment artifacts

**Files:**

- Modify: `tools/admin-env-wizard/internal/generate/compose.go`
- Modify: `tools/admin-env-wizard/internal/generate/k8s.go`
- Modify: `tools/admin-env-wizard/internal/output/write.go`
- Modify: `tools/admin-env-wizard/internal/configurator/service.go`
- Test: `tools/admin-env-wizard/internal/generate/*_test.go`
- Test: `tools/admin-env-wizard/internal/output/write_test.go`

**Step 1: Write the failing test**

Add tests that assert:

- resolved database slots affect generated Compose/Kubernetes outputs where relevant
- generated artifacts reflect shared slot vs service override intent
- no committed source files are used as the source of truth for this state

**Step 2: Run test to verify it fails**

Run: `GOCACHE=/tmp/go-build go test ./internal/generate ./internal/output`
Expected: FAIL because generation does not yet consume the richer database-slot model.

**Step 3: Write minimal implementation**

Use resolved effective service database bindings during generation. Keep the output conservative:

- no speculative new containers beyond what the current deployment model supports
- no `db-setup` workload generation yet
- enough metadata/output alignment that the workspace documents and generated artifacts agree

**Step 4: Run test to verify it passes**

Run: `GOCACHE=/tmp/go-build go test ./internal/generate ./internal/output`
Expected: PASS

**Step 5: Commit**

```bash
git add tools/admin-env-wizard/internal/generate/compose.go tools/admin-env-wizard/internal/generate/k8s.go tools/admin-env-wizard/internal/output/write.go tools/admin-env-wizard/internal/configurator/service.go tools/admin-env-wizard/internal/generate tools/admin-env-wizard/internal/output/write_test.go
git commit -m "feat: align generated artifacts with database slot model"
```

### Task 9: Add migration-safe operator docs for the desktop workflow

**Files:**

- Modify: `tools/admin-env-wizard/README.md`
- Modify: `docs/devops/deployment-workspace-workflow.md`
- Modify: `docs/devops/deployment-generation.md`
- Modify: `docs/devops/argocd.md`
- Modify: `docs/devops/k8s.md`

**Step 1: Write the failing doc expectations**

List the required doc changes:

- describe the app as a menu/document terminal application
- explain the contextual help model
- explain database slots and service overrides
- describe root manifests as compatibility surfaces

**Step 2: Verify current docs are incomplete**

Read the files above and confirm they still reference the old pane/hotkey model or omit help-driven workflows.

**Step 3: Update the docs**

Document:

- how to open a deployment workspace
- how to move between menus, record lists, and forms
- how help text is meant to guide operators
- how database slots, env backends, images, and ArgoCD metadata are edited
- how validation and apply flow from the generated workspace

**Step 4: Review for consistency**

Check that all docs agree on:

- generated workspaces are the source of truth
- the TUI is the primary editor
- root deployment files are transitional compatibility artifacts

**Step 5: Commit**

```bash
git add tools/admin-env-wizard/README.md docs/devops/deployment-workspace-workflow.md docs/devops/deployment-generation.md docs/devops/argocd.md docs/devops/k8s.md
git commit -m "docs: update deployment workflow for document-driven admin env tui"
```

### Task 10: Run final verification and capture residual gaps

**Files:**

- Modify if needed: `docs/plans/2026-05-18-admin-env-remaining-objectives-plan.md`

**Step 1: Run targeted TUI tests**

Run: `GOCACHE=/tmp/go-build go test ./internal/tui`
Expected: PASS

**Step 2: Run full module tests**

Run: `GOCACHE=/tmp/go-build go test ./...`
Expected: PASS

**Step 3: Run workspace validation checks against a generated deployment if available**

Run:

```bash
DEPLOYMENT_WORKSPACE_DIR=dist/admin-env/<deployment> node scripts/validate-deployment-inventory.mjs
DEPLOYMENT_WORKSPACE_DIR=dist/admin-env/<deployment> bash scripts/validate-compose-k8s-parity.sh
```

Expected: PASS, or a documented compatibility gap if a test fixture workspace is not present.

**Step 4: Record residual risks**

Document any still-open gaps, especially:

- no real `db-setup` workload generation yet
- any places where help is section-level but not yet per-field
- any places where the app still relies on default `tview` form behavior

**Step 5: Commit**

```bash
git add docs/plans/2026-05-18-admin-env-remaining-objectives-plan.md
git commit -m "docs: record final admin env completion verification"
```

**Completion Record**

Verified:

- `GOCACHE=/tmp/go-build go test ./internal/tui`
- `GOCACHE=/tmp/go-build go test ./...`

Not verified in this checkout:

- `DEPLOYMENT_WORKSPACE_DIR=dist/admin-env/<deployment> node scripts/validate-deployment-inventory.mjs`
- `DEPLOYMENT_WORKSPACE_DIR=dist/admin-env/<deployment> bash scripts/validate-compose-k8s-parity.sh`

Reason:

- there is no generated `dist/admin-env/<deployment>/deployment.yaml` workspace present in the current checkout, so workspace-targeted validation could not be run without first generating a fresh deployment fixture

Residual gaps after Task 10:

- contextual help is section-level, not yet per-field
- some form navigation still depends on default `tview` form behavior rather than a fully custom focus system

### Task 11: Generate db-setup artifacts from workspace database intent

**Files:**

- Modify: `tools/admin-env-wizard/internal/domain/environment.go`
- Modify: `tools/admin-env-wizard/internal/configurator/databases.go`
- Modify: `tools/admin-env-wizard/internal/configurator/service.go`
- Modify: `tools/admin-env-wizard/internal/generate/compose.go`
- Modify: `tools/admin-env-wizard/internal/generate/k8s.go`
- Modify: `tools/admin-env-wizard/internal/output/write.go`
- Modify: `tools/admin-env-wizard/internal/tui/model.go`
- Test: `tools/admin-env-wizard/internal/generate/*_test.go`
- Test: `tools/admin-env-wizard/internal/output/write_test.go`
- Test: `tools/admin-env-wizard/internal/tui/dashboard_test.go`

**Step 1: Write the failing tests**

Add tests that assert:

- database slots marked for create/migrate/seed produce explicit generated db-setup metadata or artifacts
- Compose and Kubernetes output include the db-setup workload only when the workspace intent requires it
- the `Databases` and `Apply` documents surface the generated db-setup plan clearly

**Step 2: Run tests to verify they fail**

Run:

```bash
GOCACHE=/tmp/go-build go test ./internal/generate ./internal/output ./internal/tui -run 'Test.*DbSetup|Test.*DBSetup'
```

Expected: FAIL because no db-setup workload is generated yet.

**Step 3: Write minimal implementation**

Add:

- a generated db-setup workload model derived from slot lifecycle flags
- Compose and Kubernetes artifact emission for that workload
- summary/document wiring so operators can see when it will run and why

Keep the first implementation conservative. The goal is explicit generated setup intent, not a full migration framework.

**Step 4: Run tests to verify they pass**

Run:

```bash
GOCACHE=/tmp/go-build go test ./internal/generate ./internal/output ./internal/tui -run 'Test.*DbSetup|Test.*DBSetup'
```

Expected: PASS

**Step 5: Commit**

```bash
git add tools/admin-env-wizard/internal/domain/environment.go tools/admin-env-wizard/internal/configurator/databases.go tools/admin-env-wizard/internal/configurator/service.go tools/admin-env-wizard/internal/generate/compose.go tools/admin-env-wizard/internal/generate/k8s.go tools/admin-env-wizard/internal/output/write.go tools/admin-env-wizard/internal/tui/model.go tools/admin-env-wizard/internal/generate tools/admin-env-wizard/internal/output/write_test.go tools/admin-env-wizard/internal/tui/dashboard_test.go
git commit -m "feat: generate db setup artifacts from deployment workspace intent"
```

**Completion Record**

Verified:

- `GOCACHE=/tmp/go-build go test ./internal/generate ./internal/output ./internal/tui -run 'Test.*(DBSetup|DbSetup|db-setup)'`
- `GOCACHE=/tmp/go-build go test ./internal/generate ./internal/output ./internal/tui`
- `GOCACHE=/tmp/go-build go test ./...`

---

## Completion Criteria

The original plan should be considered complete when all of the following are true:

- `admin-env tui` behaves like a terminal desktop app, not a wizard
- menu navigation and mouse interaction are both first-class
- deployment workspaces are edited through document-style sections, not hotkey panes
- contextual help accompanies configuration choices and explains consequences
- database slots and service overrides are represented in both the model and the operator workflow
- db-setup intent can be generated from workspace database lifecycle flags
- generated workspace artifacts remain the deployment source of truth
- validation and deploy scripts continue to work during the migration period

## Recommended Execution Order

1. Task 1
2. Task 2
3. Task 3
4. Task 4
5. Task 5
6. Task 6
7. Task 7
8. Task 8
9. Task 9
10. Task 10
11. Task 11

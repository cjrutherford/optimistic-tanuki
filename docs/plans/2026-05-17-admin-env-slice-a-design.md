# Admin Env Slice A Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn the `admin-env-wizard` dashboard shell into a real workspace editor with pane-specific actions for deployment metadata, profile selection, image tag editing, secrets backend management, and apply/materialize/refresh workflows.

**Architecture:** Keep the existing Go/Bubble Tea TUI, but replace the current “menu bar over the old wizard” behavior with a section-aware dashboard model. The model should own a small set of workspace action callbacks so it can save `deployment.yaml`, refresh dependency analysis, materialize env outputs, and regenerate deployment artifacts without shelling out. The configurator layer remains the source of truth for persisted workspace and output generation.

**Tech Stack:** Go, Bubble Tea, Lip Gloss, YAML, existing `configurator`, `output`, and `domain` packages.

---

### Task 1: Add failing tests for pane-aware dashboard behavior

**Files:**

- Modify: `tools/admin-env-wizard/internal/tui/dashboard_test.go`
- Modify: `tools/admin-env-wizard/internal/tui/model.go`

**Step 1: Write the failing test**

Add tests that assert:

- `Deployments` pane renders current deployment metadata and supports save/open status text
- `Profiles` pane shows current profile and updates when a profile hotkey is pressed
- `Images` pane can select a service and edit its image tag
- `Secrets` pane shows env backend path and materialization status
- `Apply` pane can trigger generate, refresh-analysis, and materialize actions

**Step 2: Run test to verify it fails**

Run: `GOCACHE=/tmp/go-build go test ./internal/tui -run 'TestDashboard'`
Expected: FAIL because the model does not yet expose pane-specific views or callbacks.

**Step 3: Write minimal implementation**

Refactor `Model` to:

- hold section-specific status state
- expose a workspace actions struct for save/open/generate/refresh/materialize
- route keyboard input by `activeSection`
- render pane-specific detail text instead of always falling through to the old step flow

**Step 4: Run test to verify it passes**

Run: `GOCACHE=/tmp/go-build go test ./internal/tui -run 'TestDashboard'`
Expected: PASS

**Step 5: Commit**

```bash
git add tools/admin-env-wizard/internal/tui/model.go tools/admin-env-wizard/internal/tui/dashboard_test.go
git commit -m "feat: add workspace-aware dashboard panes"
```

### Task 2: Add failing tests for workspace save/regenerate integration

**Files:**

- Modify: `tools/admin-env-wizard/internal/configurator/deployment_test.go`
- Modify: `tools/admin-env-wizard/internal/configurator/service.go`
- Modify: `tools/admin-env-wizard/internal/configurator/deployment.go`

**Step 1: Write the failing test**

Add tests that assert:

- saving from the dashboard writes updated `deployment.yaml`
- regenerating from a loaded workspace preserves profile, image bindings, env backend, and ArgoCD metadata
- materialize and refresh actions can operate from the same loaded workspace path

**Step 2: Run test to verify it fails**

Run: `GOCACHE=/tmp/go-build go test ./internal/configurator -run 'Test.*Workspace'`
Expected: FAIL because there is no single “save and regenerate current workspace” path yet.

**Step 3: Write minimal implementation**

Add configurator helpers to:

- convert loaded `DeploymentWorkspace` back into `EnvironmentDefinition`
- save a workspace from an environment
- regenerate outputs from a workspace manifest path

**Step 4: Run test to verify it passes**

Run: `GOCACHE=/tmp/go-build go test ./internal/configurator -run 'Test.*Workspace'`
Expected: PASS

**Step 5: Commit**

```bash
git add tools/admin-env-wizard/internal/configurator/deployment.go tools/admin-env-wizard/internal/configurator/service.go tools/admin-env-wizard/internal/configurator/deployment_test.go
git commit -m "feat: add workspace regenerate helpers"
```

### Task 3: Wire dashboard actions from the CLI entrypoint

**Files:**

- Modify: `tools/admin-env-wizard/cmd/admin-env/main.go`
- Modify: `tools/admin-env-wizard/internal/cli/args.go`
- Modify: `tools/admin-env-wizard/README.md`

**Step 1: Write the failing test**

Add or extend tests to assert:

- TUI mode can start from a `-deployment` workspace path
- dashboard actions use in-process configurator callbacks instead of external command assumptions

**Step 2: Run test to verify it fails**

Run: `GOCACHE=/tmp/go-build go test ./internal/cli ./internal/tui`
Expected: FAIL because the CLI does not yet pass a workspace path into TUI mode.

**Step 3: Write minimal implementation**

Update TUI startup so it can:

- optionally load an existing workspace manifest
- provide callbacks for save, refresh-analysis, materialize, and generate/regenerate
- report action results in-pane

**Step 4: Run test to verify it passes**

Run: `GOCACHE=/tmp/go-build go test ./internal/cli ./internal/tui`
Expected: PASS

**Step 5: Commit**

```bash
git add tools/admin-env-wizard/cmd/admin-env/main.go tools/admin-env-wizard/internal/cli/args.go tools/admin-env-wizard/README.md
git commit -m "feat: wire slice a dashboard actions"
```

### Task 4: Full verification

**Files:**

- No new files required

**Step 1: Run focused verification**

Run: `GOCACHE=/tmp/go-build go test ./internal/tui ./internal/configurator ./internal/cli`
Expected: PASS

**Step 2: Run full module verification**

Run: `GOCACHE=/tmp/go-build go test ./...`
Expected: PASS

**Step 3: Commit**

```bash
git add docs/plans/2026-05-17-admin-env-slice-a-design.md
git commit -m "docs: add admin env slice a plan"
```

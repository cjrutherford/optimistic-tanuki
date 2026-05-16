# Admin Env Tview Rewrite Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current wizard-like terminal UI with a classic menu/document desktop-style TUI using `tview`, and extend the deployment workspace model with global database slots plus per-service database overrides.

**Architecture:** Keep generation, persistence, dependency analysis, env backend handling, and deployment workspace semantics in the existing Go configurator/domain layers. Replace the current `bubbletea`-driven `internal/tui` shell with a `tview`/`tcell` application that has a menu bar, left navigation, single active document form, status bar, explicit focus traversal, and mouse support. Add workspace-level database slots and service-level override resolution in the domain/configurator layers first so the new UI is editing a stable model.

**Tech Stack:** Go, `tview`, `tcell`, YAML, existing `configurator`, `domain`, `output`, and CLI wiring.

---

### Task 1: Add the database workspace model

**Files:**

- Modify: `tools/admin-env-wizard/internal/domain/environment.go`
- Modify: `tools/admin-env-wizard/internal/domain/environment_test.go`

**Step 1: Write the failing test**

Add tests that assert:

- a workspace can carry top-level database slots
- a service can point at a slot and optionally override it
- normalization preserves the database definitions

**Step 2: Run test to verify it fails**

Run: `GOCACHE=/tmp/go-build go test ./internal/domain`
Expected: FAIL because database slot fields do not exist yet.

**Step 3: Write minimal implementation**

Add:

- `DatabaseEngine`
- `DatabaseProvisionMode`
- `DatabaseSlot`
- `ServiceDatabaseOverride`
- top-level `Databases []DatabaseSlot` on both `DeploymentWorkspace` and `EnvironmentDefinition`
- `DatabaseSlotID string` and `DatabaseOverride *ServiceDatabaseOverride` on `ServiceSelection`

Keep the existing `DatabaseBinding` for generated effective state for now.

**Step 4: Run test to verify it passes**

Run: `GOCACHE=/tmp/go-build go test ./internal/domain`
Expected: PASS

**Step 5: Commit**

```bash
git add tools/admin-env-wizard/internal/domain/environment.go tools/admin-env-wizard/internal/domain/environment_test.go
git commit -m "feat: add deployment database slot model"
```

### Task 2: Persist and round-trip database slots and overrides

**Files:**

- Modify: `tools/admin-env-wizard/internal/configurator/deployment.go`
- Modify: `tools/admin-env-wizard/internal/configurator/deployment_test.go`

**Step 1: Write the failing test**

Add tests that assert:

- `buildDeploymentWorkspace` persists top-level database slots
- `EnvironmentFromWorkspace` restores them
- service overrides survive a workspace round-trip

**Step 2: Run test to verify it fails**

Run: `GOCACHE=/tmp/go-build go test ./internal/configurator -run 'Test.*Database'`
Expected: FAIL because the new database fields are not persisted.

**Step 3: Write minimal implementation**

Extend:

- `buildDeploymentWorkspace`
- `EnvironmentFromWorkspace`
- any clone helpers needed for slices/maps

Do not yet change generation semantics beyond persistence.

**Step 4: Run test to verify it passes**

Run: `GOCACHE=/tmp/go-build go test ./internal/configurator -run 'Test.*Database'`
Expected: PASS

**Step 5: Commit**

```bash
git add tools/admin-env-wizard/internal/configurator/deployment.go tools/admin-env-wizard/internal/configurator/deployment_test.go
git commit -m "feat: persist deployment database slots"
```

### Task 3: Add database resolution helpers for service inheritance and override

**Files:**

- Create: `tools/admin-env-wizard/internal/configurator/databases.go`
- Create: `tools/admin-env-wizard/internal/configurator/databases_test.go`

**Step 1: Write the failing test**

Add tests for:

- resolving a service against an inherited slot
- resolving a service against a service-specific override
- missing slot ids returning a warning/error state

**Step 2: Run test to verify it fails**

Run: `GOCACHE=/tmp/go-build go test ./internal/configurator -run 'TestResolveServiceDatabase'`
Expected: FAIL because the resolver does not exist.

**Step 3: Write minimal implementation**

Add helpers:

- `ResolveServiceDatabase(env *domain.EnvironmentDefinition, service domain.ServiceSelection) (*domain.DatabaseBinding, []string)`
- `FindDatabaseSlot(...)`

Use the existing `DatabaseBinding` as the effective resolved output for now.

**Step 4: Run test to verify it passes**

Run: `GOCACHE=/tmp/go-build go test ./internal/configurator -run 'TestResolveServiceDatabase'`
Expected: PASS

**Step 5: Commit**

```bash
git add tools/admin-env-wizard/internal/configurator/databases.go tools/admin-env-wizard/internal/configurator/databases_test.go
git commit -m "feat: resolve inherited and overridden service databases"
```

### Task 4: Add `tview` dependencies and replace the TUI entrypoint contract

**Files:**

- Modify: `tools/admin-env-wizard/go.mod`
- Modify: `tools/admin-env-wizard/cmd/admin-env/main.go`
- Modify: `tools/admin-env-wizard/internal/tui/model_test.go`

**Step 1: Write the failing test**

Replace Bubble Tea startup assumptions with a test that asserts the app can construct a dashboard shell object in startup state.

**Step 2: Run test to verify it fails**

Run: `GOCACHE=/tmp/go-build go test ./internal/tui`
Expected: FAIL because the new shell constructor does not exist.

**Step 3: Write minimal implementation**

Add `tview` and `tcell` dependencies. Change the `tui` command path in `cmd/admin-env/main.go` to call a `Run()` or `NewApp(...)` style API from `internal/tui` rather than `tea.NewProgram`.

**Step 4: Run test to verify it passes**

Run: `GOCACHE=/tmp/go-build go test ./internal/tui`
Expected: PASS

**Step 5: Commit**

```bash
git add tools/admin-env-wizard/go.mod tools/admin-env-wizard/cmd/admin-env/main.go tools/admin-env-wizard/internal/tui/model_test.go
git commit -m "refactor: switch admin env tui entrypoint to tview shell"
```

### Task 5: Build the classic menu/document shell

**Files:**

- Replace: `tools/admin-env-wizard/internal/tui/model.go`
- Modify: `tools/admin-env-wizard/internal/tui/dashboard_test.go`

**Step 1: Write the failing test**

Add tests that assert:

- the app starts in a document-style shell
- menu labels include `File`, `Edit`, `Deployment`, `Profile`, `Databases`, `Services`, `Images`, `Compose`, `Kubernetes`, `Secrets`, `Apply`, `Diagnostics`, `Help`
- the startup section is `Deployment` or `File` overview, not a wizard

**Step 2: Run test to verify it fails**

Run: `GOCACHE=/tmp/go-build go test ./internal/tui -run 'TestDashboard'`
Expected: FAIL because the old shell is not menu/document oriented.

**Step 3: Write minimal implementation**

Create a `tview` app shell with:

- top menu bar
- left section list
- center document form
- bottom status bar
- mouse enabled
- explicit form-field navigation

Keep the first implementation focused on structure and startup behavior; do not block on every section being complete.

**Step 4: Run test to verify it passes**

Run: `GOCACHE=/tmp/go-build go test ./internal/tui -run 'TestDashboard'`
Expected: PASS

**Step 5: Commit**

```bash
git add tools/admin-env-wizard/internal/tui/model.go tools/admin-env-wizard/internal/tui/dashboard_test.go
git commit -m "feat: add classic menu document admin env shell"
```

### Task 6: Implement explicit document editors for Deployment, Databases, Services, Kubernetes, and Secrets

**Files:**

- Modify: `tools/admin-env-wizard/internal/tui/model.go`
- Modify: `tools/admin-env-wizard/internal/tui/dashboard_test.go`

**Step 1: Write the failing test**

Add tests that assert:

- deployment form edits name/namespace/provider explicitly
- database section edits global slots
- services section shows inherited vs override database source
- kubernetes section edits ArgoCD metadata
- secrets section edits backend path and reloads summary

**Step 2: Run test to verify it fails**

Run: `GOCACHE=/tmp/go-build go test ./internal/tui -run 'TestDashboard.*(Deployment|Database|Service|Kubernetes|Secrets)'`
Expected: FAIL because the forms do not yet exist.

**Step 3: Write minimal implementation**

Implement form-backed section documents with:

- labeled fields
- checkboxes/dropdowns where appropriate
- no global letter-key bindings for normal operation
- explicit Enter/Tab/Esc navigation and mouse focus

**Step 4: Run test to verify it passes**

Run: `GOCACHE=/tmp/go-build go test ./internal/tui -run 'TestDashboard.*(Deployment|Database|Service|Kubernetes|Secrets)'`
Expected: PASS

**Step 5: Commit**

```bash
git add tools/admin-env-wizard/internal/tui/model.go tools/admin-env-wizard/internal/tui/dashboard_test.go
git commit -m "feat: add explicit document editors for core deployment sections"
```

### Task 7: Wire generate/save/refresh/materialize through menus and dialogs

**Files:**

- Modify: `tools/admin-env-wizard/internal/tui/model.go`
- Modify: `tools/admin-env-wizard/cmd/admin-env/main.go`
- Modify: `tools/admin-env-wizard/internal/tui/dashboard_test.go`

**Step 1: Write the failing test**

Add tests that assert:

- `File > Save`
- `Apply > Regenerate`
- `Apply > Refresh Analysis`
- `Secrets > Materialize`
- status bar and modal/error states update appropriately

**Step 2: Run test to verify it fails**

Run: `GOCACHE=/tmp/go-build go test ./internal/tui -run 'TestDashboard.*(Save|Generate|Refresh|Materialize)'`
Expected: FAIL because menu actions are not wired.

**Step 3: Write minimal implementation**

Add menu command handlers and confirmation/error dialogs. Keep the command path in-process through the existing `Actions` callbacks and generator callback.

**Step 4: Run test to verify it passes**

Run: `GOCACHE=/tmp/go-build go test ./internal/tui -run 'TestDashboard.*(Save|Generate|Refresh|Materialize)'`
Expected: PASS

**Step 5: Commit**

```bash
git add tools/admin-env-wizard/internal/tui/model.go tools/admin-env-wizard/cmd/admin-env/main.go tools/admin-env-wizard/internal/tui/dashboard_test.go
git commit -m "feat: wire menu actions for workspace lifecycle commands"
```

### Task 8: Surface database setup readiness

**Files:**

- Modify: `tools/admin-env-wizard/internal/configurator/databases.go`
- Modify: `tools/admin-env-wizard/internal/tui/model.go`
- Modify: `tools/admin-env-wizard/internal/tui/dashboard_test.go`

**Step 1: Write the failing test**

Add tests that assert the UI can show:

- configured database slots
- services attached to each slot
- missing credential warnings
- db-setup readiness summary in `Apply` or `Diagnostics`

**Step 2: Run test to verify it fails**

Run: `GOCACHE=/tmp/go-build go test ./internal/configurator ./internal/tui -run 'Test.*Database.*Readiness|TestDashboard.*Database.*'`
Expected: FAIL because readiness summary is missing.

**Step 3: Write minimal implementation**

Add a lightweight readiness summary helper and surface its warnings into `Diagnostics` and/or a `Databases` document summary.

**Step 4: Run test to verify it passes**

Run: `GOCACHE=/tmp/go-build go test ./internal/configurator ./internal/tui -run 'Test.*Database.*Readiness|TestDashboard.*Database.*'`
Expected: PASS

**Step 5: Commit**

```bash
git add tools/admin-env-wizard/internal/configurator/databases.go tools/admin-env-wizard/internal/tui/model.go tools/admin-env-wizard/internal/tui/dashboard_test.go
git commit -m "feat: show database setup readiness in admin env dashboard"
```

### Task 9: Update docs for the rewritten desktop-style TUI

**Files:**

- Modify: `tools/admin-env-wizard/README.md`
- Modify: `docs/devops/deployment-workspace-workflow.md`
- Modify: `docs/devops/deployment-generation.md`

**Step 1: Write the failing test**

No code test required. Validate manually by checking docs against the implemented UI behavior.

**Step 2: Write minimal documentation**

Document:

- `tview`-based menu/document UI
- mouse support
- explicit form navigation
- `Databases` section and service overrides
- generated workspace as the source of truth

**Step 3: Verify**

Run:

```bash
GOCACHE=/tmp/go-build go test ./...
```

Expected: PASS

**Step 4: Commit**

```bash
git add tools/admin-env-wizard/README.md docs/devops/deployment-workspace-workflow.md docs/devops/deployment-generation.md
git commit -m "docs: describe desktop-style admin env workflow"
```

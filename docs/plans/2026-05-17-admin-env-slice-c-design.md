# Admin Env Slice C Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn the current simple Compose deploy helper into a real phased startup/apply system that honors deployment profile startup phases, can keep heavy services disabled by default, and surfaces cold-start behavior clearly in generated workspace artifacts and dashboard/apply flows.

**Architecture:** Reuse `domain.DependencyAnalysis.Startup` as the canonical startup plan and extend the generated deployment workspace contract to include apply metadata and disabled-by-default service state. Keep orchestration logic in Go and emit shell scripts plus workspace metadata from `internal/output`; avoid introducing a separate runtime controller. Compose remains the first-class target for phased startup in this slice, while k8s remains a simpler `kubectl apply -k` path with matching image/config outputs.

**Tech Stack:** Go, shell script generation, existing `configurator`, `domain`, `output`, and TUI dashboard packages.

---

### Task 1: Add failing tests for phased Compose deploy script generation

**Files:**

- Modify: `tools/admin-env-wizard/internal/output/write_test.go`
- Modify: `tools/admin-env-wizard/internal/output/write.go`

**Step 1: Write the failing test**

Add tests that assert:

- `compose/deploy.sh` groups pulls and `up -d` calls by startup phase for `minimal` and `small-server`
- disabled heavy services are not started by default
- the generated script includes clear comments or echo markers for each phase

**Step 2: Run test to verify it fails**

Run: `GOCACHE=/tmp/go-build go test ./internal/output -run 'TestWriteDeployScripts'`
Expected: FAIL because the script only pulls sequentially and does one blanket `up -d`.

**Step 3: Write minimal implementation**

Update deploy script rendering so it:

- reads `env.Analysis.Startup.Phases`
- emits per-phase pull and `up -d <services...>` commands
- skips disabled services
- falls back to all enabled services when no phases exist

**Step 4: Run test to verify it passes**

Run: `GOCACHE=/tmp/go-build go test ./internal/output -run 'TestWriteDeployScripts'`
Expected: PASS

**Step 5: Commit**

```bash
git add tools/admin-env-wizard/internal/output/write.go tools/admin-env-wizard/internal/output/write_test.go
git commit -m "feat: generate phased compose startup scripts"
```

### Task 2: Add failing tests for apply metadata persisted in deployment workspaces

**Files:**

- Modify: `tools/admin-env-wizard/internal/domain/environment.go`
- Modify: `tools/admin-env-wizard/internal/configurator/deployment.go`
- Modify: `tools/admin-env-wizard/internal/configurator/deployment_test.go`

**Step 1: Write the failing test**

Add tests that assert:

- generated `deployment.yaml` records apply/startup metadata needed to explain phased startup
- heavy disabled services remain present in workspace state as disabled selections rather than disappearing entirely
- cold-start warnings are persisted for low-resource profiles

**Step 2: Run test to verify it fails**

Run: `GOCACHE=/tmp/go-build go test ./internal/configurator -run 'Test.*DeploymentWorkspace'`
Expected: FAIL because startup/apply metadata is not yet explicitly stored and disabled services are only implied by selection state.

**Step 3: Write minimal implementation**

Extend the workspace manifest and environment model with:

- explicit apply/startup mode metadata
- optional disabled-by-default service list or equivalent persisted state
- persisted cold-start warnings derived from analysis/profile rules

**Step 4: Run test to verify it passes**

Run: `GOCACHE=/tmp/go-build go test ./internal/configurator -run 'Test.*DeploymentWorkspace'`
Expected: PASS

**Step 5: Commit**

```bash
git add tools/admin-env-wizard/internal/domain/environment.go tools/admin-env-wizard/internal/configurator/deployment.go tools/admin-env-wizard/internal/configurator/deployment_test.go
git commit -m "feat: persist startup metadata in deployment workspaces"
```

### Task 3: Add failing tests for profile-driven startup shaping

**Files:**

- Modify: `tools/admin-env-wizard/internal/configurator/profile_test.go`
- Modify: `tools/admin-env-wizard/internal/configurator/profile.go`

**Step 1: Write the failing test**

Add tests that assert:

- `minimal` and `small-server` profiles produce deterministic startup phases that only include enabled services
- heavy services remain in the selection set as disabled entries with warnings, instead of being silently omitted
- `full` profile emits a parallel/all-at-once startup mode

**Step 2: Run test to verify it fails**

Run: `GOCACHE=/tmp/go-build go test ./internal/configurator -run 'TestResolveProfile'`
Expected: FAIL because current startup shaping is coarse and not persisted for disabled services explicitly.

**Step 3: Write minimal implementation**

Refine profile resolution so it:

- carries disabled services forward explicitly
- derives startup phases from enabled services plus required infra
- records cold-start weight warnings for heavy services

**Step 4: Run test to verify it passes**

Run: `GOCACHE=/tmp/go-build go test ./internal/configurator -run 'TestResolveProfile'`
Expected: PASS

**Step 5: Commit**

```bash
git add tools/admin-env-wizard/internal/configurator/profile.go tools/admin-env-wizard/internal/configurator/profile_test.go
git commit -m "feat: refine profile startup shaping"
```

### Task 4: Add failing tests for Apply pane visibility

**Files:**

- Modify: `tools/admin-env-wizard/internal/tui/dashboard_test.go`
- Modify: `tools/admin-env-wizard/internal/tui/model.go`

**Step 1: Write the failing test**

Add tests that assert:

- the `Apply` pane shows startup phases for the current deployment
- the pane surfaces disabled services and cold-start warnings
- the pane distinguishes phased Compose behavior from the k8s apply path

**Step 2: Run test to verify it fails**

Run: `GOCACHE=/tmp/go-build go test ./internal/tui -run 'TestDashboardApply'`
Expected: FAIL because the pane only lists key bindings today.

**Step 3: Write minimal implementation**

Update the Apply pane view to render:

- startup phases from analysis metadata
- disabled service list
- warnings and apply summaries

**Step 4: Run test to verify it passes**

Run: `GOCACHE=/tmp/go-build go test ./internal/tui -run 'TestDashboardApply'`
Expected: PASS

**Step 5: Commit**

```bash
git add tools/admin-env-wizard/internal/tui/model.go tools/admin-env-wizard/internal/tui/dashboard_test.go
git commit -m "feat: expose phased apply plan in dashboard"
```

### Task 5: Full verification

**Files:**

- No new files required

**Step 1: Run focused verification**

Run: `GOCACHE=/tmp/go-build go test ./internal/output ./internal/configurator ./internal/tui`
Expected: PASS

**Step 2: Run full module verification**

Run: `GOCACHE=/tmp/go-build go test ./...`
Expected: PASS

**Step 3: Commit**

```bash
git add docs/plans/2026-05-17-admin-env-slice-c-design.md
git commit -m "docs: add admin env slice c plan"
```

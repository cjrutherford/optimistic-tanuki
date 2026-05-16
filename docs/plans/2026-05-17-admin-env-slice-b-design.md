# Admin Env Slice B Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make deployment dependency analysis consume the real Nx project graph so profile recommendations and warnings are informed by actual workspace relationships instead of only in-memory test fixtures.

**Architecture:** Add a small Nx graph ingestion layer in `internal/configurator` that can parse `pnpm nx graph --print` output, discover the workspace root, and build the simplified dependency map already consumed by `AnalyzeDependencies`. Keep analysis logic in-process and have workspace refresh paths attempt real graph loading automatically, falling back to an empty graph plus a warning when unavailable.

**Tech Stack:** Go, Nx CLI JSON output, existing `configurator`, `domain`, and `catalog` packages.

---

### Task 1: Add failing tests for Nx graph parsing and workspace-root discovery

**Files:**

- Create: `tools/admin-env-wizard/internal/configurator/nx_graph_test.go`
- Modify: `tools/admin-env-wizard/internal/configurator/profile.go`

**Step 1: Write the failing test**

Add tests that assert:

- minimal `nx graph --print` JSON is parsed into the simplified `NxGraph` structure
- only dependency targets are retained
- workspace root discovery climbs directories until `nx.json` is found

**Step 2: Run test to verify it fails**

Run: `GOCACHE=/tmp/go-build go test ./internal/configurator -run 'Test(Parse|Find).*Nx'`
Expected: FAIL because no real parser/discovery layer exists.

**Step 3: Write minimal implementation**

Add:

- `ParseNxGraphJSON([]byte) (NxGraph, error)`
- `FindNxWorkspaceRoot(start string) (string, error)`

**Step 4: Run test to verify it passes**

Run: `GOCACHE=/tmp/go-build go test ./internal/configurator -run 'Test(Parse|Find).*Nx'`
Expected: PASS

**Step 5: Commit**

```bash
git add tools/admin-env-wizard/internal/configurator/nx_graph_test.go tools/admin-env-wizard/internal/configurator/profile.go
git commit -m "feat: parse nx graph output for admin env analysis"
```

### Task 2: Add failing tests for real-graph-backed dependency refresh

**Files:**

- Modify: `tools/admin-env-wizard/internal/configurator/deployment_test.go`
- Modify: `tools/admin-env-wizard/internal/configurator/profile.go`
- Modify: `tools/admin-env-wizard/internal/configurator/deployment.go`

**Step 1: Write the failing test**

Add tests that assert:

- refreshing a workspace with a provided Nx graph picks up `LikelyRequiredBy` hints from real graph data
- graph-load failures append an analysis warning instead of breaking refresh

**Step 2: Run test to verify it fails**

Run: `GOCACHE=/tmp/go-build go test ./internal/configurator -run 'TestRefreshDeploymentWorkspace'`
Expected: FAIL because refresh still hardcodes an empty graph.

**Step 3: Write minimal implementation**

Refactor refresh logic so it can:

- load the Nx graph from an injected loader or the discovered workspace root
- pass the resulting graph into `AnalyzeDependencies`
- preserve graceful fallback behavior

**Step 4: Run test to verify it passes**

Run: `GOCACHE=/tmp/go-build go test ./internal/configurator -run 'TestRefreshDeploymentWorkspace'`
Expected: PASS

**Step 5: Commit**

```bash
git add tools/admin-env-wizard/internal/configurator/deployment.go tools/admin-env-wizard/internal/configurator/deployment_test.go tools/admin-env-wizard/internal/configurator/profile.go
git commit -m "feat: use nx graph in deployment refresh analysis"
```

### Task 3: Wire graph-backed analysis into profile resolution and docs

**Files:**

- Modify: `tools/admin-env-wizard/internal/configurator/service.go`
- Modify: `tools/admin-env-wizard/README.md`

**Step 1: Write the failing test**

Add or extend tests to assert profile resolution can receive a loaded Nx graph and include graph-driven hints in analysis output.

**Step 2: Run test to verify it fails**

Run: `GOCACHE=/tmp/go-build go test ./internal/configurator`
Expected: FAIL because `ResolveProfile` still hardcodes an empty graph.

**Step 3: Write minimal implementation**

Introduce a graph-aware resolver path and use it from generation/refresh flows where a real graph is available.

**Step 4: Run test to verify it passes**

Run: `GOCACHE=/tmp/go-build go test ./internal/configurator`
Expected: PASS

**Step 5: Commit**

```bash
git add tools/admin-env-wizard/internal/configurator/service.go tools/admin-env-wizard/README.md
git commit -m "feat: thread nx graph analysis into profile resolution"
```

### Task 4: Full verification

**Files:**

- No new files required

**Step 1: Run focused verification**

Run: `GOCACHE=/tmp/go-build go test ./internal/configurator`
Expected: PASS

**Step 2: Run full module verification**

Run: `GOCACHE=/tmp/go-build go test ./...`
Expected: PASS

**Step 3: Commit**

```bash
git add docs/plans/2026-05-17-admin-env-slice-b-design.md
git commit -m "docs: add admin env slice b plan"
```

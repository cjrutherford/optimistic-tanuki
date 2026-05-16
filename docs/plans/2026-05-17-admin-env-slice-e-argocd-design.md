# Admin Env Slice E ArgoCD Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the dashboard manage ArgoCD application metadata for generated deployment workspaces and emit repo-relative ArgoCD application manifests that point at `dist/admin-env/<deployment>/k8s`.

**Architecture:** Keep ArgoCD state inside `domain.ArgocdConfig` and `deployment.yaml`, but extend it enough to represent repo URL and target revision in addition to app name/project/namespace. The generator should render ArgoCD applications against repo-relative generated workspace paths, not absolute filesystem paths. The first dashboard editor can live in the existing `Kubernetes` pane to avoid adding a new top-level section.

**Tech Stack:** Go, Bubble Tea, YAML, existing `configurator`, `domain`, and `output` packages.

---

### Task 1: Add failing tests for repo-relative ArgoCD output

**Files:**

- Modify: `tools/admin-env-wizard/internal/configurator/deployment_test.go`
- Modify: `tools/admin-env-wizard/internal/configurator/service.go`

**Step 1: Write the failing test**

Add tests that assert:

- generated `argocd/application.yaml` uses repo-relative `dist/admin-env/<deployment>/k8s`
- application output includes repo URL and target revision from workspace metadata
- deployment manifest round-trips the richer Argo config

**Step 2: Run test to verify it fails**

Run: `GOCACHE=/tmp/go-build go test ./internal/configurator -run 'Test.*Argo'`
Expected: FAIL because Argo output currently uses `filepath.Join(env.OutputDir, "k8s")` and does not persist repo URL / target revision.

**Step 3: Write minimal implementation**

Extend `domain.ArgocdConfig` and update Argo generation so:

- `repoURL`, `targetRevision`, and `path` defaults are handled
- generated application manifests point to `dist/admin-env/<name>/k8s`

**Step 4: Run test to verify it passes**

Run: `GOCACHE=/tmp/go-build go test ./internal/configurator -run 'Test.*Argo'`
Expected: PASS

**Step 5: Commit**

```bash
git add tools/admin-env-wizard/internal/domain/environment.go tools/admin-env-wizard/internal/configurator/service.go tools/admin-env-wizard/internal/configurator/deployment_test.go
git commit -m "feat: emit repo-relative argocd workspace applications"
```

### Task 2: Add failing tests for dashboard Argo editor behavior

**Files:**

- Modify: `tools/admin-env-wizard/internal/tui/dashboard_test.go`
- Modify: `tools/admin-env-wizard/internal/tui/model.go`

**Step 1: Write the failing test**

Add tests that assert the `Kubernetes` pane:

- shows ArgoCD app name, project, namespace, repo URL, and target revision
- can edit and commit at least the application name in the first pass

**Step 2: Run test to verify it fails**

Run: `GOCACHE=/tmp/go-build go test ./internal/tui -run 'TestDashboardKubernetes'`
Expected: FAIL because the pane only shows namespace/provider today.

**Step 3: Write minimal implementation**

Add a simple Argo editor to the `Kubernetes` pane using one text input for app name first, plus static rendering for the other fields.

**Step 4: Run test to verify it passes**

Run: `GOCACHE=/tmp/go-build go test ./internal/tui -run 'TestDashboardKubernetes'`
Expected: PASS

**Step 5: Commit**

```bash
git add tools/admin-env-wizard/internal/tui/model.go tools/admin-env-wizard/internal/tui/dashboard_test.go
git commit -m "feat: expose argocd editor in kubernetes pane"
```

### Task 3: Wire defaults and docs

**Files:**

- Modify: `tools/admin-env-wizard/cmd/admin-env/main.go`
- Modify: `tools/admin-env-wizard/README.md`

**Step 1: Write the failing test**

Add or extend tests only if needed to pin any defaulting behavior.

**Step 2: Run test to verify it fails**

Run: `GOCACHE=/tmp/go-build go test ./...`
Expected: FAIL only if new defaults are untested/missing.

**Step 3: Write minimal implementation**

Ensure generation and dashboard-loaded workspaces get sensible Argo defaults for repo URL and target revision when not provided.

**Step 4: Run test to verify it passes**

Run: `GOCACHE=/tmp/go-build go test ./...`
Expected: PASS

**Step 5: Commit**

```bash
git add tools/admin-env-wizard/cmd/admin-env/main.go tools/admin-env-wizard/README.md
git commit -m "docs: wire argocd workspace defaults"
```

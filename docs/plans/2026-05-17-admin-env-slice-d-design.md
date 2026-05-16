# Admin Env Slice D Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade deployment env handling from a flat key/value backend to a structured config/secrets model with target-specific overrides and clearer materialization for Compose and Kubernetes.

**Architecture:** Keep the local-file backend as the first shipping backend, but change its file format and in-memory representation so non-secret config, secret values, and per-target overrides are distinct. Materialization should merge shared values plus target overrides, emit Compose env files from the merged target set, and emit separate k8s `ConfigMap` and `Secret` manifests from structured data instead of duplicating everything into both.

**Tech Stack:** Go, YAML, existing `configurator`, `domain`, `output`, and TUI dashboard packages.

---

### Task 1: Add failing tests for structured local backend parsing

**Files:**

- Modify: `tools/admin-env-wizard/internal/configurator/env_backend_test.go`
- Modify: `tools/admin-env-wizard/internal/configurator/env_backend.go`

**Step 1: Write the failing test**

Add tests that assert the local backend can parse a YAML file with:

- `config`
- `secrets`
- `targets.compose`
- `targets.k8s`

and that the loaded representation preserves those categories separately.

**Step 2: Run test to verify it fails**

Run: `GOCACHE=/tmp/go-build go test ./internal/configurator -run 'TestLocalFileEnvBackend'`
Expected: FAIL because the backend only supports flat `values:`.

**Step 3: Write minimal implementation**

Introduce a structured env-values model and update `Load` to parse both the new shape and the legacy flat `values:` shape for compatibility.

**Step 4: Run test to verify it passes**

Run: `GOCACHE=/tmp/go-build go test ./internal/configurator -run 'TestLocalFileEnvBackend'`
Expected: PASS

**Step 5: Commit**

```bash
git add tools/admin-env-wizard/internal/configurator/env_backend.go tools/admin-env-wizard/internal/configurator/env_backend_test.go
git commit -m "feat: parse structured env backend values"
```

### Task 2: Add failing tests for target-aware Compose and k8s materialization

**Files:**

- Modify: `tools/admin-env-wizard/internal/configurator/env_backend_test.go`
- Modify: `tools/admin-env-wizard/internal/configurator/service.go`

**Step 1: Write the failing test**

Add tests that assert:

- Compose output contains shared config + shared secrets + compose-only overrides
- k8s `ConfigMap` contains shared config + k8s config overrides only
- k8s `Secret` contains shared secrets + k8s secret overrides only
- values do not leak into the wrong target

**Step 2: Run test to verify it fails**

Run: `GOCACHE=/tmp/go-build go test ./internal/configurator -run 'TestLocalFileEnvBackend|TestGenerateEnvironment'`
Expected: FAIL because current materialization duplicates all values everywhere.

**Step 3: Write minimal implementation**

Update materialization logic so it merges values by target and category instead of using one flat map.

**Step 4: Run test to verify it passes**

Run: `GOCACHE=/tmp/go-build go test ./internal/configurator -run 'TestLocalFileEnvBackend|TestGenerateEnvironment'`
Expected: PASS

**Step 5: Commit**

```bash
git add tools/admin-env-wizard/internal/configurator/env_backend.go tools/admin-env-wizard/internal/configurator/service.go tools/admin-env-wizard/internal/configurator/env_backend_test.go
git commit -m "feat: materialize target-aware env outputs"
```

### Task 3: Add failing tests for workspace persistence and secrets-pane visibility

**Files:**

- Modify: `tools/admin-env-wizard/internal/domain/environment.go`
- Modify: `tools/admin-env-wizard/internal/configurator/deployment_test.go`
- Modify: `tools/admin-env-wizard/internal/tui/dashboard_test.go`
- Modify: `tools/admin-env-wizard/internal/tui/model.go`

**Step 1: Write the failing test**

Add tests that assert:

- deployment workspaces persist structured env backend config
- the `Secrets` pane shows backend type/path plus counts or summaries for config/secrets/overrides

**Step 2: Run test to verify it fails**

Run: `GOCACHE=/tmp/go-build go test ./internal/configurator ./internal/tui -run 'Test.*(Workspace|Secrets)'`
Expected: FAIL because the UI and workspace contract only expose backend path.

**Step 3: Write minimal implementation**

Persist any needed backend metadata and update the `Secrets` pane summary to show structured backend state.

**Step 4: Run test to verify it passes**

Run: `GOCACHE=/tmp/go-build go test ./internal/configurator ./internal/tui -run 'Test.*(Workspace|Secrets)'`
Expected: PASS

**Step 5: Commit**

```bash
git add tools/admin-env-wizard/internal/domain/environment.go tools/admin-env-wizard/internal/configurator/deployment_test.go tools/admin-env-wizard/internal/tui/model.go tools/admin-env-wizard/internal/tui/dashboard_test.go
git commit -m "feat: expose structured env backend state"
```

### Task 4: Full verification

**Files:**

- No new files required

**Step 1: Run focused verification**

Run: `GOCACHE=/tmp/go-build go test ./internal/configurator ./internal/tui`
Expected: PASS

**Step 2: Run full module verification**

Run: `GOCACHE=/tmp/go-build go test ./...`
Expected: PASS

**Step 3: Commit**

```bash
git add docs/plans/2026-05-17-admin-env-slice-d-design.md
git commit -m "docs: add admin env slice d plan"
```

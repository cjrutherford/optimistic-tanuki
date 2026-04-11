# CI / PR Failure Analysis

This document provides an itemized analysis of every failure identified in the
`refactor/deployment-pipeline` branch as of commit `c43e01b`, plus all issues
raised in the automated code review. It also tracks the follow-up workflow
validation pass run locally with `scripts/validate-workflows.sh` after commit
`de911390`. Items are grouped by area and include a resolution status.

---

## 1. GitHub Actions CI Failures

### 1.1 Format Check — `pnpm-lock.yaml` not ignored by Prettier

| Field | Detail |
|-------|--------|
| **Workflow** | `ci.yml` → Quick Validation, `lint.yml` → Lint (Affected) |
| **Error** | `nx format:check` exits with code 1; output: `pnpm-lock.yaml` |
| **Root cause** | `pnpm-lock.yaml` was not listed in `.prettierignore`, so Nx format-check tried to format it and found it non-compliant. |
| **Fix** | Added `pnpm-lock.yaml` to `.prettierignore`. |
| **Status** | ✅ Fixed |

---

### 1.2 Code Coverage — `Resource not accessible by integration`

| Field | Detail |
|-------|--------|
| **Workflow** | `coverage.yml` → Generate Coverage Report |
| **Error** | `HttpError: Resource not accessible by integration` when calling `github.rest.issues.createComment` |
| **Root cause** | The workflow `permissions` block was missing `pull-requests: write`. GitHub's REST API requires this permission for the token to post comments on pull requests (even though PRs are surfaced under the Issues API). |
| **Fix** | Added `pull-requests: write` to the `permissions` block in `coverage.yml`. |
| **Status** | ✅ Fixed |

---

### 1.3 Build / Push Overlay — Potential Infinite Workflow Loop

| Field | Detail |
|-------|--------|
| **Workflow** | `build-push.yml` → Update Staging Overlay |
| **Error** | No immediate failure, but the workflow commits to `k8s/overlays/staging/`, which matches the `on.push.paths: k8s/**` trigger. This re-triggers the workflow on every bot commit, causing an infinite loop of builds and tag updates. |
| **Root cause** | Missing `paths-ignore` on the `push` trigger for overlay directories that are written by the bot. |
| **Fix** | Added `paths-ignore` entries for `k8s/overlays/staging/**` and `k8s/overlays/production/**` in `build-push.yml`. |
| **Status** | ✅ Fixed |

---

### 1.4 Performance Testing (Lighthouse) — Application Not Reachable

| Field | Detail |
|-------|--------|
| **Workflow** | `performance.yml` → Lighthouse Performance Audit (forgeofwill, owner-console) |
| **Error** | Jobs fail during / after the `Start application` step; Lighthouse never runs or cannot reach `http://localhost:4200`. |
| **Root cause** | The Docker container port mapping (`-p 4200:4000`) assumes SSR apps listen on port 4000. Some apps may listen on a different port (e.g. 4200 or 80), or the readiness poll exits early without an error. This appears to be a pre-existing infrastructure gap between the Dockerfile `EXPOSE` declarations and the actual app listening port. |
| **Recommended fix** | Audit each app's `Dockerfile` to confirm the `EXPOSE` port, and update the `docker run -p` mapping accordingly. Add `|| echo "App not ready after 90s"` + `exit 1` to the poll loop so the job explicitly fails with a clear message rather than silently passing. |
| **Status** | ⚠️ Pre-existing — not introduced by this PR; tracked for a follow-up |

---

### 1.5 E2E Tests — Microservices Runner Timeout / UI 404

| Field | Detail |
|-------|--------|
| **Workflow** | `e2e-tests.yml` → Microservices E2E Tests, UI E2E Tests |
| **Error** | Microservices job: `The runner has received a shutdown signal` (exit 143, job cancelled after timeout). UI E2E: job logs not available (404). |
| **Root cause** | Building all microservice Docker images with `npm install --legacy-peer-deps` inside each Dockerfile stage takes far more than the 6-hour GitHub Actions runner limit. The UI E2E job also silently fails (no artifacts, no logs uploaded) and its cancellation is counted as a failure. |
| **Recommended fix** | (a) Pre-build and cache Docker images in the build-push workflow, then pull them in E2E. (b) Parallelize E2E jobs or use a self-hosted runner with a longer timeout. (c) Add `continue-on-error: true` to the `UI E2E Tests` job upload step to ensure logs are always uploaded before the job ends. |
| **Status** | ⚠️ Pre-existing infrastructure issue — not introduced by this PR; tracked for a follow-up |

---

### 1.6 Workflow Validation Script — Remaining Warnings After `de911390`

| Field | Detail |
|-------|--------|
| **Validation command** | `bash scripts/validate-workflows.sh` |
| **Observed result before fixes** | Validation passed, but with 4 warnings: missing top-level `permissions:` in `capture-screenshots.yml`, `docker-publish.yml`, and `njsscan.yml`, plus a self-trigger warning in `deploy.yml`. |
| **Root cause** | The new validator checks for top-level least-privilege permissions and for workflows that perform `git push` without a matching `paths-ignore` or actor guard. These workflows had either implicit permissions or a production overlay push path that could retrigger deploy automation. |
| **Fix** | Added explicit top-level `permissions:` blocks to the three workflows and added `paths-ignore: k8s/overlays/production/**` to `deploy.yml` so production promotion commits do not retrigger the push-based deploy path. |
| **Status** | ✅ Fixed |

---

### 1.7 `build-push.yml` — Invalid `push.paths` + `push.paths-ignore` Combination

| Field | Detail |
|-------|--------|
| **Workflow** | `build-push.yml` |
| **Error** | The push-triggered run failed before any jobs were created, and GitHub reported it as a workflow file issue. |
| **Root cause** | `on.push` used both `paths` and `paths-ignore`. GitHub Actions does not allow that combination for the same event trigger, so the workflow was rejected during workflow parsing. |
| **Fix** | Replaced `paths-ignore` with negated patterns inside the `paths` list: `!k8s/overlays/staging/**` and `!k8s/overlays/production/**`. |
| **Status** | ✅ Fixed |

---

## 2. Code Review Issues (PR Review Comments)

### 2.1 `tools/stack-client` — No Input Navigation on Login Screen

| Field | Detail |
|-------|--------|
| **File** | `tools/stack-client/internal/tui/model.go:69-81` |
| **Issue** | The login form renders 4 text inputs but only `inputs[0]` starts focused. There was no Tab / ↑↓ handling, making it impossible to reach the Email, Password, or App Scope fields. |
| **Fix** | Added `tea.KeyTab`, `tea.KeyShiftTab`, `tea.KeyUp`, `tea.KeyDown` handling in `updateLogin`; these cycle through `m.inputCursor` and call `Focus()`/`Blur()` on each input. Updated the login screen hint to `Tab/↑↓ to navigate · Enter to log in`. |
| **Status** | ✅ Fixed |

---

### 2.2 `tools/stack-client` — Base URL Field Not Applied to Gateway Client

| Field | Detail |
|-------|--------|
| **File** | `tools/stack-client/internal/tui/model.go:154-164` |
| **Issue** | `inputs[0]` collects a Base URL but the value was never applied to the gateway client before login, so the user-entered URL had no effect. |
| **Fix** | Added `SetBaseURL(string)` method to `gateway.Client`. In `updateLogin` on `KeyEnter`, the base URL from `inputs[0]` is now applied to the client via a type-assertion before `Login` is called. |
| **Status** | ✅ Fixed |

---

### 2.3 `tools/admin-env-wizard` — Out-of-Bounds Panic When Advancing to Targets Step

| Field | Detail |
|-------|--------|
| **File** | `tools/admin-env-wizard/internal/tui/model.go:176-185` |
| **Issue** | When pressing Enter on the basics screen, `m.cursor` was not reset. If the user had tabbed to input index ≥ 2 (there are only 2 targets), the subsequent `(*opts)[m.cursor]` call in `updateOptions` would panic with an out-of-range index. |
| **Fix** | Added `m.cursor = 0` immediately before `m.step = stepTargets` in `updateBasics`. |
| **Status** | ✅ Fixed |

---

### 2.4 `tools/stack-client` — `defaultActions` Produces `Run == nil` Action (Panic Risk)

| Field | Detail |
|-------|--------|
| **File** | `tools/stack-client/internal/tui/model.go:217-235` |
| **Issue** | When `NewModel` is called with a non-`*gateway.Client` (e.g. any `clientAPI` implementation that is not the concrete type), `defaultActions` returned an `Action` with `Run == nil`. Selecting that action later caused `m.current.Run(...)` to panic with a nil-function call. |
| **Fix** | The placeholder `Action` now has a `Run` function that returns a clear `fmt.Errorf("gateway client not configured")` instead of `nil`. |
| **Status** | ✅ Fixed |

---

### 2.5 `tools/stack-client` — Error Banner Persists After Navigation

| Field | Detail |
|-------|--------|
| **File** | `tools/stack-client/internal/tui/model.go:95-110` |
| **Issue** | `m.err` was never cleared. After a failed login or action, the error banner persisted even after the user navigated back to the menu or started a new login attempt, making the UI misleading. |
| **Fix** | `m.err` is now set to `nil` in three places: on login submission (`updateLogin`), when an action is selected from the menu (`updateMenu`), and when the user presses `b` to return to the menu from the output screen. |
| **Status** | ✅ Fixed |

---

### 2.6 `README.md` — Uses `npm install` in a pnpm Repository

| Field | Detail |
|-------|--------|
| **File** | `README.md:15-33` |
| **Issue** | The Getting Started quickstart and prerequisites listed `npm` / `npm install`, but the repo uses pnpm (`pnpm-lock.yaml`, `pnpm-workspace.yaml`). Running `npm install` produces a non-reproducible install and conflicts with CI. |
| **Fix** | Replaced `npm install` with `pnpm install` and updated the prerequisite list to `pnpm` instead of `npm`. |
| **Status** | ✅ Fixed |

---

### 2.7 `build-push.yml` — `npm ci` in pnpm Repository

| Field | Detail |
|-------|--------|
| **File** | `.github/workflows/build-push.yml:40-47` |
| **Issue** | The original PR review suggested replacing `npm ci` with pnpm. |
| **Note** | The workflow was already using pnpm (`pnpm install --frozen-lockfile`) in commit `ef782c1`. No further change needed. |
| **Status** | ✅ Already fixed in a prior commit |

---

### 2.8 `deploy.yml` — `npm ci` in pnpm Repository

| Field | Detail |
|-------|--------|
| **File** | `.github/workflows/deploy.yml:83-93` |
| **Issue** | The original PR review suggested replacing `npm ci` with pnpm. |
| **Note** | The workflow was already updated to `pnpm install --frozen-lockfile` in commit `ef782c1`. No further change needed. |
| **Status** | ✅ Already fixed in a prior commit |

---

## 3. Workflow Validation — Pre-commit Tool

A shell script has been added at `scripts/validate-workflows.sh` to let developers
validate all GitHub Actions workflow files before committing. It:

1. Uses **actionlint** for full semantic validation (if installed).
2. Falls back to **yamllint** for YAML structure errors.
3. Falls back to **python3** YAML parsing as a last resort.
4. Checks for common anti-patterns:
   - `npm ci` / `npm install` in a pnpm-managed repo
   - Missing top-level `permissions:` block
   - `k8s/**` push trigger without `paths-ignore` (self-trigger loop risk)
   - Bot `git push` without `paths-ignore` or an actor guard

### Usage

```bash
# Validate all workflows
bash scripts/validate-workflows.sh

# Validate a specific directory
bash scripts/validate-workflows.sh path/to/dir
```

### Install as a git pre-commit hook

```bash
cat > .git/hooks/pre-commit << 'EOF'
#!/usr/bin/env bash
bash scripts/validate-workflows.sh
EOF
chmod +x .git/hooks/pre-commit
```

### Install actionlint (recommended — most thorough)

```bash
go install github.com/rhysd/actionlint/cmd/actionlint@latest
```

---

## 4. Summary

| # | Area | Severity | Status |
|---|------|----------|--------|
| 1.1 | Format check — `pnpm-lock.yaml` not in `.prettierignore` | 🔴 Blocking | ✅ Fixed |
| 1.2 | Coverage — missing `pull-requests: write` permission | 🔴 Blocking | ✅ Fixed |
| 1.3 | Build-push — overlay commit causes self-trigger loop | 🟠 High | ✅ Fixed |
| 1.4 | Performance — Lighthouse can't reach app container | 🟡 Medium | ⚠️ Pre-existing |
| 1.5 | E2E — microservices runner timeout / UI 404 | 🟡 Medium | ⚠️ Pre-existing |
| 1.6 | Workflow validator follow-up warnings | 🟡 Medium | ✅ Fixed |
| 1.7 | build-push trigger uses invalid path filters | 🔴 Blocking | ✅ Fixed |
| 2.1 | stack-client — no login input navigation | 🟠 High | ✅ Fixed |
| 2.2 | stack-client — base URL not applied to gateway | 🟠 High | ✅ Fixed |
| 2.3 | admin-env-wizard — out-of-bounds panic on step transition | 🔴 Blocking | ✅ Fixed |
| 2.4 | stack-client — nil `Run` field causes panic | 🔴 Blocking | ✅ Fixed |
| 2.5 | stack-client — error banner not cleared on navigation | 🟡 Medium | ✅ Fixed |
| 2.6 | README — `npm install` in pnpm repo | 🟡 Medium | ✅ Fixed |
| 2.7 | build-push.yml — `npm ci` in pnpm repo | 🟡 Medium | ✅ Already fixed |
| 2.8 | deploy.yml — `npm ci` in pnpm repo | 🟡 Medium | ✅ Already fixed |
| 3.0 | Workflow validation script | 🟢 Enhancement | ✅ Added |

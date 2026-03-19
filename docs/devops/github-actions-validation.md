# Local GitHub Actions Validation

This document describes how to validate GitHub Actions workflows locally before pushing
changes to the repository.

## Purpose

Running workflows on GitHub requires a push (or pull request), which means broken workflows
are discovered only after code reaches the remote. Local validation lets developers catch
common issues — bad YAML syntax, missing referenced files, structural problems — without
waiting for a remote run.

The local validation harness has three phases:

- **Phase 1** (static analysis) — syntax check, reference check
- **Phase 2** (local execution) — run supported workflows via `act`
- **Phase 3** (remote hardening) — fix action versions, add reusable setup, add dry-run gates

---

## Scripts

All scripts live in the `scripts/` directory at the repository root.

### `scripts/validate-workflows.sh`

Validates the syntax and structure of all workflow files under `.github/workflows/`.

What it does:

1. **actionlint** (when installed) — runs comprehensive GitHub Actions-aware lint:
   workflow schema, expression syntax, shell analysis in `run:` steps, action
   input/output validation.
2. **YAML syntax check** (always) — parses every workflow file with Python's `yaml`
   library (or a Node.js fallback) to catch malformed YAML before anything else.
3. **Required-key check** — verifies that each workflow file contains the top-level
   keys `name`, `on`, and `jobs`.

Exit codes: `0` = all checks passed, `1` = one or more errors.

### `scripts/validate-workflow-references.sh`

Checks that files explicitly referenced inside workflow definitions actually exist in
the repository.

What it checks:

1. **Local shell scripts** — paths matching `scripts/*.sh` or `tools/*.sh` referenced
   in `run:` steps.
2. **Docker Compose files** — files passed via `-f`/`--file` flags (static references
   only; dynamic matrix values are skipped with a note).
3. **npm script names** — `npm run <script>` calls cross-checked against `package.json`.
4. **Well-known project files** — `package.json`, `.github/workflows`, and the primary
   `docker-compose.yaml` and `docker-compose.k8s.yaml` files.

This script is intentionally conservative: it only flags references it can resolve
unambiguously. Dynamic expressions (e.g. `${{ matrix.service }}`) are noted but not
treated as errors.

Exit codes: `0` = no errors (warnings are printed but do not fail), `1` = one or more
missing files.

### `scripts/run-workflow-act.sh`

Runs a specific GitHub Actions workflow locally using [`act`](https://github.com/nektos/act).

```
./scripts/run-workflow-act.sh <workflow.yml> [options]
```

Options:

| Flag | Description |
|------|-------------|
| `--job <name>` | Run only a specific job within the workflow |
| `--event <type>` | GitHub event to simulate (default: `push`) |
| `--dry-run` | List what `act` would do without executing |
| `--list` | Show all workflows with their tier classification |
| `--help` | Show usage help |

Each workflow is classified into one of three tiers — see
[Workflow Matrix](workflow-matrix.md) for the full classification table.

### `scripts/preflight-github-actions.sh`

Orchestrates the full local validation flow. Run this before pushing workflow changes.

```
./scripts/preflight-github-actions.sh [options]
```

Options:

| Flag | Description |
|------|-------------|
| `--skip-references` | Skip the file-reference validation step |
| `--act <workflow.yml>` | Run a specific workflow with `act` (repeatable) |
| `--help` | Show usage help |

---

## npm Scripts

| Command | What it runs |
|---------|-------------|
| `npm run ci:validate:workflows` | `scripts/validate-workflows.sh` |
| `npm run ci:validate:references` | `scripts/validate-workflow-references.sh` |
| `npm run ci:validate:act` | Shows workflow tier classification list |
| `npm run ci:act:lint` | Runs `lint.yml` via `act` |
| `npm run ci:act:build` | Runs `build.yml` via `act` |
| `npm run ci:act:unit-tests` | Runs `unit-tests.yml` via `act` |
| `npm run ci:prepush` | `scripts/preflight-github-actions.sh` (syntax + references) |

---

## Required Tools

### actionlint (recommended)

`actionlint` is a static analysis tool specifically designed for GitHub Actions workflows.
It is the most thorough local validation option available.

Install:

```bash
# macOS (Homebrew) — verified via Homebrew's own checksum system
brew install actionlint

# Linux — download pre-built binary
# Review the installer script before running it, or download a specific release
# with SHA256 checksum verification from https://github.com/rhysd/actionlint/releases
bash <(curl https://raw.githubusercontent.com/rhysd/actionlint/main/scripts/download-actionlint.bash)

# Go toolchain
go install github.com/rhysd/actionlint/cmd/actionlint@latest
```

`validate-workflows.sh` will detect whether `actionlint` is installed and print
installation instructions if it is not. The script will still run the basic YAML and
structural checks regardless.

### act (required for Phase 2)

`act` runs GitHub Actions workflows locally using Docker containers.

Install:

```bash
# macOS (Homebrew)
brew install act

# Linux — download binary (review before running)
curl -s https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Go toolchain
go install github.com/nektos/act@latest

# Full docs: https://nektosact.com/installation/
```

Docker must be running for `act` to work.

### python3 or node

Used for YAML parsing. Both are present in the repository's standard development
environment; no additional installation is needed.

---

## Example Commands

```bash
# Full preflight before pushing workflow changes (syntax + references)
npm run ci:prepush

# Full preflight including act execution of lint and unit tests
./scripts/preflight-github-actions.sh --act lint.yml --act unit-tests.yml

# Validate workflow syntax only
npm run ci:validate:workflows

# Check file references only
npm run ci:validate:references

# Show workflow tier classification
npm run ci:validate:act

# Run lint workflow locally with act
npm run ci:act:lint

# Run a specific job in a workflow
./scripts/run-workflow-act.sh ci.yml --job validate

# Dry-run (list what act would execute without running)
./scripts/run-workflow-act.sh lint.yml --dry-run

# Skip reference checks (e.g., when only editing workflow logic)
./scripts/preflight-github-actions.sh --skip-references
```

---

## Local Secrets for act

`act` can use a local secrets file to simulate GitHub secrets.

1. Copy the example file:
   ```bash
   cp .act.secrets.example .act.secrets
   ```
2. Fill in values for the secrets your workflow needs (see `.act.secrets.example`).
3. `.act.secrets` is git-ignored and will never be committed.

For Tier 1 workflows (`lint.yml`, `unit-tests.yml`, `yci.yml`) no secrets are required.

---

## Phase 3: Remote Workflow Hardening

The following improvements were made to the workflow files as part of Phase 3:

### Action version fixes

All workflow files have been updated to use the correct, current major versions of
GitHub Actions:

| Old version | Correct version |
|---|---|
| `actions/checkout@v6` | `actions/checkout@v4` |
| `actions/setup-node@v6` | `actions/setup-node@v4` |
| `actions/upload-artifact@v7` | `actions/upload-artifact@v4` |
| `docker/metadata-action@v6` | `docker/metadata-action@v5` |
| `docker/build-push-action@v7` | `docker/build-push-action@v6` |
| `actions/github-script@v8` | `actions/github-script@v7` |
| `actions/setup-python@v6.2.0` | `actions/setup-python@v5` |

### docker-publish.yml trigger restriction

`docker-publish.yml` previously triggered on **all branches** (`'**'`). This caused
it to run (and fail at the Docker Hub login step) for every feature-branch push.

It now only triggers on `main` and `develop` branches. A `workflow_dispatch` trigger
has been added with a `push_images` input (default `true`) so developers can trigger
a dry-run build-only check without pushing images:

```bash
# Trigger via GitHub CLI — build only, no push
gh workflow run docker-publish.yml -f push_images=false
```

### Reusable composite action

A shared composite action has been added at `.github/actions/setup-node-nx/action.yml`.
It encapsulates the common bootstrap steps (checkout, Node.js setup, npm ci) to reduce
duplication across workflows.

Usage in a workflow:

```yaml
- uses: ./.github/actions/setup-node-nx
  with:
    node-version: '20'
    derive-nx-shas: 'true'
```

---

## Recommended Developer Workflow

Before pushing any changes to `.github/workflows/`:

1. **Run preflight:**
   ```bash
   npm run ci:prepush
   ```
2. **Fix any errors** reported in the output.
3. **Install `actionlint`** if you haven't already — it catches expression-level mistakes
   that YAML parsers cannot detect.
4. **Optionally run a Tier 1 workflow with act** to validate execution:
   ```bash
   npm run ci:act:lint
   ```
5. **Push** when the preflight exits with `✅ Preflight passed — safe to push!`.

For changes unrelated to workflows (application code, configuration, docs), running
`ci:prepush` is optional but harmless.

---

## Limitations

Local validation covers static analysis only. The following aspects **require a remote
GitHub run** and cannot be validated locally:

| Limitation | Notes |
|---|---|
| Secrets and environment variables | `DOCKERHUB_TOKEN`, cloud credentials, OIDC tokens — not available locally |
| GitHub-hosted runner behaviour | Exact OS, pre-installed tools, runner networking |
| Artifact upload/download | `actions/upload-artifact`, `actions/download-artifact` semantics |
| Deployment targets | Kubernetes cluster, Docker registry push, staging/production environments |
| `$GITHUB_STEP_SUMMARY` writes | Job summaries only render on GitHub |
| PR comments from workflows | `actions/github-script` PR comment steps require a real PR context |
| Workflow interaction events | `workflow_run`, `workflow_call` triggered by other workflows |

See [Workflow Matrix](workflow-matrix.md) for per-workflow local vs remote details.

See `docs/architecture/cicd-pipeline.md` for the full CI/CD pipeline design and
workflow descriptions.

---

## Related Documentation

- [Workflow Matrix](workflow-matrix.md)
- [CI/CD Pipeline Architecture](../architecture/cicd-pipeline.md)
- [DevOps README](README.md)
- [Docker Compose Guide](docker-compose.md)


# Local GitHub Actions Validation

This document describes how to validate GitHub Actions workflows locally before pushing
changes to the repository.

## Purpose

Running workflows on GitHub requires a push (or pull request), which means broken workflows
are discovered only after code reaches the remote. Local validation lets developers catch
common issues — bad YAML syntax, missing referenced files, structural problems — without
waiting for a remote run.

This is a **first-phase** local validation harness. It covers static analysis and file
reference checks. Full execution of workflows still requires GitHub's hosted environment
for anything that depends on registry credentials, OIDC tokens, cloud infrastructure, or
GitHub-specific runner behaviour.

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

### `scripts/preflight-github-actions.sh`

Orchestrates the full local validation flow. Run this before pushing workflow changes.

```
./scripts/preflight-github-actions.sh [--skip-references]
```

Options:

| Flag | Description |
|------|-------------|
| `--skip-references` | Skip the file-reference validation step |
| `--help` | Show usage help |

The script runs the two sub-checks in order and fails fast if either step fails.

---

## npm Scripts

Three convenience commands are exposed in `package.json`:

| Command | What it runs |
|---------|-------------|
| `npm run ci:validate:workflows` | `scripts/validate-workflows.sh` |
| `npm run ci:validate:references` | `scripts/validate-workflow-references.sh` |
| `npm run ci:prepush` | `scripts/preflight-github-actions.sh` (both steps) |

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

### python3 or node

Used for YAML parsing. Both are present in the repository's standard development
environment; no additional installation is needed.

---

## Example Commands

```bash
# Full preflight before pushing workflow changes
npm run ci:prepush

# Validate workflow syntax only
npm run ci:validate:workflows

# Check file references only
npm run ci:validate:references

# Skip reference checks (e.g., when only editing workflow logic)
./scripts/preflight-github-actions.sh --skip-references
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
4. **Push** when the preflight exits with `✅ Preflight passed — safe to push!`.

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
| `act` execution | Using `act` for local workflow execution is a future enhancement (Phase 2) |
| Workflow interaction events | `workflow_run`, `workflow_call` triggered by other workflows |

See `docs/architecture/cicd-pipeline.md` for the full CI/CD pipeline design and
workflow descriptions.

---

## Related Documentation

- [CI/CD Pipeline Architecture](../architecture/cicd-pipeline.md)
- [DevOps README](README.md)
- [Docker Compose Guide](docker-compose.md)

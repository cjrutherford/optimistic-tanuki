# GitHub Actions Workflow Matrix

This document classifies every workflow in `.github/workflows/` according to how it
can be validated and tested — locally, with `act`, or only on the remote.

Use this matrix when deciding which validation strategy to apply before pushing.

---

## Tier Definitions

| Tier  | Label           | Description                                                                                                            |
| ----- | --------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **1** | Local-first     | Core steps run on the local toolchain (Node, Nx, Jest). Safe to run with `act`.                                        |
| **2** | Hybrid          | Mix of local toolchain and Docker/registry steps. `act` can run the core steps; some steps may be skipped.             |
| **3** | Remote-dominant | Requires Docker Hub credentials, OIDC tokens, Kubernetes, or GitHub-specific services. Static validation only locally. |

---

## Workflow Classification

| Workflow                  | Tier | Purpose                                                   | Trigger                                                      | act?               | Required Secrets                                                                   | Notes                                                                      |
| ------------------------- | ---- | --------------------------------------------------------- | ------------------------------------------------------------ | ------------------ | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `lint.yml`                | 1    | Lint affected projects (Nx affected + format check)       | PR, push to main/develop, `workflow_dispatch`                | ✅ Yes             | none                                                                               | Weekly `lint-all` job also runs via `schedule`                             |
| `unit-tests.yml`          | 1    | Run affected unit tests with coverage upload              | PR, push to main/develop, `workflow_dispatch`                | ✅ Yes             | none                                                                               | Weekly `unit-tests-all` job via `schedule`                                 |
| `yci.yml`                 | 1    | Compact lint + build + test pipeline                      | PR, push to main                                             | ✅ Yes             | none                                                                               | Minimal version of `ci.yml`; good smoke-test target                        |
| `ci.yml`                  | 2    | Main CI pipeline: format + affected lint/build/test       | PR, push to main                                             | ⚠️ Partial         | none                                                                               | Matrix strategy; `$GITHUB_STEP_SUMMARY` writes won't work locally          |
| `build.yml`               | 2    | Full build all projects + Docker build check              | PR, push to main/develop, `workflow_dispatch`                | ⚠️ Partial         | `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN` (docker-build job only)                    | Docker build job requires Docker socket                                    |
| `coverage.yml`            | 2    | Coverage report generation + PR comment + Codecov         | PR, push to main/develop, `workflow_dispatch`                | ⚠️ Partial         | `CODECOV_TOKEN`                                                                    | PR comment step requires `GITHUB_TOKEN`; skip in act                       |
| `e2e-tests.yml`           | 2    | Microservice and browser E2E tests via Docker Compose     | PR, push to main/develop, `workflow_dispatch`                | ⚠️ Partial         | none                                                                               | Docker Compose files under `e2e/` must exist                               |
| `capture-screenshots.yml` | 2    | Weekly screenshot capture for Angular apps                | `schedule` (weekly), `workflow_dispatch`                     | ⚠️ Partial         | none                                                                               | Requires Playwright and app builds                                         |
| `performance.yml`         | 3    | Lighthouse performance audit                              | PR to main, `workflow_dispatch`                              | 🔒 No              | none (but requires running service)                                                | Needs Docker Compose app stack running on localhost                        |
| `dependency-updates.yml`  | 3    | Weekly npm audit + outdated check                         | `schedule` (weekly), `workflow_dispatch`                     | 🔒 No              | `GITHUB_TOKEN` (for PR creation)                                                   | `npm outdated` and `npm audit` can be run locally; PR creation needs token |
| `deploy.yml`              | 3    | Build + push images + ArgoCD deploy to staging/production | push to main, `workflow_dispatch`                            | 🔒 No              | `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`, `KUBECONFIG`, `DOMAIN`, `ARGOCD_PASSWORD` | Full deploy workflow; staging then production                              |
| `docker-publish.yml`      | 3    | Build + push all service Docker images                    | push to main/develop, `workflow_dispatch`                    | 🔒 No (build only) | `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`                                            | `workflow_dispatch` supports `push_images: false` for dry-run build        |
| `build-push.yml`          | 3    | Build, push images, update K8s manifests                  | push to main/mvp-polish (path-filtered), `workflow_dispatch` | 🔒 No              | `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`                                            | Also commits SHA-tagged manifest updates back to repo                      |
| `njsscan.yml`             | 3    | Node.js security scan (SARIF upload to GitHub Security)   | push/PR to main                                              | 🔒 No              | `GITHUB_TOKEN` (implicit, for SARIF upload)                                        | Results appear in GitHub Security tab                                      |

---

## Local Validation Commands

### Tier 1 — run locally with `act`

```bash
# Lint
npm run ci:act:lint
# or
./scripts/run-workflow-act.sh lint.yml

# Unit tests
npm run ci:act:unit-tests
# or
./scripts/run-workflow-act.sh unit-tests.yml

# Compact CI (yci.yml)
./scripts/run-workflow-act.sh yci.yml
```

### Tier 2 — run core steps locally via npm

```bash
# CI pipeline equivalents
npx nx affected -t lint --parallel=3 --exclude='*-e2e'
npx nx affected -t build --parallel=3
npx nx affected -t test --configuration=ci --parallel=3

# Coverage
npx nx affected -t test --configuration=ci --codeCoverage=true

# Build all
npm run build

# E2E (local Docker Compose)
npm run e2e:docker:up && npm run e2e:test && npm run e2e:docker:down
```

### Tier 3 — static validation only

```bash
# Validate workflow syntax and references
npm run ci:validate:workflows
npm run ci:validate:references

# For docker-publish dry run (no push)
# Trigger workflow_dispatch with push_images: false via GitHub UI or gh CLI
gh workflow run docker-publish.yml -f push_images=false
```

---

## Required Secrets Reference

| Secret               | Used by                                                           | Notes                                        |
| -------------------- | ----------------------------------------------------------------- | -------------------------------------------- |
| `DOCKERHUB_USERNAME` | `docker-publish.yml`, `build-push.yml`, `deploy.yml`, `build.yml` | Docker Hub account name                      |
| `DOCKERHUB_TOKEN`    | `docker-publish.yml`, `build-push.yml`, `deploy.yml`, `build.yml` | Docker Hub access token (not password)       |
| `KUBECONFIG`         | `deploy.yml`                                                      | Base64-encoded kubeconfig for target cluster |
| `DOMAIN`             | `deploy.yml`                                                      | Production domain name (e.g. `example.com`)  |
| `ARGOCD_PASSWORD`    | `deploy.yml`                                                      | ArgoCD admin password                        |
| `STAGING_URL`        | `deploy.yml`                                                      | Staging environment URL for smoke tests      |
| `PRODUCTION_URL`     | `deploy.yml`                                                      | Production environment URL for smoke tests   |
| `CODECOV_TOKEN`      | `coverage.yml`                                                    | Codecov upload token                         |

---

## Recommended Fix Order for Remote Hardening

When working to get all workflows green on GitHub, follow this order (least to most
external dependency):

1. **`lint.yml`** — pure Nx, no secrets, deterministic
2. **`yci.yml`** — compact smoke test, similar to lint
3. **`unit-tests.yml`** — Nx unit tests, no secrets
4. **`ci.yml`** — main pipeline; depends on the above three being stable
5. **`build.yml`** — full build; Docker build job needs credentials
6. **`coverage.yml`** — needs Codecov token; rest is local
7. **`e2e-tests.yml`** — needs Docker Compose e2e configs under `e2e/`
8. **`capture-screenshots.yml`** — needs Playwright + app builds
9. **`performance.yml`** — needs Lighthouse + running Docker stack
10. **`dependency-updates.yml`** — needs `GITHUB_TOKEN` for PR creation
11. **`njsscan.yml`** — needs Code Scanning enabled on repo
12. **`docker-publish.yml`** — needs Docker Hub credentials; use `push_images: false` to test
13. **`build-push.yml`** — needs Docker Hub + write access to commit manifest updates
14. **`deploy.yml`** — needs full infra secrets; test staging path first

---

## Related Documentation

- [Local GitHub Actions Validation](github-actions-validation.md)
- [DevOps README](README.md)
- [CI/CD Pipeline Architecture](../architecture/cicd-pipeline.md)

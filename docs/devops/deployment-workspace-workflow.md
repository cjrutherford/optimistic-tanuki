# Deployment Workspace Workflow

This is the recommended deployment-management workflow for the repo.

Use it when you need to:

- create or change a deployment state
- tune a low-resource profile
- update image tags or ArgoCD metadata
- materialize secrets/config for Compose or Kubernetes
- validate and apply a deployable environment

The source of truth is the generated deployment workspace under `dist/admin-env/<deployment>/`, managed by `tools/admin-env-wizard`.

## Recommended Flow

1. Open or generate the deployment workspace.

```bash
cd tools/admin-env-wizard
GOCACHE=/tmp/go-build go run ./cmd/admin-env tui -deployment ../../dist/admin-env/<deployment>/deployment.yaml
```

If the workspace does not exist yet, either:

- run `go run ./cmd/admin-env tui` and generate it from the dashboard
- or use `generate` from the CLI first

```bash
GOCACHE=/tmp/go-build go run ./cmd/admin-env generate \
  -name <deployment> \
  -targets compose,k8s \
  -profile small-server \
  -env-file .env/<deployment>.yaml \
  -argocd-app <argocd-app-name>
```

2. Use the dashboard as the primary editor.

The app is meant to behave like a desktop document editor in the terminal:

- top menu bar for major sections and actions
- left record/section navigation
- single active document form
- contextual help region that explains the current document and its consequences
- standard typing only in focused form fields

Recommended documents:

- `Deployment`: confirm workspace identity, namespace, provider, and target surfaces
- `Profile`: choose `minimal`, `small-server`, or `full` and review startup consequences
- `Databases`: configure global database slots and lifecycle intent
- `Services`: review effective inherit vs override behavior per service
- `Images`: update image/tag bindings
- `Kubernetes`: confirm ArgoCD application metadata and generated source path
- `Secrets`: point the workspace at the structured env backend file and inspect override counts
- `Apply`: review save/regenerate/refresh/materialize actions before executing them
- `Diagnostics`: review grouped dependency, startup, and database warnings

Use the help region while moving through these documents. It should explain:

- what the current section controls
- when to inherit shared settings instead of overriding them
- which required service keys are still missing
- whether the current value affects Compose, Kubernetes, or both
- what generated files are rewritten by the chosen action

3. Review the generated workspace artifacts.

Important files:

- `dist/admin-env/<deployment>/deployment.yaml`
- `dist/admin-env/<deployment>/argocd/application.yaml`
- `dist/admin-env/<deployment>/compose/docker-compose.yaml`
- `dist/admin-env/<deployment>/compose/.env.generated`
- `dist/admin-env/<deployment>/gateway/composition.yaml`
- `dist/admin-env/<deployment>/k8s/kustomization.yaml`

4. Validate the workspace.

```bash
cd /home/cjrutherford/workspace/optimistic-tanuki
DEPLOYMENT_WORKSPACE_DIR=dist/admin-env/<deployment> node scripts/validate-deployment-inventory.mjs
DEPLOYMENT_WORKSPACE_DIR=dist/admin-env/<deployment> bash scripts/validate-compose-k8s-parity.sh
```

5. Apply the workspace.

Generated helper:

```bash
./dist/admin-env/<deployment>/deploy.sh
```

Repo-level scripts:

```bash
DEPLOYMENT_NAME=<deployment> ./scripts/deploy-staging.sh
DEPLOYMENT_NAME=<deployment> ./scripts/deploy-production.sh
```

Those scripts now resolve `dist/admin-env/<deployment>/` first. If the workspace exists, they validate and apply from it. If not, they fall back to the legacy root ArgoCD and overlay path.

## Structured Env Backend

The local backend is expected to be gitignored and can carry shared values, service-level overrides, and target-specific values:

```yaml
config:
  LOG_LEVEL: info
secrets:
  JWT_SECRET: super-secret
services:
  payments:
    secrets:
      STRIPE_SECRET_KEY: sk_live_xxx
  prompt-proxy:
    secrets:
      OPENAI_API_KEY: sk-proxy-xxx
    targets:
      k8s:
        config:
          PROMPT_PROXY_BASE_URL: https://prompt-proxy.cluster
targets:
  compose:
    config:
      API_BASE_URL: http://compose.local
  k8s:
    config:
      API_BASE_URL: http://k8s.cluster
    secrets:
      SESSION_SECRET: cluster-secret
```

The dashboard `Secrets` pane and `materialize` command write target-specific outputs from this file into the workspace.

Required service config is now enforced from this backend contract. The workflow distinction is intentional:

- `Save` can persist an incomplete workspace
- `Regenerate` and `Materialize` fail until required keys resolve for every selected service and target

## Database Slots And Service Overrides

Database configuration is now split intentionally:

- `Databases` defines deployment-level slots such as the primary shared postgres database
- `Services` can inherit a slot or override it for one service

Prefer inheritance when possible. Only create a service override when that service must diverge from shared deployment database intent.

The generated workspace persists both:

- global slot metadata
- effective resolved service bindings

That same model is the basis for future `db-setup` automation, so treat the slot and lifecycle flags as deployment intent, not just notes.

## Legacy Compatibility

Root `docker-compose.yaml`, `k8s/base`, and `k8s/overlays/*` still exist for compatibility and CI transition checks.

Treat them as compatibility surfaces, not the preferred place to manage deployment intent.

For new deployment work:

- edit the deployment workspace
- regenerate the workspace artifacts
- validate through the workspace-aware scripts
- only fall back to root files when a migration path still depends on them

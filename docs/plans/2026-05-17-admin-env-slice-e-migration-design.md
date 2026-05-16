# Admin Env Slice E Migration Hardening

**Goal:** Keep the existing inventory and parity validators as compatibility checks for repo-root deployment artifacts, while allowing the same validation path to target a generated deployment workspace under `dist/admin-env/<deployment>/`.

**Approach:** Add an optional deployment-workspace mode to the existing validators instead of introducing a parallel script family. In workspace mode:

- `scripts/validate-deployment-inventory.mjs` should still validate the global inventory against workflow and root manifest surfaces, and additionally validate a generated deployment workspace when `DEPLOYMENT_WORKSPACE_DIR` is provided.
- `scripts/validate-compose-k8s-parity.sh` should accept `DEPLOYMENT_WORKSPACE_DIR` and validate `compose/docker-compose.yaml` against `k8s/base` inside that generated workspace instead of only repo-root files.
- The inventory file should remain injectable through `DEPLOYMENT_INVENTORY_FILE` so CI and tests can pin the same inventory export for both root and workspace validation runs.

**Required workspace checks:**

- `deployment.yaml` exists and is parseable
- enabled services in the workspace are present in the deployment inventory
- generated Compose output includes the enabled Compose services
- generated `k8s/base/kustomization.yaml` includes enabled app manifests
- generated ArgoCD output points at `dist/admin-env/<deployment>/k8s`

**Testing strategy:**

- add a Node test for shared generated-workspace validation
- add a script-level test proving `validate-compose-k8s-parity.sh` can run against a temporary generated workspace using `DEPLOYMENT_WORKSPACE_DIR`
- keep existing root validation behavior as the default when no workspace env var is set

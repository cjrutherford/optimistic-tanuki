# Deploying the learning platform

Three deployables make up the learning platform:

| Component          | Image                                     | Port | Exposure                 |
| ------------------ | ----------------------------------------- | ---- | ------------------------ |
| `learning`         | `cjrutherford/optimistic_tanuki_learning` | 4000 | public, via ingress      |
| `learning-service` | `…_learning-service`                      | 3024 | in-cluster, gateway only |
| `learning-runner`  | `…_learning-runner`                       | 3025 | learning-service only    |

The gateway reaches `learning-service` over TCP; `learning-service` reaches
`learning-runner` over HTTP. Nothing else may reach the runner.

## Docker Compose

`docker-compose.yaml` carries all three. Each pulls its published image at
`${PRODUCTION_IMAGE_TAG:-latest}` and builds only when the image is absent.
Database credentials come from the shared `POSTGRES_*` variables, so a
production `.env` applies to learning-service like every other service.

Relevant variables:

| Variable                 | Default                       | Notes                                            |
| ------------------------ | ----------------------------- | ------------------------------------------------ |
| `LEARNING_PORT`          | `8099`                        | Host port for the client                         |
| `LEARNING_SERVICE_PORT`  | `3024`                        | Host port for the microservice                   |
| `LEARNING_RUNNER_URL`    | `http://learning-runner:3025` | Internal network only                            |
| `LEARNING_OLLAMA_URL`    | `http://shangrila:11434`      | Grading host; must be set per environment        |
| `LEARNING_GRADING_MODEL` | `nemotron-3-nano:4b-q8_0`     | See `grading.service.ts` for how this was chosen |

The runner publishes no host port, on purpose.

## Kubernetes

Manifests live at:

- `k8s/base/services/learning-service.yaml`
- `k8s/base/services/learning-runner.yaml` (Deployment, Service, NetworkPolicy)
- `k8s/base/clients/learning.yaml`

They are listed in `k8s/base/kustomization.yaml` and pinned in both overlays,
so `argocd app sync` deploys them with everything else. The gateway is given
`LEARNING_SERVICE_HOST` / `LEARNING_SERVICE_PORT`; without those it falls back
to the Compose container name, which does not resolve in a cluster.

Public entry is `letsgo.experiments.christopherrutherford.net`, routed by
`k8s/base/ingress.yaml` with `/api` to the gateway and `/` to the client, and
listed in `k8s/base/config/app-registry.json`.

### Before the first sync

1. **Create the database.** `learning-service` runs its migrations on start
   (`migrationsRun: true`) but does not create `ot_learning_service`. The
   cluster has no equivalent of the Compose `db-setup` step for any service,
   so create it against the `postgres` Deployment first.
2. **Confirm the CNI enforces NetworkPolicy.** The runner's isolation is a
   `NetworkPolicy`. Under a CNI that ignores policy it applies cleanly and
   enforces nothing, which would leave an arbitrary-code executor with cluster
   and internet egress. Calico or Cilium; on MicroK8s,
   `microk8s enable community/calico`.
3. **Set `--pod-max-pids` on the nodes the runner schedules to.** It is the
   one Compose control (`pids_limit: 256`) with no pod-level equivalent in the
   Kubernetes API. Until it is set, the memory limit is the only backstop
   against a fork bomb in submitted code.
4. **Patch `LEARNING_OLLAMA_URL`** to an inference host the cluster can reach.
   Grading fails soft — an unreachable grader stores the attempt unmarked
   rather than losing it — so this is not release-blocking, but written answers
   go unmarked until it is set.
5. **Add the origin to `CORS_ALLOWED_ORIGINS`** in the platform secret. The
   Compose default already includes it; the cluster value comes from
   `optimistic-tanuki-secrets` and is maintained out of band.
6. **Issue TLS for the host.** The ingress expects
   `letsgo.experiments.christopherrutherford.net` in the
   `christopherrutherford-net-public-tls` secret, kept in sync from certbot
   output as described in `docs/operators/multi-domain-deployments.md`.

### The runner's sandbox

`apps/learning-runner/server.mjs` states the security model plainly: the
container is the sandbox. Six properties carry it — no capabilities, no new
privileges, a read-only root filesystem, no network egress, a memory cap, and
scratch storage wiped between runs — and each is expressed twice, once in
Compose and once in the Kubernetes manifest, because none of the Compose
controls translate. If you change one, change both.

The `tools/admin-env-wizard` catalog carries the same set as a `Sandbox` on the
`learning-runner` preset, and both generators emit it — compose through
`applySandbox`, Kubernetes through `internal/generate/k8s_sandbox.go`, which
exists precisely because the ordinary writer has no `securityContext`,
`emptyDir` or `NetworkPolicy` and would otherwise produce an unconfined
executor. A field added to `catalog.Sandbox` belongs in both writers.

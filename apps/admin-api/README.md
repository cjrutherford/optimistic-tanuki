# admin-api (O9: bootstrap/ops only)

This service is the **operations plane**, not a second public ingress. It owns
environment bootstrap, deployment introspection, OAuth tooling, and image
management. Product traffic goes through the gateway (`apps/gateway`); any
route here that becomes user-facing moves to the gateway instead (C4).

## Route inventory (all ops-scoped, none duplicating gateway product routes)

| Area          | Routes                                                                                                                                       | Purpose                                                                               |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ |
| Health        | `GET healthz`                                                                                                                                | Liveness probe                                                                        |
| Bootstrap     | `GET bootstrap/status`, `POST bootstrap/scaffold`, `GET/PUT bootstrap/state`, `GET bootstrap/secrets` (+ owner CLI `bootstrap-owner.cli.ts`) | First-run environment scaffolding for compose/k8s, operator onboarding, secret checks |
| Deployment    | `GET api/status/public`, `GET api/rollouts/preview                                                                                           | latest                                                                                | history`, `POST api/rollouts/start`, `GET api/deployment/health`, `GET api/deployment/images`, `POST api/deployment/images/rollout`, `GET api/deployment/images/refresh` | Rollout inspection and control |
| OAuth tooling | `GET oauth/providers`, `GET oauth/apps`, `POST oauth/validate`, `POST oauth/test`                                                            | Provider configuration testing (not the login flow — that lives on the gateway)       |

## Outbound dependencies

Bootstrap talks to `authentication` and `profile` microservices (TCP) for
owner provisioning only. It never serves product reads/writes on their behalf.

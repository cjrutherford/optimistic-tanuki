# Workspace Catalog

This is the repo-wide inventory for apps, libraries, tools, and deployment surfaces.

Use it when you need a complete map instead of browsing directories by hand.

## Apps

### Backend Services

| Project | Role |
| --- | --- |
| `ai-orchestrator` | AI orchestration and tool-driven backend workflows |
| `assets` | uploaded file and asset management |
| `authentication` | identity, login, tokens, and session flows |
| `blogging` | posts, publishing, comments, and related content flows |
| `chat-collector` | chat persistence and retrieval |
| `finance` | financial account, transaction, budget, and inventory flows |
| `gateway` | shared HTTP, SSE, and WebSocket entrypoint |
| `permissions` | RBAC and permission assignment |
| `profile` | user profiles, timelines, and related profile data |
| `project-planning` | projects, tasks, journals, timers, analytics, and risk |
| `prompt-proxy` | prompt-oriented AI request surface |
| `social` | feeds, social interactions, and realtime social flows |
| `telos-docs-service` | documentation- and persona-oriented service data |
| `videos` | video platform backend and media-related workflows |

### Frontend Applications

| Project | Role |
| --- | --- |
| `christopherrutherford-net` | personal site frontend |
| `client-interface` | main multi-surface frontend application |
| `digital-homestead` | frontend application for the digital homestead experience |
| `forgeofwill` | project-planning frontend |
| `video-client` | video platform frontend |

### E2E Projects

| Project | Role |
| --- | --- |
| `ai-orchestrator-e2e` | AI orchestrator end-to-end coverage |
| `fin-commander-e2e` | Fin Commander end-to-end coverage |
| `local-hub-e2e` | Local Hub browser end-to-end coverage |
| `store-client-e2e` | store client end-to-end coverage |
| `video-client-e2e` | video client end-to-end coverage |

## Libraries

### UI Libraries

| Project | Role |
| --- | --- |
| `ag-grid-ui` | theme-aware AG Grid integration |
| `auth-ui` | authentication UI components |
| `blogging-ui` | blog and publishing UI |
| `business-ui` | business-oriented shared UI |
| `chat-ui` | chat components and related UI utilities |
| `common-ui` | core Angular UI primitives and styles |
| `community-ui` | community-oriented shared UI |
| `finance-ui` | financial management UI |
| `form-ui` | reusable form components |
| `forum-ui` | forum-oriented UI |
| `message-ui` | messaging UI |
| `navigation-ui` | app bars, sidebars, and navigation surfaces |
| `notification-ui` | notification lists and bell-style UI |
| `persona-ui` | persona-selection UI |
| `profile-ui` | profile-oriented UI |
| `project-ui` | project-management UI |
| `search-ui` | search and exploration UI |
| `social-ui` | social feature UI and support code |
| `store-ui` | commerce and donation UI |
| `theme-ui` | theme-related Angular UI |
| `video-ui` | reusable video playback and listing UI |

### Domain, Models, And Contracts

| Project | Role |
| --- | --- |
| `app-catalog-contracts` | app and package catalog contract types |
| `app-config-models` | shared application configuration models |
| `constants` | shared constants and tokens |
| `models` | shared domain models |
| `theme-models` | theme-related models |
| `ui-models` | UI-facing shared models |

### Platform And Infrastructure Libraries

| Project | Role |
| --- | --- |
| `app-registry` | cross-app registry and navigation helpers |
| `billing-sdk` | billing-service client helpers |
| `compose-lib` | composition utilities and related services |
| `database` | shared backend persistence helpers |
| `encryption` | cryptographic helpers |
| `logger` | shared logging infrastructure |
| `permission-lib` | shared permission logic |
| `prompt-generation` | prompt-building helpers |
| `storage` | storage abstractions and helpers |
| `theme-lib` | runtime theme services and utilities |
| `theme-styles` | shared SCSS mixins and theme styles |

## Tools

| Project | Role |
| --- | --- |
| `tools/admin-env-wizard` | deployment generation, workspace configs, and deployment inventory export |
| `tools/stack-client` | authenticated terminal client for gateway-backed workflows |

## Deployment Surfaces

### Local Development

| Surface | Role |
| --- | --- |
| `docker-compose.yaml` + `docker-compose.dev.yaml` | local integrated development stack |
| `pnpm exec nx serve <project>` | project-level local runtime |
| `pnpm run watch:build:scope -- --projects=<project>` | targeted dist-driven watch flow |

### Generated Deployments

| Surface | Role |
| --- | --- |
| `tools/admin-env-wizard` output | per-client Compose and K8s deployment trees |
| `gateway/composition.yaml` | generated gateway service/controller contract |
| `deploy.sh` | generated deployment helper entrypoint |

### Repo-Level GitOps Deployment

| Surface | Role |
| --- | --- |
| `k8s/base/` | shared base manifests |
| `k8s/overlays/staging/` | staging environment overlay |
| `k8s/overlays/production/` | production environment overlay |
| `k8s/argo-app/application.yaml` | parameterized ArgoCD application |
| `.github/workflows/build-push.yml` | image build, inventory validation, and promotion |
| `.github/workflows/deploy.yml` | deployment workflow entrypoint |

## What To Read Next

Read these by task:

- new contributor: [Getting Started](../getting-started/README.md)
- workspace navigation: [Workspace Map](../architecture/workspace-map.md)
- deployment generation: [Deployment Generation](../devops/deployment-generation.md)
- gateway composition: [Gateway Configuration](../devops/gateway.md)
- local stack work: [Docker Compose](../devops/docker-compose.md)

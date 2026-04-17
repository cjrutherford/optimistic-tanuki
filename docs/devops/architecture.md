# Infrastructure Architecture

## Overview

The Optimistic Tanuki platform is a microservices-based architecture deployed to Kubernetes with GitOps via ArgoCD.

```
                              ┌─────────────────────────────────────┐
                              │         External Load Balancer      │
                              └──────────────┬──────────────────────┘
                                             │
                       ┌─────────────────────┼─────────────────────┐
                       │                     │                     │
                       ▼                     ▼                     ▼
              ┌───────────────┐    ┌───────────────┐    ┌───────────────┐
              │  Client Apps  │    │    Gateway    │    │   Ingress     │
              │ (Angular SSR) │    │   (NestJS)    │    │   (Nginx)     │
              │   Port 8080   │    │   Port 3000   │    │   /api/*       │
              └───────┬───────┘    └───────┬───────┘    └───────┬───────┘
                      │                     │                     │
                      │                     ▼                     │
                      │            ┌────────────────┐            │
                      │            │  Microservices │            │
                      │            │  (TCP/JSON-RPC)│            │
                      │            └────────────────┘            │
                      │                     │                     │
                      └─────────────────────┼─────────────────────┘
                                            │
              ┌─────────────────────────────┼─────────────────────────────┐
              │                             │                             │
              ▼                             ▼                             ▼
     ┌────────────────┐           ┌────────────────┐          ┌────────────────┐
     │   PostgreSQL   │           │     Redis      │          │   SeaweedFS    │
     │    Port 5432  │           │    Port 6379   │          │    Port 8080   │
     └────────────────┘           └────────────────┘          └────────────────┘
```

## Components

### Clients (Angular SSR)

Each client is a separate Angular application with server-side rendering:

- **client-interface** (port 8080) - Main client application
- **forgeofwill** (port 8081) - Forge of Will client
- **digital-homestead** (port 8082) - Digital Homestead client
- **christopherrutherford-net** (port 8083) - Personal site client
- **owner-console** (port 8084) - Owner console client
- **store-client** (port 8085) - Store client
- **d6** (port 8086) - D6 client
- **configurable-client** (port 8090) - Configurable client

Clients proxy `/api/*` requests to the gateway.

### Gateway (NestJS)

The gateway is the entry point for all API requests. It:

- Routes requests to appropriate microservices via TCP
- Handles authentication via JWT
- Manages WebSocket connections for chat and social features

### Microservices

All backend services use TCP with JSON-RPC for communication:

| Service            | Port | Description            |
| ------------------ | ---- | ---------------------- |
| authentication     | 3001 | User authentication    |
| profile            | 3002 | User profiles          |
| social             | 3003 | Social features        |
| assets             | 3005 | Asset management       |
| project-planning   | 3006 | Project planning       |
| chat-collector     | 3007 | Chat collection        |
| telos-docs-service | 3008 | Telos documentation    |
| prompt-proxy       | 3009 | Prompt proxy           |
| ai-orchestration   | 3010 | AI orchestration       |
| blogging           | 3011 | Blogging platform      |
| permissions        | 3012 | Permissions management |
| store              | 3013 | E-commerce store       |
| app-configurator   | 3014 | App configuration      |
| forum              | 3015 | Forum functionality    |
| wellness           | 3016 | Wellness tracking      |

### Data Stores

- **PostgreSQL** - Primary database for all services
- **Redis** - Caching and session storage
- **SeaweedFS** - Object/file storage

## Kubernetes Structure

```
k8s/
├── base/                    # Base Kustomize manifests
│   ├── clients/            # Client application deployments
│   ├── services/            # Microservice deployments
│   ├── gateway.yaml         # Gateway deployment
│   ├── ingress.yaml         # Nginx ingress
│   ├── postgres.yaml        # PostgreSQL
│   ├── redis.yaml           # Redis
│   ├── seaweedfs.yaml       # SeaweedFS
│   └── secrets.yaml         # Secrets
├── overlays/
│   ├── production/         # Production overrides
│   └── staging/            # Staging overrides
└── argo-app/               # ArgoCD application definitions
```

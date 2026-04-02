# DevOps Documentation

This directory contains infrastructure and deployment documentation for the Optimistic Tanuki platform.

## Contents

- [Architecture Overview](architecture.md) - High-level infrastructure design
- [Kubernetes Deployment](k8s.md) - K8s deployment guides and configuration
- [Service Ports Reference](ports.md) - Port mappings for all services
- [Gateway Configuration](gateway.md) - Gateway service configuration
- [Docker Compose](docker-compose.md) - Local development with Docker Compose
- [ArgoCD](argocd.md) - GitOps deployment with ArgoCD

## Quick Reference

### Local Development Stack

```bash
# Build dist/ and start the full Docker dev stack
npm run docker:dev

# First-time bootstrap with seed data
npm run docker:dev:bootstrap

# Keep hot reload active
npm run watch:build

# Inspect or stop the stack
npm run docker:dev:ps
npm run docker:dev:logs
npm run docker:dev:down
```

### Service Ports

| Service            | Docker Compose Port | K8s LoadBalancer Port | Internal K8s Port |
| ------------------ | ------------------- | --------------------- | ----------------- |
| gateway            | 3000                | 3000                  | 3000              |
| authentication     | 3001                | 3001                  | 3001              |
| profile            | 3002                | 3002                  | 3002              |
| social             | 3003                | 3003                  | 3003              |
| assets             | 3005                | 3005                  | 3005              |
| project-planning   | 3006                | 3006                  | 3006              |
| chat-collector     | 3007                | 3007                  | 3007              |
| telos-docs-service | 3008                | 3008                  | 3008              |
| prompt-proxy       | 3009                | 3009                  | 3009              |
| ai-orchestration   | 3010                | 3010                  | 3010              |
| blogging           | 3011                | 3011                  | 3011              |
| permissions        | 3012                | 3012                  | 3012              |
| store              | 3013                | 3013                  | 3013              |
| app-configurator   | 3014                | 3014                  | 3014              |
| forum              | 3015                | 3015                  | 3015              |
| wellness           | 3016                | 3016                  | 3016              |

### Client Applications

| Client                    | Docker Compose Port | K8s LoadBalancer Port |
| ------------------------- | ------------------- | --------------------- |
| client-interface          | 8080                | 8080                  |
| forgeofwill               | 8081                | 8081                  |
| digital-homestead         | 8082                | 8082                  |
| christopherrutherford-net | 8083                | 8083                  |
| owner-console             | 8084                | 8084                  |
| store-client              | 8085                | 8085                  |
| d6                        | 8086                | 8086                  |
| configurable-client       | 8090                | 8090                  |

### WebSocket Ports

| Service          | Port | Purpose          |
| ---------------- | ---- | ---------------- |
| gateway (chat)   | 3300 | Chat WebSocket   |
| gateway (social) | 3301 | Social WebSocket |

## Deployment Environments

- **Development**: Docker Compose (`docker-compose.yaml`)
- **Production**: Kubernetes with ArgoCD
- **Staging**: Kubernetes overlay (`k8s/overlays/staging/`)

## Key Components

- **Gateway**: API gateway using NestJS, handles routing to microservices
- **Ingress**: Nginx ingress controller for external access
- **ArgoCD**: GitOps for Kubernetes deployments
- **PostgreSQL**: Primary database
- **Redis**: Caching and session storage
- **SeaweedFS**: Object storage for assets

## Scripts

Deployment and management scripts are located in the `scripts/` directory:

### Deployment Scripts

| Script                 | Description                      |
| ---------------------- | -------------------------------- |
| `deploy-production.sh` | Deploy to production environment |
| `deploy-staging.sh`    | Deploy to staging environment    |
| `apply-terraform.sh`   | Apply Terraform configuration    |
| `teardown.sh`          | Tear down Kubernetes resources   |

### Infrastructure Scripts

| Script                        | Description                       |
| ----------------------------- | --------------------------------- |
| `setup-microk8s.sh`           | Setup MicroK8s cluster            |
| `install-terraform.sh`        | Install Terraform                 |
| `generate-secrets.sh`         | Generate Kubernetes secrets       |
| `generate-k8s-deployments.sh` | Generate K8s deployment manifests |

### Database Scripts

| Script            | Description                       |
| ----------------- | --------------------------------- |
| `run-db-setup.sh` | Run database setup and migrations |
| `run-seed.sh`     | Seed database with initial data   |

### Validation Scripts

| Script                           | Description                          |
| -------------------------------- | ------------------------------------ |
| `validate-compose-k8s-parity.sh` | Validate Docker Compose ↔ K8s parity |
| `validate-debug-config.sh`       | Validate debug configuration         |

### Usage

```bash
# Production deployment
./scripts/deploy-production.sh

# Staging deployment
./scripts/deploy-staging.sh

# Custom deployment with environment variables
NAMESPACE=optimistic-tanuki DEPLOY_TARGET=k8s ./scripts/deploy-production.sh
```

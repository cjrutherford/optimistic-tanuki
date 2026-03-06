# Kubernetes Deployment

## Prerequisites

- Kubernetes cluster (1.24+)
- kubectl configured
- Nginx Ingress Controller installed
- ArgoCD installed (for GitOps)

## Directory Structure

```
k8s/
├── base/                    # Base manifests (use as-is)
│   ├── clients/            # Angular client deployments
│   ├── services/           # Microservice deployments
│   ├── gateway.yaml        # API Gateway
│   ├── ingress.yaml        # Ingress rules
│   ├── postgres.yaml       # PostgreSQL
│   ├── redis.yaml          # Redis
│   ├── seaweedfs.yaml     # SeaweedFS
│   └── secrets.yaml       # Secrets (externalized)
├── overlays/
│   ├── production/        # Production overrides
│   └── staging/           # Staging overrides
└── argo-app/              # ArgoCD Application
```

## Deploying

### Option 1: Using Deployment Scripts (Recommended)

The easiest way to deploy is using the provided scripts:

```bash
# Production deployment (full pipeline)
./scripts/deploy-production.sh

# Staging deployment
./scripts/deploy-staging.sh

# With custom options
SETUP_MICROK8S=false ./scripts/deploy-production.sh
```

See [Scripts Reference](#scripts-reference) below for more options.

### Option 2: Direct kubectl

```bash
# Apply base manifests
kubectl apply -k k8s/base

# Or with overlays
kubectl apply -k k8s/overlays/production
```

### Option 2: ArgoCD (Recommended)

```bash
# Apply ArgoCD application
kubectl apply -f k8s/argo-app/application.yaml

# Sync via ArgoCD CLI
argocd app sync optimistic-tanuki
```

## Client Services

Each client has a Deployment and LoadBalancer Service:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: client-interface
spec:
  type: LoadBalancer # Exposes externally
  selector:
    app: client-interface
  ports:
    - port: 8080 # External port
      targetPort: 4000 # Container port
```

Access clients via:

- `<loadbalancer-ip>:8080` - client-interface
- `<loadbalancer-ip>:8081` - forgeofwill
- `<loadbalancer-ip>:8082` - digital-homestead
- etc.

## Gateway Service

The gateway uses ClusterIP (internal only):

```yaml
apiVersion: v1
kind: Service
metadata:
  name: gateway
spec:
  type: ClusterIP
  ports:
    - name: http
      port: 3000
      targetPort: 3000
    - name: chat-ws
      port: 3300
      targetPort: 3300
    - name: social-ws
      port: 3301
      targetPort: 3301
```

## Environment Variables

The gateway accepts environment variables for service configuration:

```
AUTHENTICATION_HOST=authentication
AUTHENTICATION_PORT=3001
BLOGGING_HOST=blogging
BLOGGING_PORT=3011
SOCIAL_HOST=social
SOCIAL_PORT=3003
PROFILE_HOST=profile
PROFILE_PORT=3002
ASSET_HOST=asset
ASSET_PORT=3005
CHAT_COLLECTOR_HOST=chat_collector
CHAT_COLLECTOR_PORT=3007
PERMISSIONS_HOST=permissions
PERMISSIONS_PORT=3012
PROJECT_PLANNING_HOST=project_planning
PROJECT_PLANNING_PORT=3006
TELOS_DOCS_SERVICE_HOST=telos_docs_service
TELOS_DOCS_SERVICE_PORT=3008
AI_ORCHESTRATION_HOST=ai_orchestration
AI_ORCHESTRATION_PORT=3010
APP_CONFIGURATOR_HOST=app_configurator
APP_CONFIGURATOR_PORT=3014
STORE_HOST=store
STORE_PORT=3013
FORUM_HOST=forum
FORUM_PORT=3015
WELLNESS_HOST=wellness
WELLNESS_PORT=3016
```

## Secrets

Secrets are managed via Kubernetes Secrets:

```bash
# Create secrets
kubectl create secret generic optimistic-tanuki-secrets \
  --from-literal=JWT_SECRET=your-secret \
  -n optimistic-tanuki
```

## Scaling

```bash
# Scale gateway
kubectl scale deployment gateway --replicas=3 -n optimistic-tanuki

# Scale client
kubectl scale deployment client-interface --replicas=2 -n optimistic-tanuki
```

## Troubleshooting

```bash
# Check pod status
kubectl get pods -n optimistic-tanuki

# View logs
kubectl logs -f deployment/gateway -n optimistic-tanuki

# Describe service
kubectl describe service gateway -n optimistic-tanuki

# Port forward for testing
kubectl port-forward svc/gateway 3000:3000 -n optimistic-tanuki
```

## Scripts Reference

The following deployment scripts are available in the `scripts/` directory:

| Script                        | Description                         |
| ----------------------------- | ----------------------------------- |
| `deploy-production.sh`        | Full production deployment pipeline |
| `deploy-staging.sh`           | Full staging deployment pipeline    |
| `apply-terraform.sh`          | Apply Terraform infrastructure      |
| `setup-microk8s.sh`           | Setup MicroK8s cluster              |
| `generate-secrets.sh`         | Generate Kubernetes secrets         |
| `generate-k8s-deployments.sh` | Generate deployment manifests       |

### Environment Variables

Customize deployment with these variables:

| Variable            | Default           | Description          |
| ------------------- | ----------------- | -------------------- |
| `NAMESPACE`         | optimistic-tanuki | Kubernetes namespace |
| `DEPLOY_TARGET`     | k8s               | Deployment target    |
| `SETUP_MICROK8S`    | true              | Setup MicroK8s       |
| `INSTALL_TERRAFORM` | true              | Install Terraform    |
| `RUN_DB_SETUP`      | true              | Run database setup   |
| `RUN_SEED`          | true              | Run seed scripts     |
| `ARGO_ENV`          | production        | ArgoCD environment   |

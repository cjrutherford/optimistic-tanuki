# Optimistic Tanuki - Infrastructure Setup Guide

This guide covers setting up the complete CI/CD pipeline with GitHub Actions, Terraform, ArgoCD, and microk8s.

## Prerequisites

- **Hardware**: 4+ CPU cores, 8GB+ RAM, 100GB+ storage
- **OS**: Ubuntu 20.04+ or similar Linux distribution
- **Network**: Static IP recommended, ports 80, 443, 3000-3100 open

---

## Table of Contents

1. [Initial Setup](#1-initial-setup)
2. [Configure Secrets](#2-configure-secrets)
3. [Set up MicroK8s](#3-set-up-microk8s)
4. [Deploy Infrastructure with Terraform](#4-deploy-infrastructure-with-terraform)
5. [Configure GitHub Secrets](#5-configure-github-secrets)
6. [Deploy Application](#6-deploy-application)
7. [Verify Deployment](#7-verify-deployment)

---

## 1. Initial Setup

### Clone the Repository

```bash
git clone https://github.com/cjrutherford/optimistic-tanuki.git
cd optimistic-tanuki
```

### Install Required Tools

```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Docker
sudo apt-get update
sudo apt-get install -y docker.io docker-compose
sudo usermod -aG docker $USER

# Install kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
rm kubectl

# Install Helm
curl -fsSL https://get.helm.sh/helm-v3.13.0-linux-amd64.tar.gz | tar -xz
sudo mv linux-amd64/helm /usr/local/bin/helm
rm -rf linux-amd64

# Install Terraform
wget -O /tmp/terraform.zip https://releases.hashicorp.com/terraform/1.7.0/terraform_1.7.0_linux_amd64.zip
sudo unzip -o /tmp/terraform.zip -d /usr/local/bin/
rm /tmp/terraform.zip
```

---

## 2. Configure Secrets

### Copy and Edit Secrets File

```bash
cp .secrets.example .secrets
nano .secrets
```

### Required Secrets

| Variable            | Description                 | Example                    |
| ------------------- | --------------------------- | -------------------------- |
| `POSTGRES_USER`     | Database username           | `postgres`                 |
| `POSTGRES_PASSWORD` | Database password (change!) | `your-secure-password`     |
| `JWT_SECRET`        | JWT signing secret (Base64) | `c3VwZXJzZWNyZXRzdHJpbmc=` |
| `S3_ACCESS_KEY`     | SeaweedFS access key        | `seaweedfs`                |
| `S3_SECRET_KEY`     | SeaweedFS secret key        | `your-secure-key`          |
| `REDIS_PASSWORD`    | Redis password (optional)   | `redis-password`           |
| `OLLAMA_API_URL`    | Ollama API URL              | `http://ollama`            |
| `OLLAMA_API_PORT`   | Ollama API port             | `11434`                    |

### Generate JWT Secret

```bash
# Generate a secure JWT secret
openssl rand -base64 32
# Output: c3VwZXJzZWNyZXRzdHJpbmcxMjM0NTY3ODkwYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXo=
```

### Generate K8s Secrets

```bash
./scripts/generate-secrets.sh
```

This creates `k8s/secrets/secrets.yaml` from your `.secrets` file.

---

## 3. Set up MicroK8s

### Install MicroK8s

```bash
# Install MicroK8s
sudo snap install microk8s --classic --channel=1.29/stable

# Add user to microk8s group
sudo usermod -aG microk8s $USER
sudo chown -f -R $USER ~/.kube

# Apply group changes (or logout/login)
newgrp microk8s

# Verify installation
microk8s status
```

### Enable Required Addons

```bash
microk8s enable dns
microk8s enable hostpath-storage
microk8s enable ingress
microk8s enable metallb:192.168.1.240-192.168.1.250
microk8s enable helm3
```

> **Note**: For metallb, replace the IP range with your network's available range. See [MetalLB documentation](https://metallb.universe.tf/concepts/configuration/) for details.

### Verify Addons

```bash
microk8s kubectl get pods -n kube-system
```

---

## 4. Deploy Infrastructure with Terraform

### Initialize Terraform

```bash
cd tf
terraform init
```

### Plan Deployment

```bash
# Enter your specific values
terraform plan -out=tfplan \
  -var="argo_admin_password=your-argo-password" \
  -var="domain=your-domain.com"
```

### Apply Infrastructure

```bash
terraform apply -auto-approve tfplan
```

This deploys:

- ArgoCD (in `argocd` namespace)
- ingress-nginx (in `ingress` namespace)
- Application namespace (`optimistic-tanuki`)

### Verify ArgoCD Installation

```bash
# Check ArgoCD pods
microk8s kubectl get pods -n argocd

# Get ArgoCD server IP
microk8s kubectl get svc -n argocd argocd-server -o jsonpath='{.status.loadBalancer.ingress[0].ip}'
```

### Access ArgoCD UI

1. Get the initial admin password:

   ```bash
   microk8s kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
   ```

2. Access ArgoCD at: `http://<your-ip>` (or domain if configured)

3. Login with:
   - Username: `admin`
   - Password: (from step 1)

---

## 5. Configure GitHub Secrets

Navigate to: **Settings → Secrets and variables → Actions**

### Required Secrets

| Secret Name          | Description             | How to Get                                                                           |
| -------------------- | ----------------------- | ------------------------------------------------------------------------------------ |
| `DOCKERHUB_USERNAME` | Docker Hub username     | Your Docker Hub account                                                              |
| `DOCKERHUB_TOKEN`    | Docker Hub access token | [Docker Hub → Account Settings → Security](https://hub.docker.com/settings/security) |
| `KUBECONFIG`         | Kubernetes config       | See below                                                                            |
| `ARGOCD_PASSWORD`    | ArgoCD admin password   | Same as step 4                                                                       |
| `DOMAIN`             | Your domain             | `yourdomain.com`                                                                     |

### Generate KUBECONFIG

From your microk8s server:

```bash
microk8s kubectl config view --flatten > kubeconfig
cat kubeconfig
```

Copy the entire output and add as a GitHub secret named `KUBECONFIG`.

---

## 6. Deploy Application

### Option A: Automatic via GitHub Actions

Push to main branch or manually trigger:

1. Go to **Actions → Deploy**
2. Click **Run workflow**
3. Select environment: `staging` or `production`
4. Click **Run workflow**

### Option B: Manual ArgoCD Sync

```bash
# Install ArgoCD CLI
curl -sSL -o /usr/local/bin/argocd https://github.com/argoproj/argo-cd/releases/latest/download/argocd-linux-amd64
chmod +x /usr/local/bin/argocd

# Login to ArgoCD
argocd login argocd.yourdomain.com --username admin --password YOUR_PASSWORD

# Sync application
argocd app sync optimistic-tanuki
```

---

## 7. Verify Deployment

### Check Pods

```bash
microk8s kubectl get pods -n optimistic-tanuki
```

### Check Services

```bash
microk8s kubectl get svc -n optimistic-tanuki
```

### Test Endpoint

```bash
curl http://<gateway-ip>:3000/api/mcp/sse
```

### View Logs

```bash
# Gateway logs
microk8s kubectl logs -n optimistic-tanuki -l app=gateway

# Assets service logs
microk8s kubectl logs -n optimistic-tanuki -l app=assets
```

---

## Troubleshooting

### Pods Not Starting

```bash
# Describe pod for events
microk8s kubectl describe pod <pod-name> -n optimistic-tanuki

# Check pod logs
microk8s kubectl logs <pod-name> -n optimistic-tanuki
```

### ArgoCD Sync Failing

```bash
# View ArgoCD app status
argocd app get optimistic-tanuki

# View sync error details
argocd app resources optimistic-tanuki
```

### SeaweedFS Issues

```bash
# Check SeaweedFS pod
microk8s kubectl logs -n optimistic-tanuki -l app=seaweedfs

# Test S3 endpoint
curl http://seaweedfs:8888
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     GitHub Actions                          │
│  (Build → Push Images → Trigger ArgoCD Sync)             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      ArgoCD                                │
│  (GitOps Controller - syncs from k8s/overlays/)           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     MicroK8s                               │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐  │
│  │  ingress    │ │  ArgoCD     │ │  optimistic-tanuki  │  │
│  │  nginx      │ │  (installed)│ │  namespace          │  │
│  └─────────────┘ └─────────────┘ └─────────────────────┘  │
│                                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │ postgres │ │  redis   │ │seaweedfs │ │ services     │  │
│  │          │ │          │ │ (S3)     │ │ (gateway,    │  │
│  │          │ │          │ │          │ │  assets,     │  │
│  │          │ │          │ │          │ │  auth, etc) │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Additional Resources

- [MicroK8s Documentation](https://microk8s.io/docs)
- [ArgoCD Documentation](https://argo-cd.readthedocs.io/)
- [Terraform Documentation](https://developer.hashicorp.com/terraform/docs)
- [SeaweedFS Documentation](https://github.com/seaweedfs/seaweedfs)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Docker Buildx](https://docs.docker.com/build/buildx/)
- [GitHub Actions](https://docs.github.com/en/actions)

---

## Maintenance

### Update Application

Simply push changes to the repository. ArgoCD will automatically sync.

```bash
git add .
git commit -m "Update configuration"
git push origin main
```

### Backup PostgreSQL

```bash
microk8s kubectl exec -n optimistic-tanuki postgres-0 -- pg_dump -U postgres -d postgres > backup.sql
```

### Update Secrets

```bash
# 1. Edit .secrets
nano .secrets

# 2. Regenerate K8s secrets
./scripts/generate-secrets.sh

# 3. Apply to cluster
microk8s kubectl apply -f k8s/secrets/secrets.yaml

# 4. Restart pods to pick up new secrets
microk8s kubectl rollout restart deployment -n optimistic-tanuki
```

### Scale Services

```bash
# Scale gateway to 3 replicas
microk8s kubectl scale deployment gateway -n optimistic-tanuki --replicas=3
```

---

## Security Considerations

1. **Never commit `.secrets`** - It's in `.gitignore` for a reason
2. **Use strong passwords** - Generate with `openssl rand -base64 32`
3. **Enable SSL/TLS** - Configure cert-manager for production
4. **Restrict RBAC** - Create service accounts with minimal permissions
5. **Network policies** - Add Kubernetes NetworkPolicies
6. **Regular updates** - Keep MicroK8s and addons updated

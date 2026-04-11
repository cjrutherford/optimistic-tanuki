#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
TF_DIR="$PROJECT_DIR/tf"
NAMESPACE="${NAMESPACE:-optimistic-tanuki}"
DEPLOY_TARGET="${DEPLOY_TARGET:-k8s}"
RUN_DB_SETUP="${RUN_DB_SETUP:-true}"
RUN_SEED="${RUN_SEED:-true}"
CREATE_DATABASES="${CREATE_DATABASES:-true}"
RUN_MIGRATIONS="${RUN_MIGRATIONS:-true}"
SEED_TARGET="${SEED_TARGET:-all}"
SETUP_MICROK8S="${SETUP_MICROK8S:-true}"
INSTALL_TERRAFORM="${INSTALL_TERRAFORM:-true}"
TF_SKIP_IF_EXISTS="${TF_SKIP_IF_EXISTS:-true}"
WAIT_TIMEOUT="${WAIT_TIMEOUT:-300s}"
HELM_IMPORT_EXISTING="${HELM_IMPORT_EXISTING:-true}"
ADOPT_EXISTING_INGRESS_CLASS="${ADOPT_EXISTING_INGRESS_CLASS:-true}"
BOOTSTRAP_APPLY_SURFACE="${BOOTSTRAP_APPLY_SURFACE:-true}"
ARGO_ENV="${ARGO_ENV:-production}"
ARGO_TARGET_REVISION="${ARGO_TARGET_REVISION:-main}"
INGRESS_SERVICE_TYPE="${INGRESS_SERVICE_TYPE:-LoadBalancer}"
TAILSCALE_OAUTH_CLIENT_ID="${TAILSCALE_OAUTH_CLIENT_ID:-}"
TAILSCALE_OAUTH_CLIENT_SECRET="${TAILSCALE_OAUTH_CLIENT_SECRET:-}"
TAILSCALE_FQDN="${TAILSCALE_FQDN:-}"
TAILSCALE_OPERATOR_VERSION="${TAILSCALE_OPERATOR_VERSION:-1.94.2}"

SECRETS_FILE="$PROJECT_DIR/.secrets"
if [ -f "$SECRETS_FILE" ]; then
    source "$SECRETS_FILE"
fi

KUBECTL_CMD="kubectl"
if command -v microk8s >/dev/null 2>&1; then
    KUBECTL_CMD="microk8s kubectl"
fi

prepare_kubeconfig_for_terraform() {
    if [ -n "${KUBECONFIG:-}" ] && [ -f "${KUBECONFIG}" ]; then
        export TF_VAR_kubeconfig_path="$KUBECONFIG"
        echo "Using pre-set KUBECONFIG: $KUBECONFIG"
        return 0
    fi

    if command -v microk8s >/dev/null 2>&1; then
        local microk8s_config="$PROJECT_DIR/tmp/microk8s-kubeconfig"
        mkdir -p "$PROJECT_DIR/tmp"
        if microk8s status --wait-ready >/dev/null 2>&1 && microk8s config > "$microk8s_config" 2>/dev/null; then
            :
        elif command -v sudo >/dev/null 2>&1 && sudo -n microk8s status --wait-ready >/dev/null 2>&1 && sudo -n microk8s config > "$microk8s_config" 2>/dev/null; then
            :
        else
            echo "Error: microk8s is installed but kubeconfig could not be retrieved."
            echo "Run 'newgrp microk8s' (or relogin), or set KUBECONFIG manually."
            return 1
        fi
        export KUBECONFIG="$microk8s_config"
        export TF_VAR_kubeconfig_path="$microk8s_config"
        echo "Prepared MicroK8s kubeconfig for Terraform: $microk8s_config"
        return 0
    fi

    local default_config="$HOME/.kube/config"
    if [ -f "$default_config" ]; then
        export KUBECONFIG="$default_config"
        export TF_VAR_kubeconfig_path="$default_config"
        echo "Using default kubeconfig: $default_config"
        return 0
    fi

    echo "Error: No valid kubeconfig found for Terraform."
    echo "Set KUBECONFIG, or install/configure MicroK8s and run again."
    return 1
}

wait_for_deployment() {
    local namespace=$1
    local name=$2
    
    if ! $KUBECTL_CMD get deployment "$name" -n "$namespace" >/dev/null 2>&1; then
        echo "Deployment/$name does not exist in namespace $namespace, skipping wait."
        return 0
    fi
    
    local ready=$($KUBECTL_CMD get deployment "$name" -n "$namespace" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
    if [ "$ready" = "0" ] || [ -z "$ready" ]; then
        echo "Waiting for deployment/$name to be ready in namespace $namespace..."
        if ! timeout "$WAIT_TIMEOUT" bash -lc "until $KUBECTL_CMD get deployment/$name -n $namespace --request-timeout=10s >/dev/null 2>&1; do sleep 5; done"; then
            echo "Warning: deployment/$name was not created in namespace $namespace within $WAIT_TIMEOUT"
            return 1
        fi

        echo "Waiting for deployment/$name rollout in namespace $namespace..."
        $KUBECTL_CMD rollout status "deployment/$name" -n "$namespace" --timeout="$WAIT_TIMEOUT" || echo "Warning: rollout status failed, continuing..."
    else
        echo "Deployment/$name already has $ready ready replicas, skipping wait."
    fi
}

wait_for_argocd_application_sync() {
    local app_name=$1
    local app_namespace=$2

    echo "Waiting for ArgoCD application '$app_name' to reach Synced state..."
    if ! timeout "$WAIT_TIMEOUT" bash -lc "until [ \"\$($KUBECTL_CMD get application/$app_name -n $app_namespace -o jsonpath='{.status.sync.status}' --request-timeout=10s 2>/dev/null)\" = \"Synced\" ]; do sleep 5; done"; then
        echo "Warning: ArgoCD application '$app_name' did not report Synced within $WAIT_TIMEOUT. Continuing with workload checks."
    fi
}

echo "=========================================="
echo "Production Deployment Pipeline"
echo "=========================================="

if [ "$SETUP_MICROK8S" = "true" ]; then
    echo ""
    echo "Step 1: Setting up MicroK8s (snap + microk8s)..."
    if command -v microk8s >/dev/null 2>&1; then
        if microk8s status --wait-ready >/dev/null 2>&1; then
            echo "MicroK8s is already running, skipping setup."
        else
            if [ -f "$SCRIPT_DIR/setup-microk8s.sh" ]; then
                chmod +x "$SCRIPT_DIR/setup-microk8s.sh"
                "$SCRIPT_DIR/setup-microk8s.sh"
            else
                echo "Error: setup-microk8s.sh not found."
                exit 1
            fi
        fi
    else
        if [ -f "$SCRIPT_DIR/setup-microk8s.sh" ]; then
            chmod +x "$SCRIPT_DIR/setup-microk8s.sh"
            "$SCRIPT_DIR/setup-microk8s.sh"
        else
            echo "Error: setup-microk8s.sh not found."
            exit 1
        fi
    fi
else
    echo ""
    echo "Step 1: Skipping MicroK8s setup (SETUP_MICROK8S=false)."
fi

if [ "$INSTALL_TERRAFORM" = "true" ]; then
    echo ""
    echo "Step 2: Installing Terraform..."
    if [ -f "$SCRIPT_DIR/install-terraform.sh" ]; then
        chmod +x "$SCRIPT_DIR/install-terraform.sh"
        "$SCRIPT_DIR/install-terraform.sh"
    else
        echo "Error: install-terraform.sh not found."
        exit 1
    fi
else
    echo ""
    echo "Step 2: Skipping Terraform installation (INSTALL_TERRAFORM=false)."
fi

echo ""
echo "Step 3: Checking secrets configuration..."
if [ ! -f "$PROJECT_DIR/.secrets" ]; then
    echo "Creating .secrets from example..."
    cp "$PROJECT_DIR/.secrets.example" "$PROJECT_DIR/.secrets"
    echo "Please edit .secrets with your configuration before continuing."
    exit 1
fi
echo "Secrets file found."

echo ""
echo "Step 4: Generating Kubernetes secrets..."
cd "$PROJECT_DIR"
if [ -f "./scripts/generate-secrets.sh" ]; then
    chmod +x ./scripts/generate-secrets.sh
    ./scripts/generate-secrets.sh
else
    echo "Warning: generate-secrets.sh not found, skipping k8s secrets generation."
fi

echo ""
echo "Step 5: Validating deployment inventory..."
if [ -f "$SCRIPT_DIR/validate-deployment-inventory.mjs" ]; then
    INVENTORY_FILE="$(mktemp)"
    trap 'rm -f "$INVENTORY_FILE"' EXIT
    (
        cd "$PROJECT_DIR/tools/admin-env-wizard"
        GOCACHE="${GOCACHE:-/tmp/go-build}" go run ./cmd/deployment-inventory > "$INVENTORY_FILE"
    )
    DEPLOYMENT_INVENTORY_FILE="$INVENTORY_FILE" node "$SCRIPT_DIR/validate-deployment-inventory.mjs"
else
    echo "Error: validate-deployment-inventory.mjs not found."
    exit 1
fi

echo ""
echo "Step 5.1: Validating compose ↔ k8s parity..."
if [ -f "$SCRIPT_DIR/validate-compose-k8s-parity.sh" ]; then
    chmod +x "$SCRIPT_DIR/validate-compose-k8s-parity.sh"
    "$SCRIPT_DIR/validate-compose-k8s-parity.sh"
else
    echo "Error: validate-compose-k8s-parity.sh not found."
    exit 1
fi

echo ""
echo "Step 6: Applying Terraform configuration..."
prepare_kubeconfig_for_terraform

check_terraform_applied() {
    if ! $KUBECTL_CMD get namespace argocd >/dev/null 2>&1; then
        return 1
    fi
    if ! $KUBECTL_CMD get namespace optimistic-tanuki >/dev/null 2>&1; then
        return 1
    fi
    return 0
}

TF_ALREADY_APPLIED=false
if [ "$TF_SKIP_IF_EXISTS" = "true" ] && check_terraform_applied; then
    echo "Terraform resources already exist in cluster, skipping apply."
else
    if [ -f "$SCRIPT_DIR/apply-terraform.sh" ]; then
        chmod +x "$SCRIPT_DIR/apply-terraform.sh"
        APP_NAMESPACE="optimistic-tanuki" \
        INGRESS_SERVICE_TYPE="LoadBalancer" \
        HELM_IMPORT_EXISTING="$HELM_IMPORT_EXISTING" \
        ADOPT_EXISTING_INGRESS_CLASS="$ADOPT_EXISTING_INGRESS_CLASS" \
        TF_SKIP_PLAN=true \
        TF_AUTO_APPROVE=true \
        TAILSCALE_OAUTH_CLIENT_ID="$TAILSCALE_OAUTH_CLIENT_ID" \
        TAILSCALE_OAUTH_CLIENT_SECRET="$TAILSCALE_OAUTH_CLIENT_SECRET" \
        TAILSCALE_FQDN="$TAILSCALE_FQDN" \
        TAILSCALE_OPERATOR_VERSION="$TAILSCALE_OPERATOR_VERSION" \
        "$SCRIPT_DIR/apply-terraform.sh"
    else
        cd "$TF_DIR"
        echo "Initializing Terraform..."
        terraform init
        
        echo "Planning Terraform deployment..."
        terraform plan -out=tfplan
        
        echo "Applying Terraform configuration..."
        terraform apply -auto-approve tfplan
    fi
fi

echo ""
echo "Step 7: Applying ArgoCD application and waiting for infrastructure..."

ARGO_REPO_URL="${ARGO_REPO_URL:-https://github.com/cjrutherford/optimistic-tanuki.git}"
ARGO_TARGET_REVISION="${ARGO_TARGET_REVISION:-main}"
ARGO_ENV="${ARGO_ENV:-production}"

ARGO_APP_FILE="$PROJECT_DIR/k8s/argo-app/application.yaml"
if [ -f "$ARGO_APP_FILE" ]; then
    sed -e "s|\${ARGO_APP_NAME:-optimistic-tanuki}|optimistic-tanuki|g" \
        -e "s|\${ARGO_NAMESPACE:-optimistic-tanuki}|$NAMESPACE|g" \
        -e "s|\${ARGO_REPO_URL:-https://github.com/cjrutherford/optimistic-tanuki.git}|$ARGO_REPO_URL|g" \
        -e "s|\${ARGO_TARGET_REVISION:-main}|$ARGO_TARGET_REVISION|g" \
        -e "s|\${ARGO_ENV:-production}|$ARGO_ENV|g" \
        "$ARGO_APP_FILE" | $KUBECTL_CMD apply -f -
else
    echo "ArgoCD application file not found, skipping."
fi

echo ""
echo "Step 7.5: Creating required service aliases..."
NAMESPACE="${NAMESPACE:-optimistic-tanuki}"

if ! $KUBECTL_CMD get svc db -n "$NAMESPACE" >/dev/null 2>&1; then
    echo "Creating 'db' service alias for postgres..."
    $KUBECTL_CMD expose deployment postgres -n "$NAMESPACE" --name=db --port=5432 --target-port=5432 2>/dev/null || true
else
    echo "Service 'db' already exists, skipping."
fi

if [ "$BOOTSTRAP_APPLY_SURFACE" = "true" ]; then
    echo "Bootstrap: Applying application surface manifests..."
    if $KUBECTL_CMD get namespace "$NAMESPACE" >/dev/null 2>&1; then
        echo "Deleting existing client services to avoid conflicts..."
        for svc in christopherrutherford-net client-interface configurable-client d6 digital-homestead forgeofwill owner-console store-client; do
            $KUBECTL_CMD delete svc "$svc" -n "$NAMESPACE" --ignore-not-found=true 2>/dev/null || true
        done
        $KUBECTL_CMD apply -k "$PROJECT_DIR/k8s/overlays/${ARGO_ENV}" --server-side --force-conflicts
    else
        echo "Namespace $NAMESPACE does not exist, skipping bootstrap apply."
    fi
fi

if [ -n "$TAILSCALE_OAUTH_CLIENT_ID" ] && [ -n "$TAILSCALE_OAUTH_CLIENT_SECRET" ]; then
    echo ""
    echo "Step 8: Deploying Tailscale Kubernetes Operator..."
    TAILSCALE_NS="tailscale"
    
    if ! $KUBECTL_CMD get namespace "$TAILSCALE_NS" >/dev/null 2>&1; then
        $KUBECTL_CMD create namespace "$TAILSCALE_NS"
    fi
    
    echo "Installing Tailscale operator and CRDs from official manifest..."
    curl -sL "https://raw.githubusercontent.com/tailscale/tailscale/v${TAILSCALE_OPERATOR_VERSION:-1.94.2}/cmd/k8s-operator/deploy/manifests/operator.yaml" | \
        sed "s|client_id: # SET CLIENT ID HERE|client_id: ${TAILSCALE_OAUTH_CLIENT_ID}|g" | \
        sed "s|client_secret: # SET CLIENT SECRET HERE|client_secret: ${TAILSCALE_OAUTH_CLIENT_SECRET}|g" | \
        $KUBECTL_CMD apply -f -
    
    echo "Tailscale operator deployed successfully."
fi
    
wait_for_deployment "argocd" "argocd-server"
wait_for_argocd_application_sync "optimistic-tanuki" "argocd"
wait_for_deployment "$NAMESPACE" "postgres"
wait_for_deployment "$NAMESPACE" "redis"
wait_for_deployment "$NAMESPACE" "gateway"

if [ "$DEPLOY_TARGET" != "k8s" ] && [ "$DEPLOY_TARGET" != "kubernetes" ]; then
    echo "Warning: DEPLOY_TARGET is '$DEPLOY_TARGET', but production flow assumes Kubernetes infrastructure."
fi

echo ""
echo "=========================================="
echo "Infrastructure deployment complete!"
echo "=========================================="
echo ""

if [ "$RUN_DB_SETUP" = "true" ]; then
    echo ""
    echo "=========================================="
    echo "Database Setup & Migration"
    echo "=========================================="
    if [ -f "$SCRIPT_DIR/run-db-setup.sh" ]; then
        chmod +x "$SCRIPT_DIR/run-db-setup.sh"
        DEPLOY_TARGET="$DEPLOY_TARGET" CREATE_DATABASES="$CREATE_DATABASES" RUN_MIGRATIONS="$RUN_MIGRATIONS" "$SCRIPT_DIR/run-db-setup.sh"
    else
        echo "Error: run-db-setup.sh not found."
        exit 1
    fi
fi

if [ "$RUN_SEED" = "true" ]; then
    echo ""
    echo "=========================================="
    echo "Seed Scripts"
    echo "=========================================="
    if [ -f "$SCRIPT_DIR/run-seed.sh" ]; then
        chmod +x "$SCRIPT_DIR/run-seed.sh"
        DEPLOY_TARGET="$DEPLOY_TARGET" SEED_TARGET="$SEED_TARGET" "$SCRIPT_DIR/run-seed.sh"
    else
        echo "Error: run-seed.sh not found."
        exit 1
    fi
fi

echo ""
echo "=========================================="
echo "Production deployment pipeline completed!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Configure ArgoCD: argocd login argocd.<domain> --username admin --password <password>"
echo "2. Sync application: argocd app sync optimistic-tanuki"
echo "Or push to main branch to trigger GitHub Actions deployment."

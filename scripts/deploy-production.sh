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
WAIT_TIMEOUT="${WAIT_TIMEOUT:-300s}"
HELM_IMPORT_EXISTING="${HELM_IMPORT_EXISTING:-true}"
ADOPT_EXISTING_INGRESS_CLASS="${ADOPT_EXISTING_INGRESS_CLASS:-true}"
BOOTSTRAP_APPLY_SURFACE="${BOOTSTRAP_APPLY_SURFACE:-true}"

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
    echo "Waiting for deployment/$name to be created in namespace $namespace..."
    if ! timeout "$WAIT_TIMEOUT" bash -lc "until $KUBECTL_CMD get deployment/$name -n $namespace --request-timeout=10s >/dev/null 2>&1; do sleep 5; done"; then
        echo "Error: deployment/$name was not created in namespace $namespace within $WAIT_TIMEOUT"
        exit 1
    fi

    echo "Waiting for deployment/$name rollout in namespace $namespace..."
    $KUBECTL_CMD rollout status "deployment/$name" -n "$namespace" --timeout="$WAIT_TIMEOUT"
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
    if [ -f "$SCRIPT_DIR/setup-microk8s.sh" ]; then
        chmod +x "$SCRIPT_DIR/setup-microk8s.sh"
        "$SCRIPT_DIR/setup-microk8s.sh"
    else
        echo "Error: setup-microk8s.sh not found."
        exit 1
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
echo "Step 5: Validating compose ↔ k8s parity..."
if [ -f "$SCRIPT_DIR/validate-compose-k8s-parity.sh" ]; then
    chmod +x "$SCRIPT_DIR/validate-compose-k8s-parity.sh"
    "$SCRIPT_DIR/validate-compose-k8s-parity.sh"
else
    echo "Error: validate-compose-k8s-parity.sh not found."
    exit 1
fi

echo ""
echo "Step 5.5: Preparing Kubernetes API access for Terraform..."
prepare_kubeconfig_for_terraform

echo ""
echo "Step 6: Applying Terraform configuration..."
if [ -f "$SCRIPT_DIR/apply-terraform.sh" ]; then
    chmod +x "$SCRIPT_DIR/apply-terraform.sh"
    HELM_IMPORT_EXISTING="$HELM_IMPORT_EXISTING" ADOPT_EXISTING_INGRESS_CLASS="$ADOPT_EXISTING_INGRESS_CLASS" "$SCRIPT_DIR/apply-terraform.sh"
else
    cd "$TF_DIR"
    echo "Initializing Terraform..."
    terraform init
    
    echo "Planning Terraform deployment..."
    terraform plan -out=tfplan
    
    echo "Applying Terraform configuration..."
    terraform apply -auto-approve tfplan
fi

echo ""
echo "Step 7: Applying ArgoCD application and waiting for infrastructure..."
$KUBECTL_CMD apply -f "$PROJECT_DIR/k8s/argo-app/application.yaml"

if [ "$BOOTSTRAP_APPLY_SURFACE" = "true" ]; then
    echo "Bootstrap: Applying application surface manifests directly for first-time setup..."
    $KUBECTL_CMD apply -k "$PROJECT_DIR/k8s/overlays/production"
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

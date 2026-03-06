#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
TF_DIR="$PROJECT_DIR/tf"

TARGET_ENV="${1:-staging}"
FORCE="${FORCE:-false}"
TERRAFORM_DESTROY="${TERRAFORM_DESTROY:-true}"
KEEP_CLUSTER_RESOURCES="${KEEP_CLUSTER_RESOURCES:-false}"

PRODUCTION_NAMESPACE="optimistic-tanuki"
STAGING_NAMESPACE="optimistic-tanuki-staging"
ARGO_NAMESPACE="argocd"
INGRESS_NAMESPACE="ingress"

KUBECTL_CMD="kubectl"
if command -v microk8s >/dev/null 2>&1; then
    KUBECTL_CMD="microk8s kubectl"
fi

if [ "$TARGET_ENV" = "production" ]; then
    APP_NAMESPACE="$PRODUCTION_NAMESPACE"
    ARGO_ENV="production"
elif [ "$TARGET_ENV" = "staging" ]; then
    APP_NAMESPACE="$STAGING_NAMESPACE"
    ARGO_ENV="staging"
else
    echo "Error: Invalid environment '$TARGET_ENV'. Must be 'production' or 'staging'."
    exit 1
fi

resolve_kubeconfig_path() {
    local resolved_path="${KUBECONFIG:-}"

    if [ -n "$resolved_path" ] && [ -f "$resolved_path" ]; then
        echo "$resolved_path"
        return 0
    fi

    if command -v microk8s >/dev/null 2>&1; then
        local microk8s_config="$PROJECT_DIR/tmp/microk8s-kubeconfig"
        mkdir -p "$PROJECT_DIR/tmp"
        if microk8s status --wait-ready >/dev/null 2>&1 && microk8s config > "$microk8s_config" 2>/dev/null; then
            echo "$microk8s_config"
            return 0
        fi
        if command -v sudo >/dev/null 2>&1 && sudo -n microk8s status --wait-ready >/dev/null 2>&1 && sudo -n microk8s config > "$microk8s_config" 2>/dev/null; then
            echo "$microk8s_config"
            return 0
        fi
    fi

    resolved_path="$HOME/.kube/config"
    if [ -f "$resolved_path" ]; then
        echo "$resolved_path"
        return 0
    fi

    return 1
}

confirm_destroy() {
    if [ "$FORCE" = "true" ]; then
        return 0
    fi

    echo ""
    echo "=========================================="
    echo "  TEARDOWN WARNING"
    echo "=========================================="
    echo "This will destroy all resources for:"
    echo "  - Environment: $TARGET_ENV"
    echo "  - Namespace: $APP_NAMESPACE"
    echo ""
    echo "This will:"
    if [ "$TERRAFORM_DESTROY" = "true" ]; then
        echo "  1. Delete ArgoCD application 'optimistic-tanuki'"
        echo "  2. Destroy all Terraform-managed resources (Helm releases, namespaces)"
        if [ "$KEEP_CLUSTER_RESOURCES" = "false" ]; then
            echo "  3. Remove remaining Kubernetes resources in $APP_NAMESPACE"
        fi
    else
        echo "  1. Delete ArgoCD application 'optimistic-tanuki'"
        if [ "$KEEP_CLUSTER_RESOURCES" = "false" ]; then
            echo "  2. Remove Kubernetes resources in $APP_NAMESPACE"
        fi
    fi
    echo ""
    echo "=========================================="
    read -p "Are you sure you want to continue? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "Aborted."
        exit 0
    fi
}

load_secrets() {
    local secrets_file="$PROJECT_DIR/.secrets"

    if [ ! -f "$secrets_file" ]; then
        echo "Warning: .secrets file not found at $secrets_file"
        return 1
    fi

    POSTGRES_USER=$(grep "^POSTGRES_USER=" "$secrets_file" | cut -d'=' -f2-)
    POSTGRES_PASSWORD=$(grep "^POSTGRES_PASSWORD=" "$secrets_file" | cut -d'=' -f2-)
    POSTGRES_DB=$(grep "^POSTGRES_DB=" "$secrets_file" | cut -d'=' -f2-)
    JWT_SECRET=$(grep "^JWT_SECRET=" "$secrets_file" | cut -d'=' -f2-)
    S3_ACCESS_KEY=$(grep "^S3_ACCESS_KEY=" "$secrets_file" | cut -d'=' -f2-)
    S3_SECRET_KEY=$(grep "^S3_SECRET_KEY=" "$secrets_file" | cut -d'=' -f2-)
    REDIS_PASSWORD=$(grep "^REDIS_PASSWORD=" "$secrets_file" | cut -d'=' -f2-)

    export TF_VAR_postgres_user="${POSTGRES_USER:-postgres}"
    export TF_VAR_postgres_password="${POSTGRES_PASSWORD:-}"
    export TF_VAR_postgres_db="${POSTGRES_DB:-postgres}"
    export TF_VAR_jwt_secret="${JWT_SECRET:-}"
    export TF_VAR_s3_access_key="${S3_ACCESS_KEY:-}"
    export TF_VAR_s3_secret_key="${S3_SECRET_KEY:-}"
    export TF_VAR_redis_password="${REDIS_PASSWORD:-}"
}

echo "=========================================="
echo "Teardown Pipeline: $TARGET_ENV"
echo "=========================================="

confirm_destroy

KUBECONFIG_PATH="$(resolve_kubeconfig_path || true)"
if [ -z "$KUBECONFIG_PATH" ]; then
    echo "Error: Could not resolve a valid kubeconfig file."
    exit 1
fi

export KUBECONFIG="$KUBECONFIG_PATH"
echo "Using kubeconfig: $KUBECONFIG_PATH"

echo ""
echo "Step 1: Deleting ArgoCD application..."
if $KUBECTL_CMD get application optimistic-tanuki -n "$ARGO_NAMESPACE" >/dev/null 2>&1; then
    $KUBECTL_CMD delete application optimistic-tanuki -n "$ARGO_NAMESPACE" --ignore-not-found=true
    echo "ArgoCD application 'optimistic-tanuki' deleted."
else
    echo "ArgoCD application 'optimistic-tanuki' not found, skipping."
fi

if [ "$TERRAFORM_DESTROY" = "true" ]; then
    echo ""
    echo "Step 2: Destroying Terraform resources..."

    if [ ! -d "$TF_DIR" ]; then
        echo "Warning: Terraform directory not found at $TF_DIR"
    else
        cd "$TF_DIR"

        load_secrets

        ARGO_PASSWORD="${ARGO_ADMIN_PASSWORD:-${ARGO_PASSWORD:-optimistic-tanuki}}"
        DOMAIN="${DOMAIN:-localhost}"
        CLUSTER_NAME="${CLUSTER_NAME:-optimistic-tanuki}"
        INGRESS_SERVICE_TYPE="${INGRESS_SERVICE_TYPE:-LoadBalancer}"

        export TF_VAR_argo_admin_password="$ARGO_PASSWORD"
        export TF_VAR_domain="$DOMAIN"
        export TF_VAR_cluster_name="$CLUSTER_NAME"
        export TF_VAR_ingress_service_type="$INGRESS_SERVICE_TYPE"
        export TF_VAR_app_namespace="$APP_NAMESPACE"
        export TF_VAR_kubeconfig_path="$KUBECONFIG_PATH"

        if [ -f ".terraform.lock.hcl" ] || [ -d ".terraform" ]; then
            echo "Running Terraform destroy..."
            terraform init -input=false || true

            if [ "$FORCE" = "true" ]; then
                terraform destroy -input=false -auto-approve -lock-timeout=5m \
                    -var="argo_admin_password=$ARGO_PASSWORD" \
                    -var="domain=$DOMAIN" \
                    -var="cluster_name=$CLUSTER_NAME" \
                    -var="ingress_service_type=$INGRESS_SERVICE_TYPE" \
                    -var="app_namespace=$APP_NAMESPACE"
            else
                terraform destroy -input=false -lock-timeout=5m \
                    -var="argo_admin_password=$ARGO_PASSWORD" \
                    -var="domain=$DOMAIN" \
                    -var="cluster_name=$CLUSTER_NAME" \
                    -var="ingress_service_type=$INGRESS_SERVICE_TYPE" \
                    -var="app_namespace=$APP_NAMESPACE"
            fi
            echo "Terraform destroy completed."
        else
            echo "Terraform not initialized, skipping Terraform destroy."
        fi
    fi
fi

if [ "$KEEP_CLUSTER_RESOURCES" = "false" ]; then
    echo ""
    echo "Step 3: Cleaning up remaining Kubernetes resources..."

    echo "Deleting all resources in namespace $APP_NAMESPACE..."
    $KUBECTL_CMD delete all --all -n "$APP_NAMESPACE" --ignore-not-found=true --wait=true 2>/dev/null || true

    echo "Deleting namespace $APP_NAMESPACE..."
    $KUBECTL_CMD delete namespace "$APP_NAMESPACE" --ignore-not-found=true --wait=true 2>/dev/null || true

    if [ "$TARGET_ENV" = "staging" ]; then
        echo "Checking if production namespace still exists..."
        if $KUBECTL_CMD get namespace "$PRODUCTION_NAMESPACE" >/dev/null 2>&1; then
            echo "Keeping production namespace ($PRODUCTION_NAMESPACE) intact."
        else
            echo ""
            echo "Note: Production namespace does not exist either."
            echo "If you want to also tear down production, run:"
            echo "  ./teardown.sh production"
        fi
    fi
else
    echo ""
    echo "Step 3: Skipping Kubernetes cleanup (KEEP_CLUSTER_RESOURCES=true)."
fi

echo ""
echo "=========================================="
echo "Teardown completed for $TARGET_ENV!"
echo "=========================================="

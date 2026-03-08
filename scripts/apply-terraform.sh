#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
TF_DIR="$PROJECT_DIR/tf"
SECRETS_FILE="$PROJECT_DIR/.secrets"

if [ ! -d "$TF_DIR" ]; then
    echo "Error: Terraform directory not found at $TF_DIR"
    exit 1
fi

load_secrets() {
    if [ ! -f "$SECRETS_FILE" ]; then
        echo "Error: .secrets file not found at $SECRETS_FILE"
        echo "Please copy .secrets.example to .secrets and fill in your values"
        exit 1
    fi

    POSTGRES_USER=$(grep "^POSTGRES_USER=" "$SECRETS_FILE" | cut -d'=' -f2-)
    POSTGRES_PASSWORD=$(grep "^POSTGRES_PASSWORD=" "$SECRETS_FILE" | cut -d'=' -f2-)
    POSTGRES_DB=$(grep "^POSTGRES_DB=" "$SECRETS_FILE" | cut -d'=' -f2-)
    JWT_SECRET=$(grep "^JWT_SECRET=" "$SECRETS_FILE" | cut -d'=' -f2-)
    S3_ACCESS_KEY=$(grep "^S3_ACCESS_KEY=" "$SECRETS_FILE" | cut -d'=' -f2-)
    S3_SECRET_KEY=$(grep "^S3_SECRET_KEY=" "$SECRETS_FILE" | cut -d'=' -f2-)
    REDIS_PASSWORD=$(grep "^REDIS_PASSWORD=" "$SECRETS_FILE" | cut -d'=' -f2-)
    TAILSCALE_OAUTH_CLIENT_ID=$(grep "^TAILSCALE_OAUTH_CLIENT_ID=" "$SECRETS_FILE" | cut -d'=' -f2-)
    TAILSCALE_OAUTH_CLIENT_SECRET=$(grep "^TAILSCALE_OAUTH_CLIENT_SECRET=" "$SECRETS_FILE" | cut -d'=' -f2-)
    TAILSCALE_FQDN=$(grep "^TAILSCALE_FQDN=" "$SECRETS_FILE" | cut -d'=' -f2-)

    export TF_VAR_postgres_user="${POSTGRES_USER:-postgres}"
    export TF_VAR_postgres_password="${POSTGRES_PASSWORD:-}"
    export TF_VAR_postgres_db="${POSTGRES_DB:-postgres}"
    export TF_VAR_jwt_secret="${JWT_SECRET:-}"
    export TF_VAR_s3_access_key="${S3_ACCESS_KEY:-}"
    export TF_VAR_s3_secret_key="${S3_SECRET_KEY:-}"
    export TF_VAR_redis_password="${REDIS_PASSWORD:-}"
    export TF_VAR_tailscale_oauth_client_id="${TAILSCALE_OAUTH_CLIENT_ID:-}"
    export TF_VAR_tailscale_oauth_client_secret="${TAILSCALE_OAUTH_CLIENT_SECRET:-}"
    export TF_VAR_tailscale_fqdn="${TAILSCALE_FQDN:-}"

    echo "Loaded secrets from $SECRETS_FILE"
}

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

get_kubectl_cmd() {
    if command -v kubectl >/dev/null 2>&1; then
        echo "kubectl"
        return 0
    fi
    if command -v microk8s >/dev/null 2>&1; then
        if microk8s kubectl version --client >/dev/null 2>&1; then
            echo "microk8s kubectl"
            return 0
        fi
        if command -v sudo >/dev/null 2>&1 && sudo -n microk8s kubectl version --client >/dev/null 2>&1; then
            echo "sudo -n microk8s kubectl"
            return 0
        fi
    fi
    return 1
}

get_helm_cmd() {
    if command -v helm >/dev/null 2>&1; then
        echo "helm"
        return 0
    fi
    if command -v microk8s >/dev/null 2>&1; then
        if microk8s helm3 version >/dev/null 2>&1; then
            echo "microk8s helm3"
            return 0
        fi
        if command -v sudo >/dev/null 2>&1 && sudo -n microk8s helm3 version >/dev/null 2>&1; then
            echo "sudo -n microk8s helm3"
            return 0
        fi
    fi
    return 1
}

import_namespace_if_present() {
    local tf_address=$1
    local namespace=$2
    local kubectl_cmd=$3

    if terraform state show "$tf_address" >/dev/null 2>&1; then
        echo "Namespace '$namespace' already tracked in state ($tf_address)."
        return 0
    fi

    echo "Checking cluster for namespace '$namespace'..."
    if timeout "$KUBECTL_TIMEOUT" bash -lc "$kubectl_cmd get namespace \"$namespace\" --request-timeout=10s >/dev/null 2>&1"; then
        echo "Importing existing namespace '$namespace' into Terraform state ($tf_address)..."
        if ! timeout "$TF_IMPORT_TIMEOUT" terraform import -input=false -lock-timeout=30s "$tf_address" "$namespace"; then
            echo "Error: Timed out importing namespace '$namespace' into state."
            echo "You can retry with larger TF_IMPORT_TIMEOUT (current: $TF_IMPORT_TIMEOUT)."
            exit 1
        fi
    else
        echo "Namespace '$namespace' not found in cluster or kubectl check timed out; skipping import."
    fi
}

import_helm_release_if_present() {
    local tf_address=$1
    local namespace=$2
    local release_name=$3
    local helm_cmd=${4:-}

    if terraform state show "$tf_address" >/dev/null 2>&1; then
        echo "Helm release '$release_name' already tracked in state ($tf_address)."
        return 0
    fi

    echo "Checking cluster for Helm release '$release_name' in namespace '$namespace'..."
    local release_found="false"

    if [ -n "$helm_cmd" ] && timeout "$HELM_TIMEOUT" bash -lc "$helm_cmd status \"$release_name\" -n \"$namespace\" >/dev/null 2>&1"; then
        release_found="true"
    elif timeout "$KUBECTL_TIMEOUT" bash -lc "$KUBECTL_CMD get secret -n \"$namespace\" -l owner=helm,name=\"$release_name\" -o name --request-timeout=10s | grep -q ."; then
        release_found="true"
    fi

    if [ "$release_found" = "true" ]; then
        echo "Importing existing Helm release '$release_name' into Terraform state ($tf_address)..."
        if ! timeout "$TF_IMPORT_TIMEOUT" terraform import -input=false -lock-timeout=30s "$tf_address" "$namespace/$release_name"; then
            echo "Error: Timed out importing Helm release '$release_name' into state."
            echo "You can retry with larger TF_IMPORT_TIMEOUT (current: $TF_IMPORT_TIMEOUT)."
            exit 1
        fi
    else
        echo "Helm release '$release_name' not found; Terraform will manage creation."
    fi
}

adopt_ingress_class_for_helm() {
    local kubectl_cmd=$1
    local ingress_class_name=${2:-nginx}
    local release_name=${3:-ingress-nginx}
    local release_namespace=${4:-ingress}

    if timeout "$KUBECTL_TIMEOUT" bash -lc "$kubectl_cmd get ingressclass \"$ingress_class_name\" --request-timeout=10s >/dev/null 2>&1"; then
        echo "Adopting existing IngressClass '$ingress_class_name' for Helm release '$release_name'..."
        timeout "$KUBECTL_TIMEOUT" bash -lc "$kubectl_cmd label ingressclass \"$ingress_class_name\" app.kubernetes.io/managed-by=Helm --overwrite >/dev/null"
        timeout "$KUBECTL_TIMEOUT" bash -lc "$kubectl_cmd annotate ingressclass \"$ingress_class_name\" meta.helm.sh/release-name=\"$release_name\" --overwrite >/dev/null"
        timeout "$KUBECTL_TIMEOUT" bash -lc "$kubectl_cmd annotate ingressclass \"$ingress_class_name\" meta.helm.sh/release-namespace=\"$release_namespace\" --overwrite >/dev/null"

        local managed_by
        local actual_release_name
        local actual_release_namespace
        managed_by=$(timeout "$KUBECTL_TIMEOUT" bash -lc "$kubectl_cmd get ingressclass \"$ingress_class_name\" -o jsonpath='{.metadata.labels.app\\.kubernetes\\.io/managed-by}' --request-timeout=10s" || true)
        actual_release_name=$(timeout "$KUBECTL_TIMEOUT" bash -lc "$kubectl_cmd get ingressclass \"$ingress_class_name\" -o jsonpath='{.metadata.annotations.meta\\.helm\\.sh/release-name}' --request-timeout=10s" || true)
        actual_release_namespace=$(timeout "$KUBECTL_TIMEOUT" bash -lc "$kubectl_cmd get ingressclass \"$ingress_class_name\" -o jsonpath='{.metadata.annotations.meta\\.helm\\.sh/release-namespace}' --request-timeout=10s" || true)

        if [ "$managed_by" != "Helm" ] || [ "$actual_release_name" != "$release_name" ] || [ "$actual_release_namespace" != "$release_namespace" ]; then
            echo "Error: IngressClass '$ingress_class_name' ownership metadata did not converge to expected values."
            echo "  managed-by='$managed_by' release-name='$actual_release_name' release-namespace='$actual_release_namespace'"
            exit 1
        fi
        echo "IngressClass '$ingress_class_name' ownership metadata verified."
    else
        echo "IngressClass '$ingress_class_name' not found or check timed out; skipping adoption."
    fi
}

KUBECONFIG_PATH="$(resolve_kubeconfig_path || true)"
if [ -z "$KUBECONFIG_PATH" ]; then
    echo "Error: Could not resolve a valid kubeconfig file."
    echo "Set KUBECONFIG to a valid file path, or ensure 'microk8s config' is accessible."
    exit 1
fi

export KUBECONFIG="$KUBECONFIG_PATH"
export TF_VAR_kubeconfig_path="$KUBECONFIG_PATH"
echo "Using kubeconfig: $KUBECONFIG_PATH"

KUBECTL_TIMEOUT="${KUBECTL_TIMEOUT:-20s}"
TF_IMPORT_TIMEOUT="${TF_IMPORT_TIMEOUT:-60s}"
HELM_TIMEOUT="${HELM_TIMEOUT:-20s}"

cd "$TF_DIR"

echo "Loading secrets from .secrets file..."
load_secrets

ARGO_PASSWORD="${ARGO_ADMIN_PASSWORD:-${ARGO_PASSWORD:-optimistic-tanuki}}"
DOMAIN="${DOMAIN:-localhost}"
CLUSTER_NAME="${CLUSTER_NAME:-optimistic-tanuki}"
INGRESS_SERVICE_TYPE="${INGRESS_SERVICE_TYPE:-LoadBalancer}"
APP_NAMESPACE="${APP_NAMESPACE:-optimistic-tanuki}"
TF_AUTO_APPROVE="${TF_AUTO_APPROVE:-true}"
TF_SKIP_PLAN="${TF_SKIP_PLAN:-false}"
HELM_IMPORT_EXISTING="${HELM_IMPORT_EXISTING:-true}"
ADOPT_EXISTING_INGRESS_CLASS="${ADOPT_EXISTING_INGRESS_CLASS:-true}"
TAILSCALE_OAUTH_CLIENT_ID="${TAILSCALE_OAUTH_CLIENT_ID:-$TF_VAR_tailscale_oauth_client_id}"
TAILSCALE_OAUTH_CLIENT_SECRET="${TAILSCALE_OAUTH_CLIENT_SECRET:-$TF_VAR_tailscale_oauth_client_secret}"
TAILSCALE_FQDN="${TAILSCALE_FQDN:-$TF_VAR_tailscale_fqdn}"
TAILSCALE_OPERATOR_VERSION="${TAILSCALE_OPERATOR_VERSION:-1.94.2}"

export TF_VAR_argo_admin_password="$ARGO_PASSWORD"
export TF_VAR_domain="$DOMAIN"
export TF_VAR_cluster_name="$CLUSTER_NAME"
export TF_VAR_ingress_service_type="$INGRESS_SERVICE_TYPE"
export TF_VAR_app_namespace="$APP_NAMESPACE"
export TF_VAR_tailscale_oauth_client_id="${TAILSCALE_OAUTH_CLIENT_ID:-}"
export TF_VAR_tailscale_oauth_client_secret="${TAILSCALE_OAUTH_CLIENT_SECRET:-}"
export TF_VAR_tailscale_fqdn="${TAILSCALE_FQDN:-}"
export TF_VAR_tailscale_operator_version="$TAILSCALE_OPERATOR_VERSION"

echo "Initializing Terraform..."
terraform init -input=false

HELM_CMD="$(get_helm_cmd || true)"
if [ -n "$HELM_CMD" ]; then
    echo "Ensuring tailscale helm repo is available..."
    $HELM_CMD repo add tailscale https://pkgs.tailscale.com/helmcharts 2>/dev/null || true
    $HELM_CMD repo update 2>/dev/null || true
fi

KUBECTL_CMD="$(get_kubectl_cmd || true)"
if [ -n "$KUBECTL_CMD" ]; then
    import_namespace_if_present "kubernetes_namespace_v1.argo_ns" "${ARGO_NAMESPACE:-argocd}" "$KUBECTL_CMD"
    import_namespace_if_present "kubernetes_namespace_v1.ingress_ns" "${INGRESS_NAMESPACE:-ingress}" "$KUBECTL_CMD"
    import_namespace_if_present "kubernetes_namespace_v1.app_ns" "${APP_NAMESPACE:-optimistic-tanuki}" "$KUBECTL_CMD"
    import_namespace_if_present "kubernetes_namespace_v1.tailscale_ns" "tailscale" "$KUBECTL_CMD"

    if [ "$ADOPT_EXISTING_INGRESS_CLASS" = "true" ]; then
        adopt_ingress_class_for_helm "$KUBECTL_CMD" "${INGRESS_CLASS_NAME:-nginx}" "${INGRESS_RELEASE_NAME:-ingress-nginx}" "${INGRESS_NAMESPACE:-ingress}"
    fi
else
    echo "Warning: kubectl not available; skipping pre-import of existing namespaces."
fi

if [ "$HELM_IMPORT_EXISTING" = "true" ]; then
    HELM_CMD="$(get_helm_cmd || true)"
    if [ -z "$HELM_CMD" ]; then
        echo "helm CLI not available; using kubectl-based Helm release detection."
    fi
    import_helm_release_if_present "helm_release.argocd" "${ARGO_NAMESPACE:-argocd}" "${ARGO_RELEASE_NAME:-argocd}" "$HELM_CMD"
    import_helm_release_if_present "helm_release.ingress_nginx" "${INGRESS_NAMESPACE:-ingress}" "${INGRESS_RELEASE_NAME:-ingress-nginx}" "$HELM_CMD"
    import_helm_release_if_present "helm_release.tailscale_operator[0]" "tailscale" "tailscale-operator" "$HELM_CMD"
fi

import_pvc_if_present() {
    local tf_address=$1
    local namespace=$2
    local pvc_name=$3

    if terraform state show "$tf_address" >/dev/null 2>&1; then
        echo "PVC '$pvc_name' already tracked in state ($tf_address)."
        return 0
    fi

    echo "Checking cluster for PVC '$pvc_name' in namespace '$namespace'..."
    if timeout "$KUBECTL_TIMEOUT" bash -lc "$KUBECTL_CMD get pvc \"$pvc_name\" -n \"$namespace\" --request-timeout=10s >/dev/null 2>&1"; then
        echo "Importing existing PVC '$pvc_name' into Terraform state ($tf_address)..."
        if ! timeout "$TF_IMPORT_TIMEOUT" terraform import -input=false -lock-timeout=30s "$tf_address" "$namespace/$pvc_name"; then
            echo "Warning: Failed to import PVC '$pvc_name'. Continuing..."
        fi
    fi
}

import_service_if_present() {
    local tf_address=$1
    local namespace=$2
    local svc_name=$3

    if terraform state show "$tf_address" >/dev/null 2>&1; then
        echo "Service '$svc_name' already tracked in state ($tf_address)."
        return 0
    fi

    echo "Checking cluster for service '$svc_name' in namespace '$namespace'..."
    if timeout "$KUBECTL_TIMEOUT" bash -lc "$KUBECTL_CMD get service \"$svc_name\" -n \"$namespace\" --request-timeout=10s >/dev/null 2>&1"; then
        echo "Importing existing service '$svc_name' into Terraform state ($tf_address)..."
        if ! timeout "$TF_IMPORT_TIMEOUT" terraform import -input=false -lock-timeout=30s "$tf_address" "$namespace/$svc_name"; then
            echo "Warning: Failed to import service '$svc_name'. Continuing..."
        fi
    fi
}

import_secret_if_present() {
    local tf_address=$1
    local namespace=$2
    local secret_name=$3

    if terraform state show "$tf_address" >/dev/null 2>&1; then
        echo "Secret '$secret_name' already tracked in state ($tf_address)."
        return 0
    fi

    echo "Checking cluster for secret '$secret_name' in namespace '$namespace'..."
    if timeout "$KUBECTL_TIMEOUT" bash -lc "$KUBECTL_CMD get secret \"$secret_name\" -n \"$namespace\" --request-timeout=10s >/dev/null 2>&1"; then
        echo "Importing existing secret '$secret_name' into Terraform state ($tf_address)..."
        if ! timeout "$TF_IMPORT_TIMEOUT" terraform import -input=false -lock-timeout=30s "$tf_address" "$namespace/$secret_name"; then
            echo "Warning: Failed to import secret '$secret_name'. Continuing..."
        fi
    fi
}

if [ -n "$KUBECTL_CMD" ]; then
    echo ""
    echo "Importing existing app resources..."
    import_pvc_if_present "kubernetes_persistent_volume_claim.postgres_pvc" "$APP_NAMESPACE" "postgres-pvc"
    import_pvc_if_present "kubernetes_persistent_volume_claim.redis_pvc" "$APP_NAMESPACE" "redis-pvc"
    import_pvc_if_present "kubernetes_persistent_volume_claim.seaweedfs_pvc" "$APP_NAMESPACE" "seaweedfs-pvc"
    import_service_if_present "kubernetes_service.postgres" "$APP_NAMESPACE" "postgres"
    import_service_if_present "kubernetes_service.redis" "$APP_NAMESPACE" "redis"
    import_service_if_present "kubernetes_service.seaweedfs" "$APP_NAMESPACE" "seaweedfs"
    import_secret_if_present "kubernetes_secret.app_secrets" "$APP_NAMESPACE" "optimistic-tanuki-secrets"
fi

echo ""
if [ "$TF_SKIP_PLAN" = "true" ]; then
    echo "Skipping explicit terraform plan (TF_SKIP_PLAN=true)."
    if [ "$TF_AUTO_APPROVE" = "true" ]; then
        terraform apply -input=false -auto-approve -lock-timeout=5m \
            -var="argo_admin_password=$ARGO_PASSWORD" \
            -var="domain=$DOMAIN" \
            -var="cluster_name=$CLUSTER_NAME" \
            -var="ingress_service_type=$INGRESS_SERVICE_TYPE" \
            -var="app_namespace=$APP_NAMESPACE" \
            -var="tailscale_oauth_client_id=$TAILSCALE_OAUTH_CLIENT_ID" \
            -var="tailscale_oauth_client_secret=$TAILSCALE_OAUTH_CLIENT_SECRET" \
            -var="tailscale_fqdn=$TAILSCALE_FQDN" \
            -var="tailscale_operator_version=$TAILSCALE_OPERATOR_VERSION"
    else
        terraform apply -input=false -lock-timeout=5m \
            -var="argo_admin_password=$ARGO_PASSWORD" \
            -var="domain=$DOMAIN" \
            -var="cluster_name=$CLUSTER_NAME" \
            -var="ingress_service_type=$INGRESS_SERVICE_TYPE" \
            -var="app_namespace=$APP_NAMESPACE" \
            -var="tailscale_oauth_client_id=$TAILSCALE_OAUTH_CLIENT_ID" \
            -var="tailscale_oauth_client_secret=$TAILSCALE_OAUTH_CLIENT_SECRET" \
            -var="tailscale_fqdn=$TAILSCALE_FQDN" \
            -var="tailscale_operator_version=$TAILSCALE_OPERATOR_VERSION"
    fi
else
    echo "Planning Terraform deployment..."
    terraform plan -input=false -out=tfplan \
        -var="argo_admin_password=$ARGO_PASSWORD" \
        -var="domain=$DOMAIN" \
        -var="cluster_name=$CLUSTER_NAME" \
        -var="ingress_service_type=$INGRESS_SERVICE_TYPE" \
        -var="app_namespace=$APP_NAMESPACE" \
        -var="tailscale_oauth_client_id=$TAILSCALE_OAUTH_CLIENT_ID" \
        -var="tailscale_oauth_client_secret=$TAILSCALE_OAUTH_CLIENT_SECRET" \
        -var="tailscale_fqdn=$TAILSCALE_FQDN" \
        -var="tailscale_operator_version=$TAILSCALE_OPERATOR_VERSION"

    echo "Applying Terraform configuration..."
    if [ "$TF_AUTO_APPROVE" = "true" ]; then
        terraform apply -input=false -auto-approve -lock-timeout=5m tfplan
    else
        terraform apply -input=false -lock-timeout=5m tfplan
    fi
fi

echo "Terraform apply completed successfully!"

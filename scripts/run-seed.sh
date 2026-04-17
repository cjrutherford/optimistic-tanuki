#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=========================================="
echo "Seed Script Runner"
echo "=========================================="

KUBECTL_CMD="kubectl"
if command -v microk8s kubectl &> /dev/null; then
    KUBECTL_CMD="microk8s kubectl"
fi

NAMESPACE="${NAMESPACE:-optimistic-tanuki}"
DEPLOY_TARGET="${DEPLOY_TARGET:-}"
SEED_TARGET="${SEED_TARGET:-all}"

normalize_seed_choice() {
    case "$1" in
        1|permissions) echo "permissions" ;;
        2|social) echo "social" ;;
        3|telos-docs|telos-docs-service) echo "telos-docs" ;;
        4|store) echo "store" ;;
        5|app-configurator) echo "app-configurator" ;;
        6|all) echo "all" ;;
        *) echo "" ;;
    esac
}

run_seed_k8s() {
    local app=$1
    local seed_command=$2
    
    echo "Running seed for $app..."
    
    local pod_name=$($KUBECTL_CMD get pods -n "$NAMESPACE" -l app="$app" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    
    if [ -z "$pod_name" ]; then
        echo "Warning: No pod found for $app, skipping seed"
        return
    fi
    
    echo "Executing seed in pod: $pod_name"
    $KUBECTL_CMD exec -n "$NAMESPACE" "$pod_name" -- sh -c "$seed_command" || \
        echo "Warning: Seed failed for $app"
}

run_seed_docker() {
    local service=$1
    local seed_command=$2
    
    echo "Running seed for $service in Docker..."
    cd "$PROJECT_DIR"
    docker compose exec -T "$service" sh -c "$seed_command" 2>/dev/null || \
        echo "Warning: Seed failed for $service"
}

run_seed_local() {
    local app=$1
    local seed_command=$2
    
    echo "Running seed for $app locally..."
    cd "$PROJECT_DIR/apps/$app"
    eval "$seed_command" 2>/dev/null || \
        echo "Warning: Seed failed for $app"
    cd "$PROJECT_DIR"
}

main() {
    local choice
    case "$DEPLOY_TARGET" in
        k8s|kubernetes) choice="1" ;;
        docker|compose) choice="2" ;;
        local) choice="3" ;;
        "")
            echo "Select deployment environment:"
            echo "1) Kubernetes (k8s)"
            echo "2) Docker Compose"
            echo "3) Local (native)"
            echo ""
            read -r -p "Enter choice [1-3]: " choice
            ;;
        *)
            echo "Error: Unsupported DEPLOY_TARGET '$DEPLOY_TARGET'"
            exit 1
            ;;
    esac

    local seed_choice
    seed_choice=$(normalize_seed_choice "$SEED_TARGET")
    if [ -z "$seed_choice" ]; then
        echo ""
        echo "Available seed scripts:"
        echo "1) permissions - Seed permissions, roles, and app scopes"
        echo "2) social - Seed social data (users, posts, comments, communities)"
        echo "3) telos-docs - Seed personas"
        echo "4) store - Seed store data"
        echo "5) app-configurator - Seed app configurator data"
        echo "6) all - Run all seed scripts"
        echo ""
        read -r -p "Enter choice [1-6]: " seed_input
        seed_choice=$(normalize_seed_choice "$seed_input")
    fi

    if [ -z "$seed_choice" ]; then
        echo "Invalid seed choice. Exiting."
        exit 1
    fi
    
    case $choice in
        1)
            echo "Running in Kubernetes mode..."
            case $seed_choice in
                permissions) run_seed_k8s "permissions" "node /usr/src/app/seed-permissions.js" ;;
                social) run_seed_k8s "social" "node /usr/src/app/seed-social.js" ;;
                telos-docs) run_seed_k8s "telos-docs-service" "node /usr/src/app/seed-persona.js" ;;
                store) run_seed_k8s "store" "node /usr/src/app/seed-store.js" ;;
                app-configurator) run_seed_k8s "app-configurator" "node seed-data/seed-script.js" ;;
                all)
                    run_seed_k8s "permissions" "node /usr/src/app/seed-permissions.js"
                    run_seed_k8s "social" "node /usr/src/app/seed-social.js"
                    run_seed_k8s "telos-docs-service" "node /usr/src/app/seed-persona.js"
                    run_seed_k8s "store" "node /usr/src/app/seed-store.js"
                    run_seed_k8s "app-configurator" "node seed-data/seed-script.js"
                    ;;
                *) echo "Invalid seed choice"; exit 1 ;;
            esac
            ;;
        2)
            echo "Running in Docker Compose mode..."
            case $seed_choice in
                permissions) run_seed_docker "permissions" "node /usr/src/app/seed-permissions.js" ;;
                social) run_seed_docker "social" "node /usr/src/app/seed-social.js" ;;
                telos-docs) run_seed_docker "telos-docs-service" "node /usr/src/app/seed-persona.js" ;;
                store) run_seed_docker "store" "node /usr/src/app/seed-store.js" ;;
                app-configurator) run_seed_docker "app-configurator" "node seed-data/seed-script.js" ;;
                all)
                    run_seed_docker "permissions" "node /usr/src/app/seed-permissions.js"
                    run_seed_docker "social" "node /usr/src/app/seed-social.js"
                    run_seed_docker "telos-docs-service" "node /usr/src/app/seed-persona.js"
                    run_seed_docker "store" "node /usr/src/app/seed-store.js"
                    run_seed_docker "app-configurator" "node seed-data/seed-script.js"
                    ;;
                *) echo "Invalid seed choice"; exit 1 ;;
            esac
            ;;
        3)
            echo "Running in Local mode..."
            case $seed_choice in
                permissions) run_seed_local "permissions" "node src/app/seed-permissions.js" ;;
                social) run_seed_local "social" "node src/seed-social.js" ;;
                telos-docs) run_seed_local "telos-docs-service" "node src/app/seed-persona.js" ;;
                store) run_seed_local "store" "node src/seed-store.js" ;;
                app-configurator) run_seed_local "app-configurator" "node src/seed-data/seed-script.js" ;;
                all)
                    run_seed_local "permissions" "node src/app/seed-permissions.js"
                    run_seed_local "social" "node src/seed-social.js"
                    run_seed_local "telos-docs-service" "node src/app/seed-persona.js"
                    run_seed_local "store" "node src/seed-store.js"
                    run_seed_local "app-configurator" "node src/seed-data/seed-script.js"
                    ;;
                *) echo "Invalid seed choice"; exit 1 ;;
            esac
            ;;
        *)
            echo "Invalid choice. Exiting."
            exit 1
            ;;
    esac
    
    echo ""
    echo "=========================================="
    echo "Seeding complete!"
    echo "=========================================="
}

main "$@"

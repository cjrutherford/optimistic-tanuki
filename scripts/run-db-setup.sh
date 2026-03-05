#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=========================================="
echo "Database Setup & Migration Runner"
echo "=========================================="

KUBECTL_CMD="kubectl"
if command -v microk8s kubectl &> /dev/null; then
    KUBECTL_CMD="microk8s kubectl"
fi

NAMESPACE="${NAMESPACE:-optimistic-tanuki}"
POSTGRES_HOST="${POSTGRES_HOST:-postgres}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}"
DEPLOY_TARGET="${DEPLOY_TARGET:-}"
CREATE_DATABASES="${CREATE_DATABASES:-true}"
RUN_MIGRATIONS="${RUN_MIGRATIONS:-true}"

run_db_setup_in_pod() {
    echo "Running database setup in Kubernetes pod..."

    local postgres_pod
    postgres_pod=$($KUBECTL_CMD get pods -n "$NAMESPACE" -l app=postgres -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)
    if [ -z "$postgres_pod" ]; then
        echo "Error: Could not find postgres pod in namespace $NAMESPACE"
        return 1
    fi

    for db in ot_authentication ot_profile ot_social ot_assets ot_project_planning ot_chat_collector ot_telos_docs_service ot_blogging ot_permissions ot_store ot_app_configurator ot_forum ot_wellness; do
        echo "Ensuring database exists: $db"
        $KUBECTL_CMD exec -n "$NAMESPACE" "$postgres_pod" -- sh -c \
            "psql -U \"$POSTGRES_USER\" -tAc \"SELECT 1 FROM pg_database WHERE datname='$db'\" | grep -q 1 || psql -U \"$POSTGRES_USER\" -c \"CREATE DATABASE $db;\"" 2>/dev/null || true
    done

    echo "Database ensure step complete."
}

run_migrations_in_pod() {
    local app_name=$1
    echo "Running migrations for $app_name..."
    
    local pod_name=$($KUBECTL_CMD get pods -n "$NAMESPACE" -l app="$app_name" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    
    if [ -z "$pod_name" ]; then
        echo "Warning: No pod found for $app_name, skipping migrations"
        return
    fi

    echo "Executing migrations in pod: $pod_name"
    $KUBECTL_CMD exec -n "$NAMESPACE" "$pod_name" -- \
        sh -c "cd /usr/src/app && npm run db:migrate" 2>/dev/null || \
    $KUBECTL_CMD exec -n "$NAMESPACE" "$pod_name" -- \
        node -r ts-node/register -r tsconfig-paths/register ./node_modules/typeorm/cli.js -d ./src/app/staticDatabase.ts migration:run 2>/dev/null || \
        echo "Warning: Could not run migrations for $app_name"
}

run_db_setup_docker() {
    echo "Running database setup via Docker..."

    cd "$PROJECT_DIR"
    
    export POSTGRES_HOST=db
    export POSTGRES_USER=postgres
    export POSTGRES_PASSWORD=postgres
    
    bash ./create-dbs.sh
}

run_migrations_docker() {
    echo "Running migrations via Docker..."
    
    cd "$PROJECT_DIR"
    
    export POSTGRES_HOST=db
    export POSTGRES_USER=postgres
    export POSTGRES_PASSWORD=postgres
    export NODE_ENV=development
    
    ADDITIONAL_DBS=ot_authentication,ot_profile,ot_social,ot_assets,ot_project_planning,ot_chat_collector,ot_telos_docs_service,ot_blogging,ot_permissions,ot_store,ot_app_configurator,ot_forum,ot_wellness
    
    for db_with_prefix in $(echo $ADDITIONAL_DBS | tr ',' ' '); do
        app_name=$(echo $db_with_prefix | sed 's/^ot_//' | tr '_' '-')
        
        if [ -d "./apps/$app_name" ]; then
            echo "Running migrations for $app_name (Database: $db_with_prefix)"
            export POSTGRES_DB=$db_with_prefix
            
            cd "./apps/$app_name"
            export TS_NODE_PROJECT=./tsconfig.app.json
            docker compose exec -T app node -r ts-node/register -r tsconfig-paths/register ../../node_modules/typeorm/cli.js -d ./src/app/staticDatabase.ts migration:run 2>/dev/null || \
                docker compose exec -T $app_name node -r ts-node/register ../../node_modules/typeorm/cli.js -d ./src/app/staticDatabase.ts migration:run 2>/dev/null || \
                echo "Warning: Could not run migrations for $app_name"
            cd - > /dev/null
        fi
    done
    
    cd "$PROJECT_DIR"
    echo "Migrations complete."
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
    
    case $choice in
        1)
            echo "Running in Kubernetes mode..."

            if [ "$CREATE_DATABASES" = "true" ]; then
                run_db_setup_in_pod
            fi

            if [ "$RUN_MIGRATIONS" = "true" ]; then
                for app in authentication profile social assets project-planning chat-collector telos-docs-service blogging permissions store app-configurator forum wellness; do
                    run_migrations_in_pod $app
                done
            fi
            ;;
        2)
            echo "Running in Docker Compose mode..."

            if [ "$CREATE_DATABASES" = "true" ]; then
                run_db_setup_docker
            fi

            if [ "$RUN_MIGRATIONS" = "true" ]; then
                run_migrations_docker
            fi
            ;;
        3)
            echo "Running in Local mode..."

            cd "$PROJECT_DIR"

            if [ "$CREATE_DATABASES" = "true" ]; then
                export POSTGRES_HOST=127.0.0.1
                export POSTGRES_USER=postgres
                export POSTGRES_PASSWORD=postgres
                bash ./create-dbs.sh
            fi

            if [ "$RUN_MIGRATIONS" = "true" ]; then
                export POSTGRES_HOST=127.0.0.1
                export POSTGRES_USER=postgres
                export POSTGRES_PASSWORD=postgres
                export NODE_ENV=development
                bash ./setup-and-migrate.sh
            fi
            ;;
        *)
            echo "Invalid choice. Exiting."
            exit 1
            ;;
    esac
    
    echo ""
    echo "=========================================="
    echo "Database setup complete!"
    echo "=========================================="
}

main "$@"

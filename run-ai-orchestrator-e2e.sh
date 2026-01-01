#!/bin/bash
set -e

COMPOSE_FILE="docker-compose.e2e.ai-orchestrator.yaml"
CONTAINER_NAME="ot_telos_docs_service_e2e"

echo "Starting E2E stack..."
docker compose -f $COMPOSE_FILE up -d

echo "Waiting for telos-docs-service to be healthy..."
timeout=120
while [ $timeout -gt 0 ]; do
    HEALTH=$(docker inspect -f '{{.State.Health.Status}}' $CONTAINER_NAME 2>/dev/null || echo "not_found")
    if [ "$HEALTH" == "healthy" ]; then
        echo "telos-docs-service is healthy."
        break
    fi
    echo "Waiting for health check... ($HEALTH)"
    sleep 5
    timeout=$((timeout-5))
done

if [ $timeout -le 0 ]; then
    echo "Timeout waiting for services to be healthy."
    exit 1
fi

echo "Running seed script..."
docker compose -f $COMPOSE_FILE exec telos-docs-service node seed-persona.js

echo "Running E2E tests..."
npx nx e2e ai-orchestrator-e2e

echo "Tests completed."
# Optional: Tear down
# docker compose -f $COMPOSE_FILE down

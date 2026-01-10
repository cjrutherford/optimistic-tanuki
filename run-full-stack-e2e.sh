#!/bin/bash
set -euo pipefail

# Helper script to run the full-stack Playwright E2E suite against
# the main Docker Compose stack, using manual lifecycle (option B).
#
# Responsibilities:
# - Clean the main stack containers and named volumes
# - Start the main stack with docker compose
# - Wait for the gateway service healthcheck to pass
# - Run `nx e2e full-stack-e2e`, forwarding any extra CLI args
#
# Example usages:
#   ./run-full-stack-e2e.sh
#   ./run-full-stack-e2e.sh -- --project=client-interface-fullstack
#   ./run-full-stack-e2e.sh -- --project=client-interface-fullstack -- --headed

GATEWAY_CONTAINER="ot_gateway"
STACK_NAME="main stack"

echo "[full-stack-e2e] Cleaning ${STACK_NAME} containers and volumes..."
# Best-effort cleanup; ignore errors if nothing is running yet.
if ! docker compose down -v 2>/dev/null; then
  echo "[full-stack-e2e] No existing ${STACK_NAME} to clean or cleanup failed; continuing..."
fi

echo "[full-stack-e2e] Starting ${STACK_NAME} with docker compose up -d --build..."
docker compose up -d --build

# Wait for the gateway healthcheck to report healthy; this implicitly
# waits for most dependent services that the gateway depends_on.
echo "[full-stack-e2e] Waiting for gateway container (${GATEWAY_CONTAINER}) to be healthy..."

timeout=300
interval=5
while [ ${timeout} -gt 0 ]; do
  HEALTH=$(docker inspect -f '{{.State.Health.Status}}' "${GATEWAY_CONTAINER}" 2>/dev/null || echo "not_found")
  if [ "${HEALTH}" == "healthy" ]; then
    echo "[full-stack-e2e] Gateway is healthy."
    break
  fi
  echo "[full-stack-e2e] Gateway health: ${HEALTH} (remaining ${timeout}s)"
  sleep ${interval}
  timeout=$((timeout-interval))
done

if [ ${timeout} -le 0 ]; then
  echo "[full-stack-e2e] Timeout waiting for gateway to become healthy."
  exit 1
fi

echo "[full-stack-e2e] Running Playwright full-stack E2E tests via Nx..."
# Forward all script arguments to Nx so callers can specify
# Playwright project filters, headed/headless, grep tags, etc.
# Example: ./run-full-stack-e2e.sh -- --project=client-interface-fullstack -- --headed
npx nx e2e full-stack-e2e "$@"

echo "[full-stack-e2e] Tests completed. The ${STACK_NAME} is still running."
echo "[full-stack-e2e] To stop and remove containers + volumes, run:"
echo "  docker compose down -v"
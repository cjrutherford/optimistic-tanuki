#!/usr/bin/env bash
# Start services required for AI e2e tests and wait for ports
set -euo pipefail

# Compose files (development stack) - adjust if your environment differs
COMPOSE_FILE="docker-compose.e2e.ai-orchestrator.yaml"

# Bring up the stack in detached mode using Docker's Compose v2 (`docker compose`)
printf "Starting e2e docker compose services (%s)...\n" "$COMPOSE_FILE"
docker compose -f "$COMPOSE_FILE" up -d

# Ports to wait for on the host (profile, ai-orchestrator)
# Note: the MCP server runs on the compose network and does not expose a host port.
PORTS=(3002 3010)

printf "Waiting for services to accept connections on host ports...\n"
for port in "${PORTS[@]}"; do
  echo -n "Waiting for port ${port}... "
  for i in {1..60}; do
    if nc -z localhost ${port}; then
      echo "ok"
      break
    fi
    sleep 1
    echo -n .
  done
  if ! nc -z localhost ${port}; then
    echo "\nTimed out waiting for port ${port}. Check docker compose logs for errors."
    exit 1
  fi
done

printf "All required services are up.\n"

#!/bin/sh

set -eu

COMPOSE_ENV_FILE="${COMPOSE_ENV_FILE:-}"
GATEWAY_API_URL="${GATEWAY_API_URL:-http://gateway:3000/api}"
GATEWAY_BASE_URL="${GATEWAY_BASE_URL:-http://gateway:3000}"
HOST_GATEWAY_BASE_URL="${HOST_GATEWAY_BASE_URL:-http://127.0.0.1:3000}"
APP_RUNTIME_DIR="/usr/src/app"
BUSINESS_SITE_RUNTIME_DIR="/app"

compose_cmd() {
  if [ -n "$COMPOSE_ENV_FILE" ]; then
    docker compose --env-file "$COMPOSE_ENV_FILE" -f docker-compose.yaml "$@"
  else
    docker compose -f docker-compose.yaml "$@"
  fi
}

if [ -n "${HOST_GATEWAY_READY_URL:-}" ]; then
  :
else
  HOST_GATEWAY_READY_URL="${HOST_GATEWAY_BASE_URL}/api-docs"
fi

run_seed() {
  service="$1"
  workdir="$2"
  shift 2

  echo "Seeding ${service}..."
  compose_cmd exec -T -w "${workdir}" "$service" "$@"
}

run_seed_with_env() {
  service="$1"
  workdir="$2"
  env_key="$3"
  env_value="$4"
  shift 4

  echo "Seeding ${service}..."
  compose_cmd exec -T -e "${env_key}=${env_value}" -w "${workdir}" "$service" "$@"
}

restart_service() {
  service="$1"

  echo "Restarting ${service}..."
  compose_cmd restart "$service"
}

wait_for_gateway() {
  attempts="${1:-60}"
  delay_seconds="${2:-2}"

  echo "Waiting for gateway at ${HOST_GATEWAY_READY_URL}..."

  while [ "${attempts}" -gt 0 ]; do
    auth_status="$(
      curl -s -o /dev/null -w '%{http_code}' \
        -H 'content-type: application/json' \
        -d '{}' \
        "${HOST_GATEWAY_BASE_URL}/api/authentication/login" || true
    )"

    if curl -fsS "${HOST_GATEWAY_READY_URL}" >/dev/null 2>&1 &&
      [ "${auth_status}" = "400" ]; then
      echo "Gateway is ready."
      return 0
    fi

    attempts=$((attempts - 1))
    sleep "${delay_seconds}"
  done

  echo "Gateway did not become ready in time." >&2
  return 1
}

echo "=========================================="
echo "Production Seed Script"
echo "=========================================="

if [ -n "$COMPOSE_ENV_FILE" ]; then
  echo "Using compose env file: $COMPOSE_ENV_FILE"
fi

echo "Restarting services before seeding..."
restart_service permissions
restart_service gateway
wait_for_gateway
sleep 5

run_seed telos-docs-service "${APP_RUNTIME_DIR}" node ./seed-persona.js
run_seed permissions "${APP_RUNTIME_DIR}" node ./seed-permissions.js

echo "Seeding social service (including local communities)..."
run_seed social "${APP_RUNTIME_DIR}" node ./seed-local-communities.js

echo "Seeding business-site service (including seeded businesses and client workflows)..."
run_seed_with_env business-site "${BUSINESS_SITE_RUNTIME_DIR}" GATEWAY_URL "${GATEWAY_API_URL}" node ./seed-business.mjs

echo ""
echo "=========================================="
echo "Production seeding complete!"
echo "=========================================="

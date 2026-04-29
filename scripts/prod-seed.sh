#!/bin/sh

set -eu

COMPOSE_FILES="-f docker-compose.yaml"
GATEWAY_API_URL="${GATEWAY_API_URL:-http://gateway:3000/api}"
GATEWAY_BASE_URL="${GATEWAY_BASE_URL:-http://gateway:3000}"
HOST_GATEWAY_BASE_URL="${HOST_GATEWAY_BASE_URL:-http://127.0.0.1:3000}"
APP_RUNTIME_DIR="/usr/src/app"

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
  docker compose ${COMPOSE_FILES} exec -T -w "${workdir}" "$service" "$@"
}

restart_service() {
  service="$1"

  echo "Restarting ${service}..."
  docker compose ${COMPOSE_FILES} restart "$service"
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

echo "Restarting services before seeding..."
restart_service permissions
restart_service gateway
sleep 5

run_seed permissions "${APP_RUNTIME_DIR}" node ./seed-permissions.js

echo "Seeding social service (including local communities)..."
run_seed social "${APP_RUNTIME_DIR}" node ./seed-local-communities.js

echo ""
echo "=========================================="
echo "Production seeding complete!"
echo "=========================================="

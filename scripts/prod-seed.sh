#!/bin/sh

set -eu

COMPOSE_ENV_FILE="${COMPOSE_ENV_FILE:-}"
GATEWAY_API_URL="${GATEWAY_API_URL:-http://gateway:3000/api}"
GATEWAY_BASE_URL="${GATEWAY_BASE_URL:-http://gateway:3000}"
HOST_GATEWAY_BASE_URL="${HOST_GATEWAY_BASE_URL:-http://127.0.0.1:3000}"
ADMIN_API_BASE_URL="${ADMIN_API_BASE_URL:-http://127.0.0.1:${ADMIN_API_PORT:-8098}/api}"
SEED_DEMO_BUSINESSES="${SEED_DEMO_BUSINESSES:-false}"
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

# Fail loudly when the owner bootstrap is only partly configured, or when the
# env file spells one of its keys wrong (for example OWNER_BOOTSRAP_EMAIL).
# A silent skip here leaves the deployment without an owner.
OWNER_BOOTSTRAP_CONFIGURED_COUNT=0
OWNER_BOOTSTRAP_MISSING=""
for owner_key in OWNER_BOOTSTRAP_NAME OWNER_BOOTSTRAP_EMAIL OWNER_BOOTSTRAP_PASSWORD; do
  eval "owner_value=\${${owner_key}:-}"
  if [ -n "$owner_value" ]; then
    OWNER_BOOTSTRAP_CONFIGURED_COUNT=$((OWNER_BOOTSTRAP_CONFIGURED_COUNT + 1))
  else
    OWNER_BOOTSTRAP_MISSING="${OWNER_BOOTSTRAP_MISSING} ${owner_key}"
  fi
done

if [ -n "$COMPOSE_ENV_FILE" ] && [ -r "$COMPOSE_ENV_FILE" ]; then
  OWNER_BOOTSTRAP_NEAR_MISSES="$(
    sed -n 's/^[[:space:]]*\(export[[:space:]][[:space:]]*\)\{0,1\}\(OWNER_BOOT[A-Za-z0-9]*_[A-Za-z0-9_]*\)[[:space:]]*=.*/\2/p' "$COMPOSE_ENV_FILE" |
      grep -v -x -e OWNER_BOOTSTRAP_NAME -e OWNER_BOOTSTRAP_EMAIL -e OWNER_BOOTSTRAP_PASSWORD |
      sort -u | tr '\n' ' ' || true
  )"
  if [ -n "${OWNER_BOOTSTRAP_NEAR_MISSES% }" ]; then
    echo "Owner bootstrap key(s) in ${COMPOSE_ENV_FILE} look misspelled: ${OWNER_BOOTSTRAP_NEAR_MISSES% }" >&2
    echo "Expected exactly: OWNER_BOOTSTRAP_NAME, OWNER_BOOTSTRAP_EMAIL, OWNER_BOOTSTRAP_PASSWORD." >&2
    exit 1
  fi
fi

if [ "${OWNER_BOOTSTRAP_CONFIGURED_COUNT}" != "0" ] && [ "${OWNER_BOOTSTRAP_CONFIGURED_COUNT}" != "3" ]; then
  echo "Owner bootstrap is partly configured; missing:${OWNER_BOOTSTRAP_MISSING}" >&2
  exit 1
fi

echo "=========================================="
echo "Production Seed Script"
echo "=========================================="

if [ -n "$COMPOSE_ENV_FILE" ]; then
  echo "Using compose env file: $COMPOSE_ENV_FILE"
fi

echo "Restarting services before seeding..."
echo "Ensuring Civic services are running..."
compose_cmd up -d --no-build clamav civic civic-briefing civic-contributions
restart_service permissions
restart_service gateway
wait_for_gateway
sleep 5

if [ "${OWNER_BOOTSTRAP_CONFIGURED_COUNT}" = "3" ]; then
  echo "Reconciling configured platform owner..."
  pnpm run bootstrap:owner -- --api-base-url "${ADMIN_API_BASE_URL}"
else
  echo "Skipping platform owner bootstrap: none of OWNER_BOOTSTRAP_NAME, OWNER_BOOTSTRAP_EMAIL, OWNER_BOOTSTRAP_PASSWORD are set."
fi

run_seed telos-docs-service "${APP_RUNTIME_DIR}" node ./seed-persona.js
run_seed permissions "${APP_RUNTIME_DIR}" node ./seed-permissions.js
run_seed forum "${APP_RUNTIME_DIR}" node -e 'const { ClientProxyFactory, Transport } = require("@nestjs/microservices"); const { firstValueFrom } = require("rxjs"); (async () => { const client = ClientProxyFactory.create({ transport: Transport.TCP, options: { host: process.env.FORUM_HOST || "forum", port: Number(process.env.FORUM_PORT || 3015) } }); await client.connect(); await firstValueFrom(client.send({ cmd: "SEED_PRODUCTION_FORUM_TOPICS" }, {})); client.close(); })().catch((error) => { console.error(error); process.exit(1); });'

echo "Seeding social service (including local communities)..."
run_seed social "${APP_RUNTIME_DIR}" node ./seed-local-communities.js

if [ "${SEED_DEMO_BUSINESSES}" = "true" ]; then
  echo "Seeding demo business owners, businesses, and client workflows..."
  run_seed_with_env business-site "${BUSINESS_SITE_RUNTIME_DIR}" GATEWAY_URL "${GATEWAY_API_URL}" node ./seed-business.mjs
else
  echo "Skipping demo business seeds; set SEED_DEMO_BUSINESSES=true to enable them."
fi

echo ""
echo "=========================================="
echo "Production seeding complete!"
echo "=========================================="

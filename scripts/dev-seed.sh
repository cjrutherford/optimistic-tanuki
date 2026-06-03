#!/bin/sh

set -eu

COMPOSE_FILES="-f docker-compose.yaml -f docker-compose.dev.yaml"
GATEWAY_API_URL="${GATEWAY_API_URL:-http://gateway:3000/api}"
GATEWAY_BASE_URL="${GATEWAY_BASE_URL:-http://gateway:3000}"
HOST_GATEWAY_BASE_URL="${HOST_GATEWAY_BASE_URL:-http://127.0.0.1:3000}"
APP_RUNTIME_DIR="/usr/src/app"
CLASSIFIEDS_RUNTIME_DIR="/app"

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
  docker compose ${COMPOSE_FILES} exec -T "$service" sh -lc '
    workdir="$1"
    shift
    cd "$workdir"
    exec "$@"
  ' sh "${workdir}" "$@"
}

run_seed_with_run() {
  service="$1"
  workdir="$2"
  shift 2

  echo "Seeding ${service}..."
  docker compose ${COMPOSE_FILES} exec -T "$service" sh -lc '
    workdir="$1"
    shift
    cd "$workdir"
    exec "$@"
  ' sh "${workdir}" "$@"
}

run_seed_with_env() {
  service="$1"
  workdir="$2"
  env_key="$3"
  env_value="$4"
  shift 4

  echo "Seeding ${service}..."
  docker compose ${COMPOSE_FILES} exec -T -e "${env_key}=${env_value}" "$service" sh -lc '
    workdir="$1"
    shift
    cd "$workdir"
    exec "$@"
  ' sh "${workdir}" "$@"
}

run_seed_with_run_env() {
  service="$1"
  workdir="$2"
  env_key="$3"
  env_value="$4"
  shift 4

  echo "Seeding ${service}..."
  docker compose ${COMPOSE_FILES} exec -T -e "${env_key}=${env_value}" "$service" sh -lc '
    workdir="$1"
    shift
    cd "$workdir"
    exec "$@"
  ' sh "${workdir}" "$@"
}

run_seed_from_workspace() {
  service="$1"
  workdir="$2"
  shift 2

  echo "Seeding ${service} from workspace mount..."
  docker compose ${COMPOSE_FILES} exec -T "$service" sh -lc '
    workdir="$1"
    shift
    cd "$workdir"
    exec "$@"
  ' sh "${workdir}" "$@"
}

run_seed_from_workspace_env() {
  service="$1"
  workdir="$2"
  env_key="$3"
  env_value="$4"
  shift 4

  echo "Seeding ${service} from workspace mount..."
  docker compose ${COMPOSE_FILES} exec -T -e "${env_key}=${env_value}" "$service" sh -lc '
    workdir="$1"
    shift
    cd "$workdir"
    exec "$@"
  ' sh "${workdir}" "$@"
}

refresh_service() {
  service="$1"

  echo "Refreshing ${service} with current compose configuration..."
  docker compose ${COMPOSE_FILES} up -d --force-recreate --no-deps "$service"
}

refresh_services() {
  if [ "$#" -eq 0 ]; then
    return 0
  fi

  echo "Refreshing services with current compose configuration..."
  docker compose ${COMPOSE_FILES} up -d --force-recreate --no-deps "$@"
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

wait_for_chat_collector() {
  attempts="${1:-30}"
  delay_seconds="${2:-2}"

  echo "Waiting for chat-collector TCP health check..."

  while [ "${attempts}" -gt 0 ]; do
    if docker compose ${COMPOSE_FILES} exec -T social sh -lc '
      cd "$1"
      node -e "const { ClientProxyFactory, Transport } = require(\"@nestjs/microservices\"); const { firstValueFrom, timeout } = require(\"rxjs\"); (async () => { const client = ClientProxyFactory.create({ transport: Transport.TCP, options: { host: process.env.CHAT_COLLECTOR_HOST || \"chat-collector\", port: Number.parseInt(process.env.CHAT_COLLECTOR_PORT || \"3007\", 10) } }); await client.connect(); const result = await firstValueFrom(client.send({ cmd: \"health-check\" }, {}).pipe(timeout(5000))); client.close(); if (!result || result.status !== \"healthy\") { throw new Error(\"chat-collector returned unhealthy status\"); } })().catch((error) => { console.error(error?.message || error); process.exit(1); });"
    ' sh "${APP_RUNTIME_DIR}" >/dev/null 2>&1; then
      echo "chat-collector is ready."
      return 0
    fi

    attempts=$((attempts - 1))
    sleep "${delay_seconds}"
  done

  echo "chat-collector did not become ready in time." >&2
  return 1
}

refresh_service telos-docs-service
run_seed telos-docs-service "${APP_RUNTIME_DIR}" node ./seed-persona.js
refresh_service permissions
run_seed permissions "${APP_RUNTIME_DIR}" node ./seed-permissions.js
refresh_service gateway
refresh_services store authentication profile social payments assets chat-collector classifieds
run_seed store "${APP_RUNTIME_DIR}" node ./seed-store.js
wait_for_gateway
sleep 15
run_seed_with_env social "${APP_RUNTIME_DIR}" GATEWAY_URL "${GATEWAY_API_URL}" node ./seed-social.js
wait_for_chat_collector
run_seed_with_run social "${APP_RUNTIME_DIR}" node ./seed-local-communities.js
run_seed_with_env social "${APP_RUNTIME_DIR}" GATEWAY_URL "${GATEWAY_API_URL}" node ./seed-community-posts.js
run_seed_with_env classifieds "${CLASSIFIEDS_RUNTIME_DIR}" GATEWAY_URL "${GATEWAY_BASE_URL}" node ./dist/apps/classifieds/seed-classifieds.js
refresh_service payments
run_seed_with_run payments "${APP_RUNTIME_DIR}" node ./seed-products.js
run_seed_from_workspace_env business-site "/app/apps/business-site" GATEWAY_URL "${GATEWAY_API_URL}" node ./src/seed-business.mjs

run_seed_with_media_volume() {
  service="$1"
  workdir="$2"
  shift 2

  echo "Seeding ${service} inside running container..."
  docker compose ${COMPOSE_FILES} exec -T -e "ASSETS_HOST=assets" "$service" sh -lc '
    workdir="$1"
    shift
    cd "$workdir"
    exec "$@"
  ' sh "${workdir}" "$@"
}

run_seed_with_media_volume_from_image() {
  service="$1"
  workdir="$2"
  shift 2

  echo "Seeding ${service} inside running container..."
  docker compose ${COMPOSE_FILES} exec -T -e "ASSETS_HOST=assets" "$service" sh -lc '
    workdir="$1"
    shift
    cd "$workdir"
    exec "$@"
  ' sh "${workdir}" "$@"
}

refresh_service videos
run_seed_with_media_volume videos "${APP_RUNTIME_DIR}" node ./dist/apps/videos/seed-videos.js
# Optional: clear videos db before seeding to avoid duplicate slug issues
# docker exec db psql -U postgres -d ot_videos -c "DELETE FROM video; DELETE FROM channel;"

run_seed_assets() {
  echo "Seeding assets..."
  docker compose ${COMPOSE_FILES} exec -T assets node ./seed-assets.js || true
}

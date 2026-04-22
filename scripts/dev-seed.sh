#!/bin/sh

set -eu

COMPOSE_FILES="-f docker-compose.yaml -f docker-compose.dev.yaml"
GATEWAY_API_URL="${GATEWAY_API_URL:-http://gateway:3000/api}"
GATEWAY_BASE_URL="${GATEWAY_BASE_URL:-http://gateway:3000}"
HOST_GATEWAY_BASE_URL="${HOST_GATEWAY_BASE_URL:-http://127.0.0.1:3000}"
APP_RUNTIME_DIR="/usr/src/app"
CLASSIFIEDS_RUNTIME_DIR="/app/classifieds"

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
  # `docker compose exec` is failing in this dev setup with an OCI cwd error.
  docker compose ${COMPOSE_FILES} run --rm -T --no-deps -w "${workdir}" "$service" "$@"
}

run_seed_with_run() {
  service="$1"
  workdir="$2"
  shift 2

  echo "Seeding ${service}..."
  docker compose ${COMPOSE_FILES} run --rm -T --no-deps -w "${workdir}" "$service" "$@"
}

run_seed_with_env() {
  service="$1"
  workdir="$2"
  env_key="$3"
  env_value="$4"
  shift 4

  echo "Seeding ${service}..."
  docker compose ${COMPOSE_FILES} run --rm -T --no-deps -w "${workdir}" -e "${env_key}=${env_value}" "$service" "$@"
}

run_seed_with_run_env() {
  service="$1"
  workdir="$2"
  env_key="$3"
  env_value="$4"
  shift 4

  echo "Seeding ${service}..."
  docker compose ${COMPOSE_FILES} run --rm -T --no-deps -w "${workdir}" -e "${env_key}=${env_value}" "$service" "$@"
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

run_seed telos-docs-service "${APP_RUNTIME_DIR}" node ./seed-persona.js
run_seed permissions "${APP_RUNTIME_DIR}" node ./seed-permissions.js
restart_service gateway
run_seed store "${APP_RUNTIME_DIR}" node ./seed-store.js
wait_for_gateway
restart_service authentication
restart_service profile
restart_service social
restart_service payments
restart_service assets
restart_service gateway
sleep 15
run_seed_with_env social "${APP_RUNTIME_DIR}" GATEWAY_URL "${GATEWAY_API_URL}" node ./seed-social.js
run_seed_with_run social "${APP_RUNTIME_DIR}" node ./seed-local-communities.js
run_seed_with_env social "${APP_RUNTIME_DIR}" GATEWAY_URL "${GATEWAY_API_URL}" node ./seed-community-posts.js
run_seed_with_env classifieds "${CLASSIFIEDS_RUNTIME_DIR}" GATEWAY_URL "${GATEWAY_BASE_URL}" node ./seed-classifieds.js
run_seed_with_run payments "${APP_RUNTIME_DIR}" node ./seed-products.js

run_seed_with_media_volume() {
  service="$1"
  workdir="$2"
  shift 2

  echo "Seeding ${service} with media volume..."
  docker compose ${COMPOSE_FILES} run --rm -T --no-deps -w "${workdir}" \
    -v /mnt/valhalla/media:/media:ro \
    -e "ASSETS_HOST=assets" \
    "$service" "$@"
}

run_seed_with_media_volume videos "${APP_RUNTIME_DIR}" node ./seed-videos.js
# Optional: clear videos db before seeding to avoid duplicate slug issues
# docker exec db psql -U postgres -d ot_videos -c "DELETE FROM video; DELETE FROM channel;"

run_seed_assets() {
  echo "Seeding assets..."
  docker compose ${COMPOSE_FILES} run --rm -T --no-deps \
    -v /mnt/valhalla/media:/media:ro \
    assets node ./seed-assets.js || true
}

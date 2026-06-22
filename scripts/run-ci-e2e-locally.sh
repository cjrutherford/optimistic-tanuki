#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="e2e/docker-compose.e2e-stack.yaml"
JEST_BIN="./node_modules/.bin/jest"
PLAYWRIGHT_BIN="./node_modules/.bin/playwright"
export NX_DAEMON=false
export NX_ISOLATE_PLUGINS=false
export CI=true
export SKIP_SETUP=true
export PLAYWRIGHT_HEADLESS="${PLAYWRIGHT_HEADLESS:-false}"
export E2E_IMAGE_TAG="${E2E_IMAGE_TAG:-latest}"
export E2E_IMAGE_SOURCE="${E2E_IMAGE_SOURCE:-build}"
export E2E_BUILD_BATCH_SIZE="${E2E_BUILD_BATCH_SIZE:-4}"
export E2E_BUILD_PARALLEL_LIMIT="${E2E_BUILD_PARALLEL_LIMIT:-1}"

MICROSERVICES=(
  authentication-e2e
  profile-e2e
  social-e2e
  assets-e2e
  blogging-e2e
  gateway-e2e
  permissions-e2e
  project-planning-e2e
  chat-collector-e2e
  prompt-proxy-e2e
  telos-docs-service-e2e
  ai-orchestrator-e2e
  app-configurator-e2e
)

UI_SUITES=(
  "client-interface-e2e|client-interface|chromium-desktop|http://127.0.0.1:8080"
  "forgeofwill-e2e|forgeofwill|chromium|http://127.0.0.1:8081"
  "digital-homestead-e2e|digital-homestead|chromium|http://127.0.0.1:8082"
  "christopherrutherford-net-e2e|christopherrutherford-net|chromium|http://127.0.0.1:8083"
  "owner-console-e2e|owner-console|Google Chrome|http://127.0.0.1:8084"
  "store-client-e2e|store-client|chromium|http://127.0.0.1:8085"
  "configurable-client-e2e|configurable-client|chromium|http://127.0.0.1:8090"
)

FAILED_SUITES=()
CURRENT_PID=""
INTERRUPTED=false

cleanup() {
  trap - EXIT INT TERM

  if [ -n "$CURRENT_PID" ]; then
    kill "$CURRENT_PID" >/dev/null 2>&1 || true
    wait "$CURRENT_PID" >/dev/null 2>&1 || true
  fi

  docker compose -f "$COMPOSE_FILE" down -v >/dev/null 2>&1 || true
}

handle_interrupt() {
  INTERRUPTED=true

  if [ -n "$CURRENT_PID" ]; then
    kill "$CURRENT_PID" >/dev/null 2>&1 || true
  fi
}

run_with_interrupts() {
  "$@" &
  CURRENT_PID=$!
  wait "$CURRENT_PID"
  local status=$?
  CURRENT_PID=""

  if [ "$INTERRUPTED" = true ]; then
    return 130
  fi

  return "$status"
}

trap cleanup EXIT
trap handle_interrupt INT TERM

build_services_in_batches() {
  local profile="$1"
  shift
  local services=("$@")

  if ! [[ "$E2E_BUILD_BATCH_SIZE" =~ ^[0-9]+$ ]] || [ "$E2E_BUILD_BATCH_SIZE" -lt 1 ]; then
    echo "E2E_BUILD_BATCH_SIZE must be a positive integer" >&2
    exit 2
  fi

  if ! [[ "$E2E_BUILD_PARALLEL_LIMIT" =~ ^[0-9]+$ ]] || [ "$E2E_BUILD_PARALLEL_LIMIT" -lt 1 ]; then
    echo "E2E_BUILD_PARALLEL_LIMIT must be a positive integer" >&2
    exit 2
  fi

  local build_cmd=(
    ./scripts/docker-build-batched.sh
    "$E2E_BUILD_BATCH_SIZE"
    "$COMPOSE_FILE"
  )

  for service in "${services[@]}"; do
    case "$service" in
      db|redis|db-setup)
        ;;
      *)
        build_cmd+=(--service "$service")
        ;;
    esac
  done

  if [ -n "$profile" ]; then
    echo "Building scoped services for profile $profile via docker-build-batched.sh"
  else
    echo "Building scoped services via docker-build-batched.sh"
  fi

  run_with_interrupts env COMPOSE_PARALLEL_LIMIT="$E2E_BUILD_PARALLEL_LIMIT" DOCKER_BATCH_SIZE="$E2E_BUILD_BATCH_SIZE" "${build_cmd[@]}"
}

start_compose_services() {
  local profile="$1"
  shift
  local services=("$@")
  local compose_args=(-f "$COMPOSE_FILE")

  if [ -n "$profile" ]; then
    compose_args+=(--profile "$profile")
  fi

  case "$E2E_IMAGE_SOURCE" in
    build)
      echo "Building services locally in batches of $E2E_BUILD_BATCH_SIZE with parallel limit $E2E_BUILD_PARALLEL_LIMIT: ${services[*]}"
      build_services_in_batches "$profile" "${services[@]}"
      run_with_interrupts docker compose "${compose_args[@]}" up -d --no-build "${services[@]}"
      return 0
      ;;
    auto)
      echo "Starting services with local images if available: ${services[*]}"
      if run_with_interrupts docker compose "${compose_args[@]}" up -d --no-build "${services[@]}"; then
        return 0
      fi

      echo "Pulling only missing images for: ${services[*]}"
      run_with_interrupts docker compose "${compose_args[@]}" pull --policy missing --quiet "${services[@]}" || true

      if run_with_interrupts docker compose "${compose_args[@]}" up -d --no-build "${services[@]}"; then
        return 0
      fi
      ;;
    pull)
      echo "Pulling only missing images for: ${services[*]}"
      run_with_interrupts docker compose "${compose_args[@]}" pull --policy missing --quiet "${services[@]}" || true

      if run_with_interrupts docker compose "${compose_args[@]}" up -d --no-build "${services[@]}"; then
        return 0
      fi
      ;;
    *)
      echo "Unsupported E2E_IMAGE_SOURCE: $E2E_IMAGE_SOURCE" >&2
      exit 1
      ;;
  esac

  echo "Falling back to local build for: ${services[*]}"

  build_services_in_batches "$profile" "${services[@]}"
  run_with_interrupts docker compose "${compose_args[@]}" up -d --no-build "${services[@]}"
}

run_microservice_suite() {
  local suite="$1"
  local jest_config="apps/${suite}/jest.config.ts"
  echo "=== Running ${suite} ==="
  if run_with_interrupts "$JEST_BIN" --config "$jest_config" --runInBand --passWithNoTests; then
    echo "PASS ${suite}"
  else
    if [ "$INTERRUPTED" = true ]; then
      return 130
    fi
    echo "FAIL ${suite}"
    FAILED_SUITES+=("$suite")
  fi
  echo
}

run_ui_suite() {
  local suite="$1"
  local service="$2"
  local project_name="$3"
  local base_url="$4"
  local playwright_config="apps/${suite}/playwright.config.ts"

  echo "=== Starting ${service} for ${suite} ==="
  start_compose_services "$service" "$service"
  if [ "$INTERRUPTED" = true ]; then
    return 130
  fi
  sleep 20

  echo "=== Running ${suite} (${project_name}) ==="
  if run_with_interrupts env BASE_URL="$base_url" "$PLAYWRIGHT_BIN" test --config "$playwright_config" --project "$project_name"; then
    echo "PASS ${suite}"
  else
    if [ "$INTERRUPTED" = true ]; then
      return 130
    fi
    echo "FAIL ${suite}"
    FAILED_SUITES+=("$suite")
  fi
  echo

  echo "=== Stopping ${service} ==="
  run_with_interrupts docker compose -f "$COMPOSE_FILE" --profile "$service" stop "$service"
  run_with_interrupts docker compose -f "$COMPOSE_FILE" --profile "$service" rm -f "$service"
  echo
}

if [ "$PLAYWRIGHT_HEADLESS" != "true" ] && [ -z "${DISPLAY:-}" ]; then
  echo "Error: PLAYWRIGHT_HEADLESS=false requires a graphical display (DISPLAY is not set)." >&2
  exit 1
fi

echo "=== Resetting shared e2e stack ==="
run_with_interrupts docker compose -f "$COMPOSE_FILE" down -v >/dev/null 2>&1 || true

echo "=== Starting shared backend stack ==="
start_compose_services "" \
  db redis db-setup \
  authentication profile social assets \
  project-planning chat-collector telos-docs-service prompt-proxy \
  ai-orchestrator blogging permissions store app-configurator \
  app-configurator-seed lead-tracker gateway

echo "=== Waiting for shared stack ==="
sleep 60
run_with_interrupts docker compose -f "$COMPOSE_FILE" ps
echo

for suite in "${MICROSERVICES[@]}"; do
  run_microservice_suite "$suite"
done

for entry in "${UI_SUITES[@]}"; do
  IFS='|' read -r suite service project_name base_url <<< "$entry"
  run_ui_suite "$suite" "$service" "$project_name" "$base_url"
done

if [ "$INTERRUPTED" = true ]; then
  exit 130
fi

if [ "${#FAILED_SUITES[@]}" -gt 0 ]; then
  echo "=== Failed e2e suites ==="
  printf '%s\n' "${FAILED_SUITES[@]}"
  exit 1
fi

echo "All shared-stack local CI e2e suites passed."

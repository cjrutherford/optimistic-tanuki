#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="e2e/docker-compose.e2e-stack.yaml"
MANIFEST_SCRIPT="scripts/e2e-environment-manifest.mjs"
READINESS_SCRIPT="scripts/wait-for-e2e-readiness.mjs"
export NX_DAEMON=false
export NX_ISOLATE_PLUGINS=false
export CI=true
export SKIP_SETUP=true
export PLAYWRIGHT_HEADLESS="${PLAYWRIGHT_HEADLESS:-false}"
export E2E_IMAGE_TAG="${E2E_IMAGE_TAG:-latest}"
export E2E_IMAGE_SOURCE="${E2E_IMAGE_SOURCE:-build}"
export E2E_BUILD_BATCH_SIZE="${E2E_BUILD_BATCH_SIZE:-4}"
export E2E_BUILD_PARALLEL_LIMIT="${E2E_BUILD_PARALLEL_LIMIT:-1}"
export E2E_TARGETS="${E2E_TARGETS:-}"
export E2E_NX_ARGS="${E2E_NX_ARGS:-}"

FAILED_TARGETS=()
CURRENT_PID=""
INTERRUPTED=false
export E2E_COMPOSE_PROJECT=""
E2E_COMPOSE_PROFILE=""
E2E_NX_ARGS_ARRAY=()

if [ -n "$E2E_NX_ARGS" ]; then
  read -r -a E2E_NX_ARGS_ARRAY <<< "$E2E_NX_ARGS"
fi

compose() {
  docker compose --project-name "$E2E_COMPOSE_PROJECT" -f "$COMPOSE_FILE" "$@"
}

compose_target() {
  if [ -n "$E2E_COMPOSE_PROFILE" ]; then
    compose --profile "$E2E_COMPOSE_PROFILE" "$@"
  else
    compose "$@"
  fi
}

capture_diagnostics() {
  echo "=== E2E diagnostics for ${1} (before teardown) ===" >&2
  compose_target ps >&2 || true
  compose_target logs --tail 100 >&2 || true
}

capture_target_failure() {
  local target="$1"
  local status="$2"

  if [ "$INTERRUPTED" = true ] || [ "$status" -eq 130 ]; then
    return 130
  fi

  echo "FAIL $target" >&2
  FAILED_TARGETS+=("$target")
  capture_diagnostics "$target"
}

cleanup() {
  trap - EXIT INT TERM

  if [ -n "$CURRENT_PID" ]; then
    kill "$CURRENT_PID" >/dev/null 2>&1 || true
    wait "$CURRENT_PID" >/dev/null 2>&1 || true
  fi

  if [ -n "$E2E_COMPOSE_PROJECT" ]; then
    compose_target down -v >/dev/null 2>&1 || true
  fi
  ./scripts/docker-image-cleanup.sh --keep-tag "$E2E_IMAGE_TAG" >/dev/null 2>&1 || true
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

  # An exact-source run must not reuse a tagged image just because the planner
  # did not observe a source dependency.  This is the local analogue of CI's
  # fresh image build and prevents false passes/failures from stale services.
  local build_cmd=(./scripts/docker-build-batched.sh --full-rebuild "$E2E_BUILD_BATCH_SIZE" "$COMPOSE_FILE")
  if [ -n "$profile" ]; then
    build_cmd+=(--profile "$profile")
  fi
  local service
  for service in "${services[@]}"; do
    case "$service" in
      db|redis|db-setup) ;;
      *) build_cmd+=(--service "$service") ;;
    esac
  done

  if [ "${#build_cmd[@]}" -gt 3 ]; then
    run_with_interrupts env COMPOSE_PARALLEL_LIMIT="$E2E_BUILD_PARALLEL_LIMIT" DOCKER_BATCH_SIZE="$E2E_BUILD_BATCH_SIZE" "${build_cmd[@]}"
  fi
}

prepare_target_images() {
  local profile="$1"
  shift
  local services=("$@")
  local pull_services=()
  local service

  # db-setup is deliberately built locally before any app container starts.
  run_with_interrupts compose build db-setup

  for service in "${services[@]}"; do
    case "$service" in
      db|redis|db-setup) ;;
      *) pull_services+=("$service") ;;
    esac
  done

  case "$E2E_IMAGE_SOURCE" in
    build)
      build_services_in_batches "$profile" "${services[@]}"
      ;;
    auto|pull)
      # Keep the existing local-image preference while limiting pulls to the manifest closure.
      if [ "${#pull_services[@]}" -gt 0 ]; then
        run_with_interrupts compose ${profile:+--profile "$profile"} pull --policy missing --quiet "${pull_services[@]}" || true
      fi
      ;;
    *)
      echo "Unsupported E2E_IMAGE_SOURCE: $E2E_IMAGE_SOURCE" >&2
      exit 2
      ;;
  esac
}

start_target_stack() {
  local target="$1"
  local phase_json phase profile start_with_dependencies
  while IFS= read -r phase_json; do
    phase=$(jq -r '.name' <<< "$phase_json")
    profile=$(jq -r '.profile // empty' <<< "$phase_json")
    start_with_dependencies=$(jq -r '.startWithDependencies // false' <<< "$phase_json")
    mapfile -t phase_services < <(jq -r '.services[]' <<< "$phase_json")
    if [ "$start_with_dependencies" = true ]; then
      run_with_interrupts compose ${profile:+--profile "$profile"} up -d --no-build "${phase_services[@]}" || return $?
    else
      run_with_interrupts compose ${profile:+--profile "$profile"} up -d --no-build --no-deps "${phase_services[@]}" || return $?
    fi
    run_with_interrupts node "$READINESS_SCRIPT" --target "$target" --phase "$phase" || return $?
  done < <(node "$MANIFEST_SCRIPT" --target "$target" --phases | jq -c '.[]')

  run_with_interrupts node "$READINESS_SCRIPT" --target "$target"
}

run_target() {
  local target="$1"
  local target_json
  target_json=$(node "$MANIFEST_SCRIPT" --target "$target")
  local profile base_url safe_target
  profile=$(jq -r '.stack.profile // empty' <<< "$target_json")
  base_url=$(jq -r '.baseUrl' <<< "$target_json")
  mapfile -t services < <(node "$MANIFEST_SCRIPT" --target "$target" --services | jq -r '.[]')

  echo "=== Running $target with manifest-bounded services: ${services[*]} ==="
  safe_target=$(tr '[:upper:]' '[:lower:]' <<< "$target" | tr -cs 'a-z0-9' '-')
  E2E_COMPOSE_PROJECT="ot-e2e-local-${safe_target}-$$"
  E2E_COMPOSE_PROFILE="$profile"
  run_with_interrupts compose_target down -v >/dev/null 2>&1 || true
  if prepare_target_images "$profile" "${services[@]}"; then
    :
  else
    local status=$?
    if ! capture_target_failure "$target" "$status"; then
      return 130
    fi
    run_with_interrupts compose_target down -v || true
    return "$status"
  fi
  if start_target_stack "$target"; then
    :
  else
    local status=$?
    if ! capture_target_failure "$target" "$status"; then
      return 130
    fi
    run_with_interrupts compose_target down -v || true
    return "$status"
  fi

  # `--project` is both a valid Playwright option and an Nx global option.  Keep
  # all optional E2E arguments after Nx's argument separator so they always
  # reach the Playwright executor.
  if run_with_interrupts env BASE_URL="$base_url" pnpm exec nx run "$target:e2e" --configuration=ci -- "${E2E_NX_ARGS_ARRAY[@]}"; then
    echo "PASS $target"
  else
    if [ "$INTERRUPTED" = true ]; then
      return 130
    fi
    local status=$?
    if ! capture_target_failure "$target" "$status"; then
      return 130
    fi
  fi

  run_with_interrupts compose_target down -v
}

if [ "$PLAYWRIGHT_HEADLESS" != "true" ] && [ -z "${DISPLAY:-}" ]; then
  echo "Error: PLAYWRIGHT_HEADLESS=false requires a graphical display (DISPLAY is not set)." >&2
  exit 1
fi

if [ -n "$E2E_TARGETS" ]; then
  IFS=',' read -r -a TARGETS <<< "$E2E_TARGETS"
else
  mapfile -t TARGETS < <(node --input-type=module -e "import { listE2eTargets } from './scripts/e2e-environment-manifest.mjs'; for (const kind of ['microservice', 'ui']) for (const entry of listE2eTargets(kind)) if (entry.ci.enabled) console.log(entry.nx.project);")
fi

for target in "${TARGETS[@]}"; do
  run_target "$target"
  if [ "$INTERRUPTED" = true ]; then
    exit 130
  fi
done

if [ "${#FAILED_TARGETS[@]}" -gt 0 ]; then
  echo "=== Failed E2E targets ==="
  printf '%s\n' "${FAILED_TARGETS[@]}"
  exit 1
fi

echo "All manifest-defined local CI E2E targets passed."

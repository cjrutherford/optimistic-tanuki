#!/usr/bin/env bash
set -euo pipefail

DRY_RUN=0
FULL_RESTART=0
COMPOSE_FILE="docker-compose.yaml"

while [ "$#" -gt 0 ]; do
    case "${1:-}" in
        --dry-run)
            DRY_RUN=1
            shift
            ;;
        --full-restart)
            FULL_RESTART=1
            shift
            ;;
        *)
            break
            ;;
    esac
done

if [[ "${1:-}" == *"docker-compose"* ]]; then
    COMPOSE_FILE="$1"
    shift
fi

PHASE_DELAY=${1:-5}
if [ "$#" -gt 0 ]; then
    shift
fi
EXTRA_FLAGS=("$@")

if ! [[ "$PHASE_DELAY" =~ ^[0-9]+$ ]]; then
    echo "Phase delay must be a non-negative integer" >&2
    exit 2
fi

COMPOSE_FLAGS=("-f" "$COMPOSE_FILE")
if [[ "$COMPOSE_FILE" == *"dev"* ]]; then
    COMPOSE_FLAGS=("-f" "docker-compose.yaml" "-f" "docker-compose.dev.yaml")
fi

PHASE_3_SERVICES=(authentication)
PHASE_4_SERVICES=(profile social permissions app-configurator system-configurator-api)
PHASE_5_SERVICES=(
    finance payments store assets project-planning chat-collector prompt-proxy
    telos-docs-service blogging forum wellness classifieds
)
PHASE_6_SERVICES=(ai-orchestration lead-tracker video-transcoder-worker videos)
PHASE_7_SERVICES=(gateway)
PHASE_9_SERVICES=(
    ot-client-interface forgeofwill-client-interface digital-homestead-client-interface
    hai-client-interface local-hub-client-interface crdn-client-interface leads-app
    store-client configurable-client fin-commander marketing-generator business-site owner-console d6 system-configurator
    video-client
)
REQUIRED_RUNNING_SERVICES=(
    postgres redis
    "${PHASE_3_SERVICES[@]}"
    "${PHASE_4_SERVICES[@]}"
    "${PHASE_5_SERVICES[@]}"
    "${PHASE_6_SERVICES[@]}"
    "${PHASE_7_SERVICES[@]}"
    "${PHASE_9_SERVICES[@]}"
)

echo "=== Phased Docker Startup ==="
echo "Phase delay: ${PHASE_DELAY}s"
echo "Compose file: $COMPOSE_FILE"
echo "Compose flags: ${COMPOSE_FLAGS[*]}"
echo "Extra flags: ${EXTRA_FLAGS[*]:-}"
echo ""

run_compose() {
    if [ "$DRY_RUN" -eq 1 ]; then
        echo "DRY RUN: docker compose ${COMPOSE_FLAGS[*]} $*"
    else
        docker compose "${COMPOSE_FLAGS[@]}" "$@"
    fi
}

wait_for_service() {
    local service="$1"
    local attempts="${2:-60}"
    local delay_seconds="${3:-2}"

    if [ "$DRY_RUN" -eq 1 ]; then
        echo "DRY RUN: wait for services: $service"
        return 0
    fi

    echo "Waiting for ${service} to be running..."

    while [ "$attempts" -gt 0 ]; do
        local container_id
        container_id=$(docker compose "${COMPOSE_FLAGS[@]}" ps -q "$service" 2>/dev/null || true)

        if [ -n "$container_id" ]; then
            local status
            local health
            status=$(docker inspect -f '{{.State.Status}}' "$container_id" 2>/dev/null || true)
            health=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container_id" 2>/dev/null || true)

            if [ "$status" = "running" ] && { [ "$health" = "healthy" ] || [ "$health" = "none" ]; }; then
                echo "${service} is ready."
                return 0
            fi
        fi

        attempts=$((attempts - 1))
        sleep "$delay_seconds"
    done

    echo "${service} did not become ready in time." >&2
    return 1
}

wait_for_services() {
    if [ "$#" -eq 0 ]; then
        return 0
    fi

    for service in "$@"; do
        wait_for_service "$service"
    done
}

list_running_services() {
    if [ "$DRY_RUN" -eq 1 ]; then
        return 0
    fi

    docker compose "${COMPOSE_FLAGS[@]}" ps --services --filter status=running
}

ensure_required_services_running() {
    local running_services="$1"
    local missing_services=()
    local service

    for service in "${REQUIRED_RUNNING_SERVICES[@]}"; do
        if printf '%s\n' "$running_services" | grep -Fx -- "$service" >/dev/null 2>&1; then
            continue
        fi
        missing_services+=("$service")
    done

    if [ "${#missing_services[@]}" -eq 0 ]; then
        return 0
    fi

    if [ "$DRY_RUN" -eq 1 ]; then
        echo "DRY RUN: ensure required services are running: ${missing_services[*]}"
    else
        echo "Ensuring required services are running: ${missing_services[*]}"
    fi

    run_compose up -d "${EXTRA_FLAGS[@]}" "${missing_services[@]}"
    wait_for_services "${missing_services[@]}"
}

STATE_DIR=${DOCKER_BUILD_STATE_DIR:-tmp/docker-compose-state}
PLAN_FILE=${DOCKER_BUILD_PLAN_FILE:-$STATE_DIR/$(basename "$COMPOSE_FILE").plan.json}

restart_from_plan() {
    if [ "$FULL_RESTART" -eq 1 ] || [ ! -f "$PLAN_FILE" ]; then
        return 1
    fi

    local restart_services
    restart_services=$(node -e '
const fs = require("fs");
const plan = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
for (const service of plan.restartServices || []) {
  console.log(service);
}
' "$PLAN_FILE")

    local running_services
    running_services=$(list_running_services)

    if [ "$DRY_RUN" -eq 0 ] && [ -z "$running_services" ]; then
        return 1
    fi

    if [ -z "$restart_services" ]; then
        echo "No changed services require restart"
        ensure_required_services_running "$running_services"
        run_compose ps
        rm -f "$PLAN_FILE"
        exit 0
    fi

    mapfile -t RESTART_ARRAY <<< "$restart_services"
    echo "=== Incremental restart ==="
    run_compose up -d --no-deps "${EXTRA_FLAGS[@]}" "${RESTART_ARRAY[@]}"
    wait_for_services "${RESTART_ARRAY[@]}"
    running_services=$(list_running_services)
    ensure_required_services_running "$running_services"
    echo ""
    run_compose ps
    rm -f "$PLAN_FILE"
    exit 0
}

run_phase() {
    local description="$1"
    local phase_delay="$2"
    shift 2
    local services=("$@")

    if [ "${#services[@]}" -eq 0 ]; then
        return 0
    fi

    echo "=== $description ==="
    run_compose up -d --no-deps "${EXTRA_FLAGS[@]}" "${services[@]}"
    if [ "$DRY_RUN" -eq 0 ] && [ "$phase_delay" -gt 0 ]; then
        sleep "$phase_delay"
    fi
    wait_for_services "${services[@]}"
    echo ""
}

if restart_from_plan; then
    exit 0
fi

echo "=== Phase 1: Infrastructure (postgres, redis) ==="
run_compose up -d "${EXTRA_FLAGS[@]}" postgres redis

echo "Waiting for postgres healthy..."
if [ "$DRY_RUN" -eq 1 ]; then
    echo "DRY RUN: docker compose ${COMPOSE_FLAGS[*]} exec -T postgres pg_isready -U postgres"
else
    until docker compose "${COMPOSE_FLAGS[@]}" exec -T postgres pg_isready -U postgres 2>/dev/null; do
        sleep 2
    done
fi
echo "Postgres is ready"
echo ""

echo "=== Phase 2: db-setup ==="
run_compose up -d "${EXTRA_FLAGS[@]}" db-setup
run_compose wait db-setup
echo ""

run_phase "Phase 3: Core services" "$PHASE_DELAY" "${PHASE_3_SERVICES[@]}"
run_phase "Phase 4: Essential APIs" "$PHASE_DELAY" "${PHASE_4_SERVICES[@]}"
run_phase "Phase 5: Feature services" "$PHASE_DELAY" "${PHASE_5_SERVICES[@]}"
run_phase "Phase 6: Heavy services" "$PHASE_DELAY" "${PHASE_6_SERVICES[@]}"
run_phase "Phase 7: Gateway" "$PHASE_DELAY" "${PHASE_7_SERVICES[@]}"

echo "=== Phase 8: Seed jobs ==="
run_compose up -d "${EXTRA_FLAGS[@]}" app-configurator-seed
run_compose wait app-configurator-seed
echo ""

run_phase "Phase 9: Client interfaces" 0 "${PHASE_9_SERVICES[@]}"

echo "=== Startup complete ==="
run_compose ps

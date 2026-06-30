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

CORE_SERVICES=(
    authentication
)
ESSENTIAL_API_SERVICES=(
    admin-api profile social permissions app-configurator system-configurator-api
)
FEATURE_SERVICES=(
    finance payments store assets project-planning chat-collector prompt-proxy
    telos-docs-service blogging forum wellness classifieds
)
HEAVY_SERVICES=(
    ai-orchestration lead-tracker video-transcoder-worker videos
)
CLIENT_SERVICES=(
    ot-client-interface forgeofwill-client-interface digital-homestead-client-interface
    hai-client-interface local-hub-client-interface crdn-client-interface leads-app
    store-client configurable-client fin-commander marketing-generator business-site
    owner-console d6 system-configurator video-client
)
MANAGED_SERVICES=(
    postgres redis "${CORE_SERVICES[@]}" "${ESSENTIAL_API_SERVICES[@]}"
    "${FEATURE_SERVICES[@]}" "${HEAVY_SERVICES[@]}" gateway
    "${CLIENT_SERVICES[@]}"
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

collect_missing_managed_services() {
    local running_services="$1"
    local configured_services=""
    local missing_services=()
    local service

    if [ "$DRY_RUN" -eq 0 ]; then
        configured_services=$(docker compose "${COMPOSE_FLAGS[@]}" config --services 2>/dev/null || true)
    fi

    for service in "${MANAGED_SERVICES[@]}"; do
        if [ -n "$configured_services" ] && ! printf '%s\n' "$configured_services" | grep -Fxq "$service"; then
            continue
        fi
        if ! printf '%s\n' "$running_services" | grep -Fxq "$service"; then
            missing_services+=("$service")
        fi
    done

    printf '%s\n' "${missing_services[@]}"
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
    if [ "$DRY_RUN" -eq 1 ]; then
        running_services="placeholder"
    else
        running_services=$(docker compose "${COMPOSE_FLAGS[@]}" ps --services --filter status=running)
    fi

    if [ -z "$running_services" ]; then
        return 1
    fi

    local missing_services
    missing_services=$(collect_missing_managed_services "$running_services")

    if [ -z "$restart_services" ] && [ -z "$missing_services" ]; then
        echo "No changed services require restart"
        run_compose ps
        rm -f "$PLAN_FILE"
        exit 0
    fi

    local service
    local existing_service
    local duplicate
    local RESTART_ARRAY=()

    if [ -n "$restart_services" ]; then
        mapfile -t RESTART_ARRAY <<< "$restart_services"
    fi

    if [ -n "$missing_services" ]; then
        while IFS= read -r service; do
            [ -n "$service" ] || continue
            duplicate=0
            for existing_service in "${RESTART_ARRAY[@]}"; do
                if [ "$existing_service" = "$service" ]; then
                    duplicate=1
                    break
                fi
            done
            if [ "$duplicate" -eq 0 ]; then
                RESTART_ARRAY+=("$service")
            fi
        done <<< "$missing_services"
    fi

    if [ -n "$restart_services" ]; then
        echo "=== Incremental restart ==="
    else
        echo "=== Starting missing managed services ==="
    fi
    run_compose up -d --no-deps "${EXTRA_FLAGS[@]}" "${RESTART_ARRAY[@]}"
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

run_phase "Phase 3: Core services" "$PHASE_DELAY" "${CORE_SERVICES[@]}"
run_phase "Phase 4: Essential APIs" "$PHASE_DELAY" \
    "${ESSENTIAL_API_SERVICES[@]}"
run_phase "Phase 5: Feature services" "$PHASE_DELAY" \
    "${FEATURE_SERVICES[@]}"
run_phase "Phase 6: Heavy services" "$PHASE_DELAY" \
    "${HEAVY_SERVICES[@]}"
run_phase "Phase 7: Gateway" "$PHASE_DELAY" gateway

echo "=== Phase 8: Seed jobs ==="
run_compose up -d "${EXTRA_FLAGS[@]}" app-configurator-seed
run_compose wait app-configurator-seed
echo ""

run_phase "Phase 9: Client interfaces" 0 "${CLIENT_SERVICES[@]}"

echo "=== Startup complete ==="
run_compose ps

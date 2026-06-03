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

    if [ -z "$restart_services" ]; then
        echo "No changed services require restart"
        run_compose ps
        rm -f "$PLAN_FILE"
        exit 0
    fi

    mapfile -t RESTART_ARRAY <<< "$restart_services"
    echo "=== Incremental restart ==="
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

run_phase "Phase 3: Core services" "$PHASE_DELAY" authentication
run_phase "Phase 4: Essential APIs" "$PHASE_DELAY" \
    profile social permissions app-configurator system-configurator-api
run_phase "Phase 5: Feature services" "$PHASE_DELAY" \
    finance payments store assets project-planning chat-collector prompt-proxy \
    telos-docs-service blogging forum wellness classifieds
run_phase "Phase 6: Heavy services" "$PHASE_DELAY" \
    ai-orchestration lead-tracker video-transcoder-worker videos
run_phase "Phase 7: Gateway" "$PHASE_DELAY" gateway

echo "=== Phase 8: Seed jobs ==="
run_compose up -d "${EXTRA_FLAGS[@]}" app-configurator-seed
run_compose wait app-configurator-seed
echo ""

run_phase "Phase 9: Client interfaces" 0 \
    ot-client-interface forgeofwill-client-interface digital-homestead-client-interface \
    hai-client-interface local-hub-client-interface crdn-client-interface leads-app \
    store-client configurable-client fin-commander marketing-generator business-site owner-console d6 system-configurator \
    video-client

echo "=== Startup complete ==="
run_compose ps

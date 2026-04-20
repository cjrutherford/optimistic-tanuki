#!/usr/bin/env bash
set -euo pipefail

DRY_RUN=0
COMPOSE_FILE="docker-compose.yaml"

if [ "${1:-}" = "--dry-run" ]; then
    DRY_RUN=1
    shift
fi

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
run_phase "Phase 6: Heavy services" "$PHASE_DELAY" ai-orchestration lead-tracker
run_phase "Phase 7: Gateway" "$PHASE_DELAY" gateway

echo "=== Phase 8: Seed jobs ==="
run_compose up -d "${EXTRA_FLAGS[@]}" app-configurator-seed
run_compose wait app-configurator-seed
echo ""

run_phase "Phase 9: Client interfaces" 0 \
    ot-client-interface forgeofwill-client-interface digital-homestead-client-interface \
    hai-client-interface local-hub-client-interface crdn-client-interface leads-app \
    store-client configurable-client fin-commander owner-console d6 system-configurator

echo "=== Startup complete ==="
run_compose ps

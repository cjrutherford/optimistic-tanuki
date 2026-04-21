#!/usr/bin/env bash
set -euo pipefail

DRY_RUN=0
BATCH_SIZE=${DOCKER_BATCH_SIZE:-4}
COMPOSE_FILE="docker-compose.yaml"

while [ "$#" -gt 0 ]; do
    case "$1" in
        --dry-run)
            DRY_RUN=1
            shift
            ;;
        -*)
            echo "Unknown option: $1" >&2
            exit 2
            ;;
        *)
            if [[ "$1" =~ ^[0-9]+$ ]]; then
                BATCH_SIZE="$1"
            else
                COMPOSE_FILE="$1"
            fi
            shift
            ;;
    esac
done

if ! [[ "$BATCH_SIZE" =~ ^[0-9]+$ ]]; then
    echo "Batch size must be a positive integer" >&2
    exit 2
fi

if [ "$BATCH_SIZE" -lt 1 ]; then
    echo "Batch size must be greater than zero" >&2
    exit 2
fi

COMPOSE_FLAGS=("-f" "$COMPOSE_FILE")
if [[ "$COMPOSE_FILE" == *"dev"* ]]; then
    COMPOSE_FLAGS=("-f" "docker-compose.yaml" "-f" "docker-compose.dev.yaml")
fi

echo "=== Batched Docker Build ==="
echo "Batch size: $BATCH_SIZE"
echo "Compose file: $COMPOSE_FILE"
echo "Compose flags: ${COMPOSE_FLAGS[*]}"
echo ""

export DOCKER_BUILDKIT=1
export BUILDKIT_PROGRESS=plain

if [ -n "${DOCKER_BUILD_BAKE_FILE:-}" ]; then
    BAKE_FILE="$DOCKER_BUILD_BAKE_FILE"
    CLEANUP_BAKE_FILE=0
else
    BAKE_FILE=$(mktemp)
    CLEANUP_BAKE_FILE=1
fi

if [ "$CLEANUP_BAKE_FILE" -eq 1 ]; then
    trap 'rm -f "$BAKE_FILE"' EXIT
fi

if [ -z "${DOCKER_BUILD_BAKE_FILE:-}" ]; then
    docker compose "${COMPOSE_FLAGS[@]}" build --print > "$BAKE_FILE"
fi

SERVICES=$(node -e '
const fs = require("fs");
const bake = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
for (const name of Object.keys(bake.target ?? {})) {
  if (name !== "db-setup" && !name.endsWith("-seed")) {
    console.log(name);
  }
}
' "$BAKE_FILE")

run_bake() {
    if [ "$DRY_RUN" -eq 1 ]; then
        echo "DRY RUN: docker buildx bake -f $BAKE_FILE $*"
    else
        docker buildx bake -f "$BAKE_FILE" "$@"
    fi
}

if node -e '
const fs = require("fs");
const bake = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
process.exit(Object.prototype.hasOwnProperty.call(bake.target ?? {}, "db-setup") ? 0 : 1);
' "$BAKE_FILE"; then
    echo "=== Building db-setup ==="
    run_bake db-setup
    echo ""
fi

if [ -z "$SERVICES" ]; then
    echo "No services with build sections found in $COMPOSE_FILE"
    exit 0
fi

mapfile -t SERVICE_ARRAY <<< "$SERVICES"
TOTAL=${#SERVICE_ARRAY[@]}
echo "Found $TOTAL services to build"
echo ""

BATCH=()
COUNT=0
BATCH_NUM=1
TOTAL_BATCHES=$(((TOTAL + BATCH_SIZE - 1) / BATCH_SIZE))

for service in "${SERVICE_ARRAY[@]}"; do
    BATCH+=("$service")
    COUNT=$((COUNT + 1))
    if [ "$COUNT" -ge "$BATCH_SIZE" ]; then
        echo "=== Building batch $BATCH_NUM/$TOTAL_BATCHES ==="
        run_bake "${BATCH[@]}"
        echo ""
        BATCH=()
        COUNT=0
        BATCH_NUM=$((BATCH_NUM + 1))
    fi
done

if [ "${#BATCH[@]}" -gt 0 ]; then
    echo "=== Building batch $BATCH_NUM/$TOTAL_BATCHES ==="
    run_bake "${BATCH[@]}"
    echo ""
fi

echo "=== Build complete ==="

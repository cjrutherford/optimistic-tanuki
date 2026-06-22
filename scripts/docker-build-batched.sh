#!/usr/bin/env bash
set -euo pipefail

DRY_RUN=0
FORCE_ALL=0
BATCH_SIZE=${DOCKER_BATCH_SIZE:-10}
COMPOSE_FILE="docker-compose.yaml"
SELECTED_SERVICES=()

while [ "$#" -gt 0 ]; do
    case "$1" in
        --dry-run)
            DRY_RUN=1
            shift
            ;;
        --full-rebuild)
            FORCE_ALL=1
            shift
            ;;
        --services)
            IFS=',' read -r -a PARSED_SERVICES <<< "$2"
            for service in "${PARSED_SERVICES[@]}"; do
                if [ -n "$service" ]; then
                    SELECTED_SERVICES+=("$service")
                fi
            done
            shift 2
            ;;
        --service)
            SELECTED_SERVICES+=("$2")
            shift 2
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
export BUILDX_CONFIG=${BUILDX_CONFIG:-/tmp/ot-buildx}

mkdir -p "$BUILDX_CONFIG"

STATE_DIR=${DOCKER_BUILD_STATE_DIR:-tmp/docker-compose-state}
PLAN_FILE=${DOCKER_BUILD_PLAN_FILE:-$STATE_DIR/$(basename "$COMPOSE_FILE").plan.json}
STATE_FILE=${DOCKER_BUILD_STATE_FILE:-$STATE_DIR/$(basename "$COMPOSE_FILE").state.json}

mkdir -p "$STATE_DIR"

PLAN_ARGS=(
    scripts/docker-plan-services.mjs
    --workspace-root
    "$PWD"
    --compose-file
    "$COMPOSE_FILE"
    --state-file
    "$STATE_FILE"
    --write-plan
    "$PLAN_FILE"
)

if [ "$FORCE_ALL" -eq 1 ]; then
    PLAN_ARGS+=(--force-all)
fi

for service in "${SELECTED_SERVICES[@]}"; do
    PLAN_ARGS+=(--service "$service")
done

node "${PLAN_ARGS[@]}" >/dev/null

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

MISSING_IMAGE_SERVICES=$(node - <<'NODE' "$PLAN_FILE" "$BAKE_FILE"
const fs = require('fs');
const { execFileSync } = require('child_process');

const planFile = process.argv[2];
const bakeFile = process.argv[3];
const plan = JSON.parse(fs.readFileSync(planFile, 'utf8'));
const bake = JSON.parse(fs.readFileSync(bakeFile, 'utf8'));

function imageExists(tag) {
  try {
    execFileSync('docker', ['image', 'inspect', tag], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const missingServices = [];
const buildServices = new Set(plan.buildServices || []);
const buildApps = new Set(plan.buildApps || []);
const restartServices = new Set(plan.restartServices || []);
plan.reasons ||= {};

for (const [serviceName, target] of Object.entries(bake.target || {})) {
  if (serviceName === 'db-setup' || serviceName.endsWith('-seed')) {
    continue;
  }

  if (!plan.services?.[serviceName]) {
    continue;
  }

  const tags = Array.isArray(target.tags) ? target.tags.filter(Boolean) : [];
  const hasLocalImage = tags.length > 0 && tags.some((tag) => imageExists(tag));
  if (hasLocalImage) {
    continue;
  }

  if (!buildServices.has(serviceName)) {
    missingServices.push(serviceName);
  }

  buildServices.add(serviceName);
  restartServices.add(serviceName);
  if (plan.services[serviceName].appId) {
    buildApps.add(plan.services[serviceName].appId);
  }
  plan.reasons[serviceName] = 'missing-local-image';
}

plan.buildServices = [...buildServices].sort();
plan.buildApps = [...buildApps].sort();
plan.restartServices = [...restartServices].sort();

fs.writeFileSync(planFile, JSON.stringify(plan, null, 2));
process.stdout.write(`${missingServices.join('\n')}\n`);
NODE
)

SERVICES=$(node -e '
const fs = require("fs");
const plan = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
for (const service of plan.buildServices || []) {
  console.log(service);
}
' "$PLAN_FILE")

run_bake() {
    if [ "$DRY_RUN" -eq 1 ]; then
        echo "DRY RUN: docker buildx bake -f $BAKE_FILE $*"
    else
        docker buildx bake -f "$BAKE_FILE" "$@"
    fi
}

save_state_from_plan() {
    node - <<'NODE' "$PLAN_FILE" "$STATE_FILE"
const fs = require('fs');
const plan = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
fs.mkdirSync(require('path').dirname(process.argv[3]), { recursive: true });
fs.writeFileSync(process.argv[3], JSON.stringify(plan.state, null, 2));
NODE
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

if [ -n "$MISSING_IMAGE_SERVICES" ]; then
    echo "Missing local images detected:"
    printf '%s\n' "$MISSING_IMAGE_SERVICES"
    echo ""
fi

if [ -z "$SERVICES" ]; then
    echo "No changed services to build for $COMPOSE_FILE"
    save_state_from_plan
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

save_state_from_plan

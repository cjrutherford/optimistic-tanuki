#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="docker-compose.dev.yaml"
STATE_DIR=${DOCKER_BUILD_STATE_DIR:-tmp/docker-compose-state}
PLAN_FILE=${DOCKER_BUILD_PLAN_FILE:-$STATE_DIR/$(basename "$COMPOSE_FILE").plan.json}
STATE_FILE=${DOCKER_BUILD_STATE_FILE:-$STATE_DIR/$(basename "$COMPOSE_FILE").state.json}

mkdir -p "$STATE_DIR"

node scripts/docker-plan-services.mjs \
  --workspace-root "$PWD" \
  --compose-file "$COMPOSE_FILE" \
  --state-file "$STATE_FILE" \
  --write-plan "$PLAN_FILE" >/dev/null

BUILD_APPS=$(node -e '
const fs = require("fs");
const plan = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
for (const app of plan.buildApps || []) {
  console.log(app);
}
' "$PLAN_FILE")

if [ -n "$BUILD_APPS" ]; then
  mapfile -t BUILD_APP_ARRAY <<< "$BUILD_APPS"
  PROJECTS=$(IFS=,; echo "${BUILD_APP_ARRAY[*]}")

  echo "=== Incremental Nx build ==="
  echo "Projects: $PROJECTS"
  echo ""

  NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm exec nx run-many \
    --target=build \
    --projects="$PROJECTS" \
    --configuration=development
else
  echo "No changed Nx app builds detected for $COMPOSE_FILE"
  echo ""
fi

pnpm run docker:build:dev
pnpm run docker:dev:up

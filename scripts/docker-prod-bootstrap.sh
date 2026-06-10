#!/bin/sh

set -eu

PROJECT_DIR="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
COMPOSE_ENV_FILE="${COMPOSE_ENV_FILE:-}"
ARGO_TARGET_REVISION="${ARGO_TARGET_REVISION:-main}"
PRODUCTION_IMAGE_TAG="$(sh "$PROJECT_DIR/scripts/resolve-production-image-tag.sh" "$PROJECT_DIR" "$ARGO_TARGET_REVISION")"

export PRODUCTION_IMAGE_TAG

if [ -n "$COMPOSE_ENV_FILE" ]; then
  export COMPOSE_ENV_FILE
fi

compose_cmd() {
  if [ -n "$COMPOSE_ENV_FILE" ]; then
    docker compose --env-file "$COMPOSE_ENV_FILE" -f docker-compose.yaml "$@"
  else
    docker compose -f docker-compose.yaml "$@"
  fi
}

echo "Using production image tag: $PRODUCTION_IMAGE_TAG"
if [ -n "$COMPOSE_ENV_FILE" ]; then
  echo "Using compose env file: $COMPOSE_ENV_FILE"
fi

cd "$PROJECT_DIR"
./scripts/batch-pull.sh
compose_cmd up -d --force-recreate --no-build
pnpm run docker:prod:seed

#!/bin/sh

set -eu

PROJECT_DIR="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
COMPOSE_ENV_FILE="${COMPOSE_ENV_FILE:-}"
COMPOSE_ARGS="-f docker-compose.yaml"
ARGO_TARGET_REVISION="${ARGO_TARGET_REVISION:-main}"
PRODUCTION_IMAGE_TAG="$(sh "$PROJECT_DIR/scripts/resolve-production-image-tag.sh" "$PROJECT_DIR" "$ARGO_TARGET_REVISION")"

export PRODUCTION_IMAGE_TAG

if [ -n "$COMPOSE_ENV_FILE" ]; then
  COMPOSE_ARGS="--env-file $COMPOSE_ENV_FILE $COMPOSE_ARGS"
  export COMPOSE_ENV_FILE
fi

echo "Using production image tag: $PRODUCTION_IMAGE_TAG"
if [ -n "$COMPOSE_ENV_FILE" ]; then
  echo "Using compose env file: $COMPOSE_ENV_FILE"
fi

cd "$PROJECT_DIR"
docker compose ${COMPOSE_ARGS} pull
docker compose ${COMPOSE_ARGS} up -d --force-recreate --no-build
pnpm run docker:prod:seed

#!/bin/sh

set -eu

PROJECT_DIR="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
ARGO_TARGET_REVISION="${ARGO_TARGET_REVISION:-main}"
PRODUCTION_IMAGE_TAG="$(sh "$PROJECT_DIR/scripts/resolve-production-image-tag.sh" "$PROJECT_DIR" "$ARGO_TARGET_REVISION")"

export PRODUCTION_IMAGE_TAG

echo "Using production image tag: $PRODUCTION_IMAGE_TAG"

cd "$PROJECT_DIR"
docker compose pull
docker compose up -d --force-recreate --no-build
pnpm run docker:prod:seed

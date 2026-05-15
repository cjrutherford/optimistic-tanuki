#!/bin/sh

set -eu

PROJECT_DIR="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
ARGO_TARGET_REVISION="${ARGO_TARGET_REVISION:-main}"
PRODUCTION_IMAGE_TAG="${PRODUCTION_IMAGE_TAG:-}"

if [ -z "$PRODUCTION_IMAGE_TAG" ]; then
  RESOLVED_REVISION="$(git -C "$PROJECT_DIR" rev-parse "$ARGO_TARGET_REVISION" 2>/dev/null || true)"
  if [ -z "$RESOLVED_REVISION" ]; then
    echo "Error: Unable to resolve ARGO_TARGET_REVISION '$ARGO_TARGET_REVISION' to a git SHA." >&2
    echo "Set PRODUCTION_IMAGE_TAG explicitly, for example PRODUCTION_IMAGE_TAG=sha-<commit>." >&2
    exit 1
  fi
  PRODUCTION_IMAGE_TAG="sha-$RESOLVED_REVISION"
fi

export PRODUCTION_IMAGE_TAG

echo "Using production image tag: $PRODUCTION_IMAGE_TAG"

cd "$PROJECT_DIR"
docker compose pull
docker compose up -d --force-recreate
pnpm run docker:prod:seed

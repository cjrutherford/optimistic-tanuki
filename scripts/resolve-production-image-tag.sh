#!/bin/sh

set -eu

PROJECT_DIR="${1:?project directory is required}"
ARGO_TARGET_REVISION="${2:-main}"
PRODUCTION_IMAGE_TAG="${PRODUCTION_IMAGE_TAG:-}"

if [ -z "$PRODUCTION_IMAGE_TAG" ]; then
  git -C "$PROJECT_DIR" fetch --quiet origin "$ARGO_TARGET_REVISION" 2>/dev/null || true
  RESOLVED_REVISION="$(git -C "$PROJECT_DIR" rev-parse --verify "origin/${ARGO_TARGET_REVISION}^{commit}" 2>/dev/null || true)"
  if [ -z "$RESOLVED_REVISION" ]; then
    RESOLVED_REVISION="$(git -C "$PROJECT_DIR" rev-parse --verify "${ARGO_TARGET_REVISION}^{commit}" 2>/dev/null || true)"
  fi
  if [ -z "$RESOLVED_REVISION" ]; then
    echo "Error: Unable to resolve ARGO_TARGET_REVISION '$ARGO_TARGET_REVISION' to a git SHA." >&2
    echo "Set PRODUCTION_IMAGE_TAG explicitly, for example PRODUCTION_IMAGE_TAG=sha-<short-commit>." >&2
    exit 1
  fi
  SHORT_REVISION="$(git -C "$PROJECT_DIR" rev-parse --short=7 "$RESOLVED_REVISION" 2>/dev/null || true)"
  if [ -z "$SHORT_REVISION" ]; then
    SHORT_REVISION="$(printf '%s' "$RESOLVED_REVISION" | cut -c 1-7)"
  fi
  PRODUCTION_IMAGE_TAG="sha-$SHORT_REVISION"
fi

printf '%s\n' "$PRODUCTION_IMAGE_TAG"

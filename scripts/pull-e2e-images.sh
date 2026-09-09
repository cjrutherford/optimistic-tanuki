#!/usr/bin/env bash
#
# Pulls the images an e2e target needs, preferring the ones this run built.
#
# `image_check` builds every app the diff touched and, when the run has
# registry credentials, pushes each under this run's SHA tag. Those are the
# images e2e should exercise: without them a change to service code cannot be
# verified until after it has already been merged.
#
# A run does not rebuild everything, though — on a pull request `image_check`
# covers only the affected apps — so a service whose SHA tag does not exist
# falls back to E2E_FALLBACK_TAG and is retagged locally to the SHA. That way
# the compose file's single ${E2E_IMAGE_TAG} resolves for every service, and
# the stack is a mix of this run's images and the base branch's, which is
# exactly what the diff describes.
#
# Usage: pull-e2e-images.sh <services-file> [compose-profile]
set -euo pipefail

SERVICES_FILE="${1:?services file required}"
PROFILE="${2:-}"
COMPOSE_FILE="e2e/docker-compose.e2e-stack.yaml"

: "${E2E_IMAGE_TAG:?E2E_IMAGE_TAG required}"
FALLBACK_TAG="${E2E_FALLBACK_TAG:-$E2E_IMAGE_TAG}"

compose() {
  if [ -n "$PROFILE" ]; then
    docker compose -f "$COMPOSE_FILE" --profile "$PROFILE" "$@"
  else
    docker compose -f "$COMPOSE_FILE" "$@"
  fi
}

# service -> resolved image reference, straight from compose so the mapping
# cannot drift from the file the stack actually starts from.
IMAGES_FILE="$(mktemp)"
trap 'rm -f "$IMAGES_FILE"' EXIT
E2E_IMAGE_TAG="$E2E_IMAGE_TAG" compose config --format json |
  jq -r '.services | to_entries[] | select(.value.image) | "\(.key) \(.value.image)"' \
    >"$IMAGES_FILE"

PLAN="$(node scripts/resolve-e2e-images.mjs \
  --services "$SERVICES_FILE" \
  --images "$IMAGES_FILE" \
  --sha-tag "$E2E_IMAGE_TAG" \
  --fallback-tag "$FALLBACK_TAG")"

if [ -z "$PLAN" ]; then
  echo "No registry images required for this target."
  exit 0
fi

printf 'Resolving e2e images (run tag %s, fallback %s)\n' \
  "$E2E_IMAGE_TAG" "$FALLBACK_TAG"

FAILED=0
while IFS=$'\t' read -r SHA_REF FALLBACK_REF; do
  [ -n "$SHA_REF" ] || continue

  if docker pull --quiet "$SHA_REF" >/dev/null 2>&1; then
    printf '  built by this run  %s\n' "$SHA_REF"
    continue
  fi

  if [ "$SHA_REF" = "$FALLBACK_REF" ]; then
    printf '  MISSING            %s\n' "$SHA_REF"
    FAILED=1
    continue
  fi

  if docker pull --quiet "$FALLBACK_REF" >/dev/null 2>&1; then
    docker tag "$FALLBACK_REF" "$SHA_REF"
    printf '  from %-14s %s\n' "$FALLBACK_TAG" "$FALLBACK_REF"
    continue
  fi

  printf '  MISSING            %s and %s\n' "$SHA_REF" "$FALLBACK_REF"
  FAILED=1
done <<<"$PLAN"

if [ "$FAILED" -ne 0 ]; then
  echo "One or more images could not be resolved." >&2
  exit 1
fi

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

# Both temporary paths are declared before the trap so cleanup is armed from
# the first allocation onward, and never runs against an unset variable.
IMAGES_FILE=""
WORK_DIR=""
cleanup() {
  [ -n "$IMAGES_FILE" ] && rm -f "$IMAGES_FILE"
  [ -n "$WORK_DIR" ] && rm -rf "$WORK_DIR"
  return 0
}
trap cleanup EXIT

# service -> resolved image reference, straight from compose so the mapping
# cannot drift from the file the stack actually starts from.
IMAGES_FILE="$(mktemp)"

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

# A full stack is a dozen or more images and each pull costs about a minute,
# so serial resolution added a quarter of an hour to every e2e job. The daemon
# handles concurrent pulls happily; bound the concurrency so a large target
# does not saturate the runner's network or disk.
MAX_PARALLEL="${E2E_PULL_PARALLEL:-4}"
WORK_DIR="$(mktemp -d)"

# Each pull writes its own log and status file, printed in order once every
# job has finished, so parallel output does not interleave into nonsense.
resolve_one() {
  local sha_ref="$1" fallback_ref="$2" slot="$3"
  local log="$WORK_DIR/$slot.log"

  if docker pull --quiet "$sha_ref" >/dev/null 2>&1; then
    printf '  built by this run  %s\n' "$sha_ref" >"$log"
    return 0
  fi

  if [ "$sha_ref" = "$fallback_ref" ]; then
    printf '  MISSING            %s\n' "$sha_ref" >"$log"
    return 1
  fi

  if docker pull --quiet "$fallback_ref" >/dev/null 2>&1; then
    docker tag "$fallback_ref" "$sha_ref"
    printf '  from %-14s %s\n' "$FALLBACK_TAG" "$fallback_ref" >"$log"
    return 0
  fi

  printf '  MISSING            %s and %s\n' "$sha_ref" "$fallback_ref" >"$log"
  return 1
}

SLOT=0
declare -a PIDS=()
while IFS=$'\t' read -r SHA_REF FALLBACK_REF; do
  [ -n "$SHA_REF" ] || continue

  while [ "$(jobs -rp | wc -l)" -ge "$MAX_PARALLEL" ]; do
    wait -n
  done

  resolve_one "$SHA_REF" "$FALLBACK_REF" "$SLOT" &
  PIDS+=("$!:$SLOT")
  SLOT=$((SLOT + 1))
done <<<"$PLAN"

FAILED=0
for ENTRY in "${PIDS[@]}"; do
  PID="${ENTRY%%:*}"
  ENTRY_SLOT="${ENTRY##*:}"
  if ! wait "$PID"; then
    FAILED=1
  fi
  cat "$WORK_DIR/$ENTRY_SLOT.log" 2>/dev/null || true
done

if [ "$FAILED" -ne 0 ]; then
  echo "One or more images could not be resolved." >&2
  exit 1
fi

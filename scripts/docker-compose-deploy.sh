#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
COMPOSE_ENV_FILE="${COMPOSE_ENV_FILE:-}"
PRODUCTION_IMAGE_TAG="${PRODUCTION_IMAGE_TAG:-}"
ROLLBACK_IMAGE_TAG="${ROLLBACK_IMAGE_TAG:-}"
CONCURRENCY="${DOCKER_PULL_CONCURRENCY:-3}"
PULL_RETRIES="${DOCKER_PULL_RETRIES:-3}"
PULL_RETRY_DELAY="${DOCKER_PULL_RETRY_DELAY:-15}"
PULL_POLICY="${DOCKER_PULL_POLICY:-}"
PARALLEL_LIMIT="${COMPOSE_PARALLEL_LIMIT:-2}"

if [ -z "$PRODUCTION_IMAGE_TAG" ]; then
    echo "Error: PRODUCTION_IMAGE_TAG must be set to an immutable sha tag." >&2
    echo "Example: PRODUCTION_IMAGE_TAG=sha-abcdef0 pnpm run docker:prod:bootstrap" >&2
    exit 1
fi

case "$PRODUCTION_IMAGE_TAG" in
    sha-*)
        ;;
    *)
        echo "Error: PRODUCTION_IMAGE_TAG must start with 'sha-'." >&2
        exit 1
        ;;
esac

if ! [[ "$CONCURRENCY" =~ ^[0-9]+$ ]] || [ "$CONCURRENCY" -lt 1 ] || [ "$CONCURRENCY" -gt 10 ]; then
    echo "Error: DOCKER_PULL_CONCURRENCY must be an integer from 1 through 10." >&2
    exit 1
fi

if ! [[ "$PULL_RETRIES" =~ ^[0-9]+$ ]] || [ "$PULL_RETRIES" -gt 10 ]; then
    echo "Error: DOCKER_PULL_RETRIES must be an integer from 0 through 10." >&2
    exit 1
fi

if ! [[ "$PULL_RETRY_DELAY" =~ ^[0-9]+$ ]] || [ "$PULL_RETRY_DELAY" -gt 300 ]; then
    echo "Error: DOCKER_PULL_RETRY_DELAY must be an integer from 0 through 300." >&2
    exit 1
fi

if ! [[ "$PARALLEL_LIMIT" =~ ^[0-9]+$ ]] || [ "$PARALLEL_LIMIT" -lt 1 ]; then
    echo "Error: COMPOSE_PARALLEL_LIMIT must be a positive integer." >&2
    exit 1
fi

case "$PULL_POLICY" in
    ""|always|missing)
        ;;
    *)
        echo "Error: DOCKER_PULL_POLICY must be 'always' or 'missing'." >&2
        exit 1
        ;;
esac


compose_cmd() {
    if [ -n "$COMPOSE_ENV_FILE" ]; then
        docker compose --env-file "$COMPOSE_ENV_FILE" -f docker-compose.yaml "$@"
    else
        docker compose -f docker-compose.yaml "$@"
    fi
}

# Compose tolerates pull failures for services that declare a build section and
# downgrades them to a "must be built from source" warning. Those warnings leave
# the rollout half-pulled, so verify that every registry image is actually local.
expected_registry_images() {
    compose_cmd config --format json "$@" | node -e '
let input = "";
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  const services = (JSON.parse(input) || {}).services || {};
  for (const [name, service] of Object.entries(services)) {
    if (service && service.image) {
      process.stdout.write(name + "\t" + service.image + "\n");
    }
  }
});'
}

verify_registry_images() {
    local expected
    if ! expected="$(expected_registry_images "$@")"; then
        echo "Error: unable to resolve image names from the Compose configuration." >&2
        exit 1
    fi

    local missing=()
    local name image
    while IFS=$'\t' read -r name image; do
        [ -z "$image" ] && continue
        if ! docker image inspect "$image" >/dev/null 2>&1; then
            missing+=("$name ($image)")
        fi
    done <<<"$expected"

    if [ "${#missing[@]}" -gt 0 ]; then
        echo "Error: registry images are still missing after pull:" >&2
        printf '  - %s\n' "${missing[@]}" >&2
        echo "Re-run the deploy to resume the pull. Images for services with a build section can be built with: docker compose build <service>" >&2
        exit 1
    fi
}

cd "$PROJECT_DIR"
export PRODUCTION_IMAGE_TAG
COMPOSE_PARALLEL_LIMIT="$PARALLEL_LIMIT"
export COMPOSE_PARALLEL_LIMIT

if ! compose_cmd config >/dev/null 2>&1; then
    echo "Error: docker-compose.yaml is not valid for the current environment." >&2
    exit 1
fi

echo "Using production image tag: $PRODUCTION_IMAGE_TAG"
if [ -n "$COMPOSE_ENV_FILE" ]; then
    echo "Using compose env file: $COMPOSE_ENV_FILE"
fi
if [ -n "$ROLLBACK_IMAGE_TAG" ]; then
    echo "Keeping rollback image tag: $ROLLBACK_IMAGE_TAG"
fi

if [ "$#" -gt 0 ]; then
    SERVICES=("$@")
else
    mapfile -t SERVICES < <(compose_cmd config --services)
fi
TOTAL_SERVICES=${#SERVICES[@]}

echo "Pull policy: ${PULL_POLICY:-default} (concurrency: $CONCURRENCY, retries: $PULL_RETRIES, delay: ${PULL_RETRY_DELAY}s, compose parallel limit: $PARALLEL_LIMIT)"

if ! IMAGE_TABLE="$(expected_registry_images "${SERVICES[@]}")"; then
    echo "Error: unable to resolve image names from the Compose configuration." >&2
    exit 1
fi

declare -A SERVICE_IMAGE=()
while IFS=$'\t' read -r service_name image_ref; do
    [ -n "$service_name" ] && SERVICE_IMAGE[$service_name]=$image_ref
done <<<"$IMAGE_TABLE"

PULL_IMAGES=()
declare -A SEEN_IMAGE=()
for service in "${SERVICES[@]}"; do
    image=${SERVICE_IMAGE[$service]:-}
    [ -n "$image" ] || continue
    [ -n "${SEEN_IMAGE[$image]:-}" ] && continue
    SEEN_IMAGE[$image]=1
    if [ -z "$PULL_POLICY" ] || [ "$PULL_POLICY" = "always" ] || ! docker image inspect "$image" >/dev/null 2>&1; then
        PULL_IMAGES+=("$image")
    fi
done

TOTAL_IMAGES=${#PULL_IMAGES[@]}

if [ "$TOTAL_IMAGES" -eq 0 ]; then
    echo "All service images are already present locally; nothing to pull."
else
    echo "Pulling $TOTAL_IMAGES images with concurrency $CONCURRENCY"
    if ! printf '%s\n' "${PULL_IMAGES[@]}" |
        node "$PROJECT_DIR/scripts/lib/pull-images.mjs" \
            --concurrency "$CONCURRENCY" \
            --retries "$PULL_RETRIES" \
            --retry-delay "$PULL_RETRY_DELAY"; then
        echo "Error: image pull failed." >&2
        exit 1
    fi
fi

verify_registry_images "${SERVICES[@]}"

COMPOSE_ENV_FILE="$COMPOSE_ENV_FILE" \
  "$PROJECT_DIR/scripts/docker-start-phased.sh" docker-compose.yaml \
  "${DOCKER_START_PHASE_DELAY:-5}" --no-build --force-recreate
pnpm run docker:prod:seed
compose_cmd ps

cleanup_args=(--keep-tag "$PRODUCTION_IMAGE_TAG")
if [ -n "$ROLLBACK_IMAGE_TAG" ]; then
    cleanup_args+=(--keep-tag "$ROLLBACK_IMAGE_TAG")
fi

"$PROJECT_DIR/scripts/docker-image-cleanup.sh" "${cleanup_args[@]}"

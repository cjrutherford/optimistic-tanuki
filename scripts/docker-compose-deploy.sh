#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
COMPOSE_ENV_FILE="${COMPOSE_ENV_FILE:-}"
PRODUCTION_IMAGE_TAG="${PRODUCTION_IMAGE_TAG:-}"
ROLLBACK_IMAGE_TAG="${ROLLBACK_IMAGE_TAG:-}"
BATCH_SIZE="${DOCKER_PULL_BATCH_SIZE:-4}"

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

if ! [[ "$BATCH_SIZE" =~ ^[0-9]+$ ]] || [ "$BATCH_SIZE" -lt 1 ]; then
    echo "Error: DOCKER_PULL_BATCH_SIZE must be a positive integer." >&2
    exit 1
fi

compose_cmd() {
    if [ -n "$COMPOSE_ENV_FILE" ]; then
        docker compose --env-file "$COMPOSE_ENV_FILE" -f docker-compose.yaml "$@"
    else
        docker compose -f docker-compose.yaml "$@"
    fi
}

cd "$PROJECT_DIR"
export PRODUCTION_IMAGE_TAG

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

mapfile -t SERVICES < <(compose_cmd config --services)
TOTAL_SERVICES=${#SERVICES[@]}

echo "Pulling $TOTAL_SERVICES services in batches of $BATCH_SIZE"
for (( i=0; i<TOTAL_SERVICES; i+=BATCH_SIZE )); do
    BATCH=("${SERVICES[@]:$i:$BATCH_SIZE}")
    echo "Pulling batch $(( (i / BATCH_SIZE) + 1 )): ${BATCH[*]}"
    compose_cmd pull "${BATCH[@]}"
done

compose_cmd up -d --no-build --force-recreate
pnpm run docker:prod:seed
compose_cmd ps

cleanup_args=(--keep-tag "$PRODUCTION_IMAGE_TAG")
if [ -n "$ROLLBACK_IMAGE_TAG" ]; then
    cleanup_args+=(--keep-tag "$ROLLBACK_IMAGE_TAG")
fi

"$PROJECT_DIR/scripts/docker-image-cleanup.sh" "${cleanup_args[@]}"

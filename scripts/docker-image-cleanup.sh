#!/usr/bin/env bash
set -euo pipefail

KEEP_TAGS=()
REPO_PREFIX="${DOCKER_IMAGE_REPO_PREFIX:-cjrutherford/optimistic_tanuki_}"
BUILDER_PRUNE_UNTIL="${DOCKER_BUILDER_PRUNE_UNTIL:-168h}"

while [ "$#" -gt 0 ]; do
    case "$1" in
        --keep-tag)
            KEEP_TAGS+=("$2")
            shift 2
            ;;
        --repo-prefix)
            REPO_PREFIX="$2"
            shift 2
            ;;
        *)
            echo "Unknown argument: $1" >&2
            exit 2
            ;;
    esac
done

KEEP_TAGS=($(printf '%s\n' "${KEEP_TAGS[@]}" | awk 'NF' | sort -u))

echo "=== Docker image cleanup ==="
echo "Repository prefix: $REPO_PREFIX"
if [ "${#KEEP_TAGS[@]}" -gt 0 ]; then
    echo "Keeping tags: ${KEEP_TAGS[*]}"
else
    echo "Keeping tags: none explicitly requested"
fi

RUNNING_IMAGES=$(docker ps --format '{{.Image}}' | sort -u || true)
mapfile -t REPO_IMAGES < <(docker images --format '{{.Repository}}:{{.Tag}}' | grep "^${REPO_PREFIX}" | sort -u || true)

for image in "${REPO_IMAGES[@]}"; do
    tag="${image##*:}"

    if printf '%s\n' "$RUNNING_IMAGES" | grep -Fxq "$image"; then
        continue
    fi

    keep_image=0
    for keep_tag in "${KEEP_TAGS[@]}"; do
        if [ "$tag" = "$keep_tag" ]; then
            keep_image=1
            break
        fi
    done

    if [ "$keep_image" -eq 1 ]; then
        continue
    fi

    docker image rm "$image" >/dev/null 2>&1 || true
done

docker image prune -f >/dev/null 2>&1 || true
docker builder prune -f --filter "until=${BUILDER_PRUNE_UNTIL}" >/dev/null 2>&1 || true

echo "Docker cleanup complete"

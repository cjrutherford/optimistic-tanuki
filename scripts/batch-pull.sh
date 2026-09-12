#!/usr/bin/env bash

set -Eeuo pipefail

PROJECT_DIR="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
COMPOSE_ENV_FILE="${COMPOSE_ENV_FILE:-}"
COMPOSE_FILE_PATH="${BATCH_PULL_COMPOSE_FILE:-docker-compose.yaml}"
BATCH_SIZE="${BATCH_PULL_BATCH_SIZE:-${DOCKER_PULL_BATCH_SIZE:-5}}"
RETRIES="${BATCH_PULL_RETRIES:-2}"
RETRY_DELAY="${BATCH_PULL_RETRY_DELAY:-2}"
DRY_RUN=0

usage() {
    cat <<'EOF'
Usage: scripts/batch-pull.sh [options]

Pull Docker Compose images in bounded batches. The default batch size is 5.

Options:
  --batch-size N       Services per pull (default: 5)
  --retries N          Retries after a failed pull (default: 2, max: 10)
  --retry-delay SEC    Delay between retries (default: 2, max: 300)
  --compose-file FILE  Compose file (default: docker-compose.yaml)
  --env-file FILE      Compose interpolation env file
  --ollama-host HOST   Set OLLAMA_HOST for Compose interpolation
  --ollama-port PORT   Set OLLAMA_PORT for Compose interpolation
  --learning-ollama-url URL
                       Set LEARNING_OLLAMA_URL for Compose interpolation
  --dry-run            Resolve services and print pulls without pulling
  -h, --help           Show this help

Environment equivalents:
  BATCH_PULL_BATCH_SIZE, BATCH_PULL_RETRIES, BATCH_PULL_RETRY_DELAY,
  BATCH_PULL_COMPOSE_FILE, COMPOSE_ENV_FILE, OLLAMA_HOST, OLLAMA_PORT,
  LEARNING_OLLAMA_URL

This script pulls container images only; it does not pull Ollama models.
EOF
}

while [ "$#" -gt 0 ]; do
    case "$1" in
        --batch-size)
            [ "$#" -ge 2 ] || { echo "Error: --batch-size requires a value." >&2; exit 2; }
            BATCH_SIZE="$2"
            shift 2
            ;;
        --retries)
            [ "$#" -ge 2 ] || { echo "Error: --retries requires a value." >&2; exit 2; }
            RETRIES="$2"
            shift 2
            ;;
        --retry-delay)
            [ "$#" -ge 2 ] || { echo "Error: --retry-delay requires a value." >&2; exit 2; }
            RETRY_DELAY="$2"
            shift 2
            ;;
        --compose-file)
            [ "$#" -ge 2 ] || { echo "Error: --compose-file requires a value." >&2; exit 2; }
            COMPOSE_FILE_PATH="$2"
            shift 2
            ;;
        --env-file)
            [ "$#" -ge 2 ] || { echo "Error: --env-file requires a value." >&2; exit 2; }
            COMPOSE_ENV_FILE="$2"
            shift 2
            ;;
        --ollama-host)
            [ "$#" -ge 2 ] || { echo "Error: --ollama-host requires a value." >&2; exit 2; }
            export OLLAMA_HOST="$2"
            shift 2
            ;;
        --ollama-port)
            [ "$#" -ge 2 ] || { echo "Error: --ollama-port requires a value." >&2; exit 2; }
            export OLLAMA_PORT="$2"
            shift 2
            ;;
        --learning-ollama-url)
            [ "$#" -ge 2 ] || { echo "Error: --learning-ollama-url requires a value." >&2; exit 2; }
            export LEARNING_OLLAMA_URL="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=1
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "Error: Unknown option: $1" >&2
            usage >&2
            exit 2
            ;;
    esac
done

if ! [[ "$BATCH_SIZE" =~ ^[0-9]+$ ]] || [ "$BATCH_SIZE" -lt 1 ]; then
    echo "Error: batch size must be a positive integer." >&2
    exit 2
fi

if ! [[ "$RETRIES" =~ ^[0-9]+$ ]] || [ "$RETRIES" -gt 10 ]; then
    echo "Error: retries must be an integer from 0 through 10." >&2
    exit 2
fi

if ! [[ "$RETRY_DELAY" =~ ^[0-9]+([.][0-9]+)?$ ]] || ! awk "BEGIN { exit !($RETRY_DELAY <= 300) }"; then
    echo "Error: retry delay must be between 0 and 300 seconds." >&2
    exit 2
fi

MAX_ATTEMPTS=$((RETRIES + 1))

compose_cmd() {
    if [ -n "$COMPOSE_ENV_FILE" ]; then
        docker compose --env-file "$COMPOSE_ENV_FILE" -f "$COMPOSE_FILE_PATH" "$@"
    else
        docker compose -f "$COMPOSE_FILE_PATH" "$@"
    fi
}

cd "$PROJECT_DIR"

# 1. Verify we are in a directory with a valid docker-compose file
if ! compose_cmd config > /dev/null 2>&1; then
    echo "Error: No valid Compose file found: $COMPOSE_FILE_PATH" >&2
    exit 1
fi

# 2. Get all service names from the compose file and store them in an array
mapfile -t SERVICES < <(compose_cmd config --services)

TOTAL_SERVICES=${#SERVICES[@]}

echo "Found $TOTAL_SERVICES services. Starting pull in batches of $BATCH_SIZE..."
echo "Compose file: $COMPOSE_FILE_PATH"
[ -n "$COMPOSE_ENV_FILE" ] && echo "Compose env file: $COMPOSE_ENV_FILE"
[ -n "${OLLAMA_HOST:-}" ] && echo "Ollama host: $OLLAMA_HOST"
[ -n "${OLLAMA_PORT:-}" ] && echo "Ollama port: $OLLAMA_PORT"
[ -n "${LEARNING_OLLAMA_URL:-}" ] && echo "Learning Ollama URL: $LEARNING_OLLAMA_URL"

pull_batch() {
    local batch_label="$1"
    shift

    if [ "$DRY_RUN" -eq 1 ]; then
        echo "DRY RUN: compose pull $batch_label"
        return 0
    fi

    local attempt=1
    while true; do
        if compose_cmd pull "$@"; then
            return 0
        fi

        if [ "$attempt" -ge "$MAX_ATTEMPTS" ]; then
            echo "Error pulling batch: $batch_label; giving up after $attempt attempts." >&2
            return 1
        fi

        echo "Pull attempt $attempt/$MAX_ATTEMPTS failed for batch: $batch_label; retrying in ${RETRY_DELAY}s..." >&2
        attempt=$((attempt + 1))
        sleep "$RETRY_DELAY"
    done
}

# 3. Loop through the array in chunks of BATCH_SIZE
for (( i=0; i<$TOTAL_SERVICES; i+=$BATCH_SIZE )); do
    # Slice the array for the current batch
    BATCH=("${SERVICES[@]:$i:$BATCH_SIZE}")
    
    echo "---------------------------------------------------------"
    echo "Pulling batch $(( (i/BATCH_SIZE) + 1 )): ${BATCH[*]}"
    echo "---------------------------------------------------------"
    
    if ! pull_batch "${BATCH[*]}" "${BATCH[@]}"; then
        exit 1
    fi
    
    echo "Batch $(( (i/BATCH_SIZE) + 1 )) completed successfully."
done

echo "---------------------------------------------------------"
echo "Success! All $TOTAL_SERVICES services have been pulled."

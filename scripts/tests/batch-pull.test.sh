#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
SCRIPT_UNDER_TEST="$ROOT_DIR/scripts/batch-pull.sh"
TMP_DIR=$(mktemp -d)

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT INT TERM

FAKE_BIN="$TMP_DIR/bin"
mkdir -p "$FAKE_BIN"
cat >"$FAKE_BIN/docker" <<'FAKE_DOCKER'
#!/usr/bin/env bash

set -euo pipefail

printf '%s\n' "$*" >> "$DOCKER_LOG"

has_arg() {
  local wanted="$1"
  shift
  for arg in "$@"; do
    [ "$arg" = "$wanted" ] && return 0
  done
  return 1
}

if has_arg config "$@" && has_arg --services "$@"; then
  printf '%s\n' gateway profile assets permissions store-client owner-console
  exit 0
fi

if has_arg pull "$@"; then
  count=0
  if [ -f "$DOCKER_PULL_COUNT" ]; then
    count=$(<"$DOCKER_PULL_COUNT")
  fi
  count=$((count + 1))
  printf '%s\n' "$count" >"$DOCKER_PULL_COUNT"
  if [ "$count" -le "${DOCKER_PULL_FAILURES:-0}" ]; then
    exit 1
  fi
fi
FAKE_DOCKER
chmod +x "$FAKE_BIN/docker"

export PATH="$FAKE_BIN:$PATH"
export DOCKER_LOG="$TMP_DIR/docker.log"
export DOCKER_PULL_COUNT="$TMP_DIR/pull-count"

assert_contains() {
  local needle="$1"
  local file="$2"
  if ! grep -Fq -- "$needle" "$file"; then
    echo "Expected $file to contain: $needle" >&2
    cat "$file" >&2
    exit 1
  fi
}

help_output="$TMP_DIR/help.txt"
"$SCRIPT_UNDER_TEST" --help >"$help_output"
assert_contains 'Usage: scripts/batch-pull.sh' "$help_output"
assert_contains '--batch-size N' "$help_output"
assert_contains '--dry-run' "$help_output"

dry_run_output="$TMP_DIR/dry-run.txt"
: >"$DOCKER_LOG"
COMPOSE_ENV_FILE="$TMP_DIR/production.env" \
  "$SCRIPT_UNDER_TEST" --dry-run --batch-size 2 >"$dry_run_output"
assert_contains 'batches of 2' "$dry_run_output"
assert_contains 'DRY RUN: compose pull gateway profile' "$dry_run_output"
assert_contains 'DRY RUN: compose pull assets permissions' "$dry_run_output"
assert_contains 'DRY RUN: compose pull store-client owner-console' "$dry_run_output"
if grep -Fq 'pull ' "$DOCKER_LOG"; then
  echo 'dry-run invoked a pull command' >&2
  cat "$DOCKER_LOG" >&2
  exit 1
fi
assert_contains '--env-file '"$TMP_DIR/production.env" "$DOCKER_LOG"

endpoint_output="$TMP_DIR/endpoint.txt"
"$SCRIPT_UNDER_TEST" --dry-run \
  --ollama-host 100.89.87.124 \
  --ollama-port 11434 \
  --learning-ollama-url http://100.89.87.124:11434 >"$endpoint_output"
assert_contains 'Ollama host: 100.89.87.124' "$endpoint_output"
assert_contains 'Ollama port: 11434' "$endpoint_output"
assert_contains 'Learning Ollama URL: http://100.89.87.124:11434' "$endpoint_output"

: >"$DOCKER_LOG"
rm -f "$DOCKER_PULL_COUNT"
export DOCKER_PULL_FAILURES=2
"$SCRIPT_UNDER_TEST" --batch-size 5 --retries 2 --retry-delay 0 >/dev/null
if [ "$(<"$DOCKER_PULL_COUNT")" -ne 4 ]; then
  echo 'expected two bounded retries before success' >&2
  cat "$DOCKER_LOG" >&2
  exit 1
fi

rm -f "$DOCKER_PULL_COUNT"
export DOCKER_PULL_FAILURES=99
if "$SCRIPT_UNDER_TEST" --batch-size 5 --retries 2 --retry-delay 0 >"$TMP_DIR/failure.txt" 2>&1; then
  echo 'expected bounded pull failure' >&2
  exit 1
fi
if [ "$(<"$DOCKER_PULL_COUNT")" -ne 3 ]; then
  echo 'pull retries were not bounded' >&2
  cat "$DOCKER_LOG" >&2
  exit 1
fi
assert_contains 'giving up after 3 attempts' "$TMP_DIR/failure.txt"

if "$SCRIPT_UNDER_TEST" --batch-size 0 >"$TMP_DIR/invalid.txt" 2>&1; then
  echo 'expected invalid batch size to fail' >&2
  exit 1
fi
assert_contains 'batch size must be a positive integer' "$TMP_DIR/invalid.txt"

echo 'batch-pull test passed'

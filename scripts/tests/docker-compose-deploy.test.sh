#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
SCRIPT_UNDER_TEST="$ROOT_DIR/scripts/docker-compose-deploy.sh"
TMP_DIR=$(mktemp -d)

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT INT TERM

FAKE_BIN="$TMP_DIR/bin"
mkdir -p "$FAKE_BIN"
REAL_NODE=$(command -v node)

cat >"$FAKE_BIN/docker" <<'FAKE_DOCKER'
#!/usr/bin/env bash

set -euo pipefail

printf '%s\n' "$*" >>"$DOCKER_LOG"

has_arg() {
  local wanted="$1"
  shift
  for arg in "$@"; do
    [ "$arg" = "$wanted" ] && return 0
  done
  return 1
}

if has_arg config "$@" && has_arg --services "$@"; then
  printf '%s\n' gateway profile assets permissions
  exit 0
fi

if has_arg config "$@" && has_arg json "$@"; then
  cat <<'JSON'
{"services":{"gateway":{"image":"registry.example/tanuki_gateway:sha-abcdef0"},"profile":{"image":"registry.example/tanuki_profile:sha-abcdef0"},"assets":{"image":"registry.example/tanuki_assets:sha-abcdef0"},"permissions":{"image":"registry.example/tanuki_permissions:sha-abcdef0"},"db-setup":{"build":{}}}}
JSON
  exit 0
fi

if has_arg config "$@"; then
  exit 0
fi

if has_arg image "$@" && has_arg inspect "$@"; then
  if [ -n "${DOCKER_MISSING_IMAGE:-}" ]; then
    for arg in "$@"; do
      case "$arg" in
        *"$DOCKER_MISSING_IMAGE"*)
          name=$(printf '%s' "$arg" | tr '/:' '__')
          [ -f "$PULLED_DIR/$name" ] || exit 1
          ;;
      esac
    done
  fi
  exit 0
fi

printf 'other %s\n' "$*" >>"$DOCKER_LOG"
FAKE_DOCKER
chmod +x "$FAKE_BIN/docker"

cat >"$FAKE_BIN/node" <<'FAKE_NODE'
#!/usr/bin/env bash

set -euo pipefail

REAL_NODE="__REAL_NODE__"

if [ "${1:-}" = "-e" ]; then
  exec "$REAL_NODE" "$@"
fi

case "${1:-}" in
  *pull-images.mjs)
    printf 'PARALLEL=%s args=%s\n' "${COMPOSE_PARALLEL_LIMIT:-unset}" "$*" >>"$DOCKER_LOG"

    images=()
    while IFS= read -r line; do
      [ -n "$line" ] && images+=("$line")
    done

    if [ "${FAKE_PULL_FAIL:-0}" = "1" ]; then
      printf '  ✗ fake pull failure\n'
      exit 1
    fi

    for image in "${images[@]}"; do
      printf '%s\n' "$image" >>"$PULLED_LIST"
      printf '  ✓ %s (0.0s)\n' "$image"
      if [ "${FAKE_NO_MARKER:-0}" != "1" ]; then
        mkdir -p "$PULLED_DIR"
        name=$(printf '%s' "$image" | tr '/:' '__')
        : >"$PULLED_DIR/$name"
      fi
    done
    exit 0
    ;;
esac

exec "$REAL_NODE" "$@"
FAKE_NODE
sed -i "s|__REAL_NODE__|$REAL_NODE|" "$FAKE_BIN/node"
chmod +x "$FAKE_BIN/node"

cat >"$FAKE_BIN/pnpm" <<'STUB'
#!/usr/bin/env bash
printf 'pnpm %s\n' "$*" >>"$DOCKER_LOG"
STUB
chmod +x "$FAKE_BIN/pnpm"

PROJECT_DIR="$TMP_DIR/project"
mkdir -p "$PROJECT_DIR/scripts"
cp "$SCRIPT_UNDER_TEST" "$PROJECT_DIR/scripts/docker-compose-deploy.sh"
chmod +x "$PROJECT_DIR/scripts/docker-compose-deploy.sh"
: >"$PROJECT_DIR/docker-compose.yaml"
cat >"$PROJECT_DIR/scripts/docker-start-phased.sh" <<'STUB'
#!/usr/bin/env bash
printf 'start-phased %s\n' "$*" >>"$DOCKER_LOG"
STUB
cat >"$PROJECT_DIR/scripts/docker-image-cleanup.sh" <<'STUB'
#!/usr/bin/env bash
printf 'image-cleanup %s\n' "$*" >>"$DOCKER_LOG"
STUB
chmod +x "$PROJECT_DIR/scripts/docker-start-phased.sh" "$PROJECT_DIR/scripts/docker-image-cleanup.sh"

export PATH="$FAKE_BIN:$PATH"
export DOCKER_LOG="$TMP_DIR/docker.log"
export PULLED_LIST="$TMP_DIR/pulled-list.txt"
export PULLED_DIR="$TMP_DIR/pulled"
export DOCKER_PULL_PROGRESS=off
export PRODUCTION_IMAGE_TAG=sha-abcdef0
mkdir -p "$PULLED_DIR"
unset COMPOSE_PARALLEL_LIMIT || true

SCRIPT="$PROJECT_DIR/scripts/docker-compose-deploy.sh"

assert_contains() {
  local needle="$1"
  local file="$2"
  if ! grep -Fq -- "$needle" "$file"; then
    echo "Expected $file to contain: $needle" >&2
    cat "$file" >&2
    exit 1
  fi
}

assert_not_contains() {
  local needle="$1"
  local file="$2"
  if grep -Fq -- "$needle" "$file"; then
    echo "Expected $file to NOT contain: $needle" >&2
    cat "$file" >&2
    exit 1
  fi
}

reset_log() {
  : >"$DOCKER_LOG"
  : >"$PULLED_LIST"
  rm -rf "$PULLED_DIR"
  mkdir -p "$PULLED_DIR"
}

# 1. Images are resolved, deduplicated and handed to the concurrent puller.
reset_log
DOCKER_PULL_CONCURRENCY=2 DOCKER_PULL_RETRY_DELAY=0 \
  "$SCRIPT" >"$TMP_DIR/success.txt" 2>&1
assert_contains 'Pulling 4 images with concurrency 2' "$TMP_DIR/success.txt"
assert_contains 'Pull policy: default' "$TMP_DIR/success.txt"
assert_contains 'registry.example/tanuki_gateway:sha-abcdef0' "$PULLED_LIST"
assert_contains 'registry.example/tanuki_profile:sha-abcdef0' "$PULLED_LIST"
assert_contains 'registry.example/tanuki_assets:sha-abcdef0' "$PULLED_LIST"
assert_contains 'registry.example/tanuki_permissions:sha-abcdef0' "$PULLED_LIST"
assert_contains '✓ registry.example/tanuki_gateway:sha-abcdef0' "$TMP_DIR/success.txt"
assert_contains 'start-phased docker-compose.yaml' "$DOCKER_LOG"
assert_contains 'pnpm run docker:prod:seed' "$DOCKER_LOG"
assert_contains 'image-cleanup --keep-tag sha-abcdef0' "$DOCKER_LOG"
assert_not_contains 'db-setup' "$PULLED_LIST"

# 2. The puller receives the concurrency and no policy flag is used.
assert_contains '--concurrency 2' "$DOCKER_LOG"
assert_not_contains '--policy' "$DOCKER_LOG"
assert_contains 'PARALLEL=2 args=' "$DOCKER_LOG"

# 3. A caller-provided compose parallel limit is preserved.
reset_log
COMPOSE_PARALLEL_LIMIT=5 DOCKER_PULL_CONCURRENCY=4 DOCKER_PULL_RETRY_DELAY=0 \
  "$SCRIPT" >"$TMP_DIR/parallel.txt" 2>&1
assert_contains 'parallel limit: 5' "$TMP_DIR/parallel.txt"
assert_contains 'PARALLEL=5 args=' "$DOCKER_LOG"
assert_contains '--concurrency 4' "$DOCKER_LOG"

# 4. The missing policy skips images that are already local.
reset_log
DOCKER_PULL_POLICY=missing DOCKER_PULL_RETRY_DELAY=0 \
  "$SCRIPT" >"$TMP_DIR/present.txt" 2>&1
assert_contains 'Pull policy: missing' "$TMP_DIR/present.txt"
assert_contains 'already present locally; nothing to pull' "$TMP_DIR/present.txt"
assert_not_contains 'pull-images.mjs' "$DOCKER_LOG"

# 5. The missing policy still pulls images that are not local, then verifies.
reset_log
export DOCKER_MISSING_IMAGE='tanuki_assets'
DOCKER_PULL_POLICY=missing DOCKER_PULL_RETRY_DELAY=0 \
  "$SCRIPT" >"$TMP_DIR/missing.txt" 2>&1
assert_contains 'Pulling 1 images with concurrency' "$TMP_DIR/missing.txt"
assert_contains '✓ registry.example/tanuki_assets:sha-abcdef0' "$TMP_DIR/missing.txt"
assert_not_contains 'tanuki_gateway' "$PULLED_LIST"
unset DOCKER_MISSING_IMAGE

# 6. A failed pull stops the rollout before anything is started.
reset_log
export FAKE_PULL_FAIL=1
if DOCKER_PULL_RETRY_DELAY=0 "$SCRIPT" >"$TMP_DIR/pull-failure.txt" 2>&1; then
  echo 'expected a failed pull to stop the deploy' >&2
  exit 1
fi
assert_contains '✗ fake pull failure' "$TMP_DIR/pull-failure.txt"
assert_contains 'Error: image pull failed.' "$TMP_DIR/pull-failure.txt"
assert_not_contains 'start-phased' "$DOCKER_LOG"
unset FAKE_PULL_FAIL

# 7. A pull that returns success but leaves an image absent fails verification.
reset_log
export DOCKER_MISSING_IMAGE='tanuki_gateway'
export FAKE_NO_MARKER=1
if DOCKER_PULL_RETRY_DELAY=0 "$SCRIPT" >"$TMP_DIR/unverified.txt" 2>&1; then
  echo 'expected missing registry image to stop the deploy' >&2
  exit 1
fi
assert_contains 'registry images are still missing after pull' "$TMP_DIR/unverified.txt"
assert_contains 'gateway (registry.example/tanuki_gateway:sha-abcdef0)' "$TMP_DIR/unverified.txt"
assert_not_contains 'start-phased' "$DOCKER_LOG"
unset DOCKER_MISSING_IMAGE
unset FAKE_NO_MARKER

# 8. Invalid inputs are rejected before any pull happens.
reset_log
if DOCKER_PULL_RETRIES=abc "$SCRIPT" >"$TMP_DIR/bad-retries.txt" 2>&1; then
  echo 'expected invalid retry count to fail' >&2
  exit 1
fi
assert_contains 'DOCKER_PULL_RETRIES must be an integer' "$TMP_DIR/bad-retries.txt"

if DOCKER_PULL_CONCURRENCY=0 "$SCRIPT" >"$TMP_DIR/bad-concurrency.txt" 2>&1; then
  echo 'expected invalid concurrency to fail' >&2
  exit 1
fi
assert_contains 'DOCKER_PULL_CONCURRENCY must be an integer from 1 through 10' "$TMP_DIR/bad-concurrency.txt"

if DOCKER_PULL_POLICY=never "$SCRIPT" >"$TMP_DIR/bad-policy.txt" 2>&1; then
  echo 'expected invalid pull policy to fail' >&2
  exit 1
fi
assert_contains "DOCKER_PULL_POLICY must be 'always' or 'missing'" "$TMP_DIR/bad-policy.txt"

if COMPOSE_PARALLEL_LIMIT=0 "$SCRIPT" >"$TMP_DIR/bad-parallel.txt" 2>&1; then
  echo 'expected invalid parallel limit to fail' >&2
  exit 1
fi
assert_contains 'COMPOSE_PARALLEL_LIMIT must be a positive integer' "$TMP_DIR/bad-parallel.txt"

if PRODUCTION_IMAGE_TAG=latest "$SCRIPT" >"$TMP_DIR/bad-tag.txt" 2>&1; then
  echo 'expected mutable tag to fail' >&2
  exit 1
fi
assert_contains "PRODUCTION_IMAGE_TAG must start with 'sha-'" "$TMP_DIR/bad-tag.txt"

if grep -Fq 'pull-images.mjs' "$DOCKER_LOG"; then
  echo 'invalid input still triggered a pull' >&2
  cat "$DOCKER_LOG" >&2
  exit 1
fi

echo 'docker-compose-deploy test passed'

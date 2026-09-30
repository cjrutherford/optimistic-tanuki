#!/usr/bin/env bash
#
# Regression test for scripts/pull-e2e-images.sh: background pull jobs
# inherited the EXIT trap, so the first job to finish ran cleanup and
# deleted $WORK_DIR while the remaining jobs still needed it. CI showed
# this as "$WORK_DIR/N.log: No such file or directory" and a failed step.
#
# The race reproduces deterministically (even instant pulls trigger it:
# the first subshell to exit deletes the directory), so a fake docker
# that always succeeds is enough to catch a regression.
set -euo pipefail

ROOT_DIR=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
SCRIPT_UNDER_TEST="$ROOT_DIR/scripts/pull-e2e-images.sh"
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
# `config --format json` must emit the services map the script parses.
for arg in "$@"; do
  if [ "$arg" = "config" ]; then
    printf '%s\n' '{"services":{"svc-a":{"image":"img/a:t"},"svc-b":{"image":"img/b:t"},"svc-c":{"image":"img/c:t"},"svc-d":{"image":"img/d:t"},"svc-e":{"image":"img/e:t"}}}'
    exit 0
  fi
done
# Every pull succeeds immediately, unless FAIL_IMAGE names an image whose
# pulls (SHA tag and fallback) must fail to exercise the missing-image path.
for arg in "$@"; do
  case "${arg}" in
    *"${FAIL_IMAGE:-__none__}"*)
      if [ -n "${FAIL_IMAGE:-}" ]; then
        exit 1
      fi
      ;;
  esac
done
# Successful pulls take a beat so background jobs overlap the throttle
# loop the way real (slow) registry pulls do. Instant jobs would all finish
# before throttling engages and never exercise the `wait -n` path.
sleep 0.3
exit 0
FAKE_DOCKER
chmod +x "$FAKE_BIN/docker"

export PATH="$FAKE_BIN:$PATH"

printf '%s\n' svc-a svc-b svc-c svc-d svc-e >"$TMP_DIR/services.txt"

OUTPUT="$TMP_DIR/out.txt"
E2E_IMAGE_TAG=sha-test \
E2E_FALLBACK_TAG=main \
E2E_PULL_PARALLEL=4 \
  "$SCRIPT_UNDER_TEST" "$TMP_DIR/services.txt" >"$OUTPUT" 2>"$TMP_DIR/err.txt"
STATUS=$?

if [ "$STATUS" -ne 0 ]; then
  echo "pull-e2e-images.sh exited $STATUS" >&2
  cat "$OUTPUT" "$TMP_DIR/err.txt" >&2
  exit 1
fi

if grep -Eq 'No such file or directory' "$OUTPUT" "$TMP_DIR/err.txt"; then
  echo 'WORK_DIR was deleted mid-run (EXIT trap raced background jobs)' >&2
  cat "$OUTPUT" "$TMP_DIR/err.txt" >&2
  exit 1
fi

# All five slots resolve (SHA tag pulls succeed) and print in order.
for img in img/a img/b img/c img/d img/e; do
  if ! grep -Fq "$img" "$OUTPUT"; then
    echo "missing resolution line for $img" >&2
    cat "$OUTPUT" >&2
    exit 1
  fi
done

echo 'pull-e2e-images.sh parallel regression test passed'

# Failure path: an image missing under both tags must fail the script with
# the culprit named — not kill the main shell via `set -e` on `wait -n`
# (which deleted the work dir mid-run and hid the root cause in CI).
FAIL_IMAGE='img/c' \
E2E_IMAGE_TAG=sha-test \
E2E_FALLBACK_TAG=main \
E2E_PULL_PARALLEL=4 \
  "$SCRIPT_UNDER_TEST" "$TMP_DIR/services.txt" >"$TMP_DIR/fail-out.txt" 2>"$TMP_DIR/fail-err.txt" \
  && {
    echo 'expected missing-image run to fail' >&2
    exit 1
  }
if grep -Eq 'No such file or directory' "$TMP_DIR/fail-out.txt" "$TMP_DIR/fail-err.txt"; then
  echo 'missing-image run hit work-dir teardown noise' >&2
  cat "$TMP_DIR/fail-out.txt" "$TMP_DIR/fail-err.txt" >&2
  exit 1
fi
if ! grep -Fq 'MISSING' "$TMP_DIR/fail-out.txt"; then
  echo 'missing-image run did not name the culprit' >&2
  cat "$TMP_DIR/fail-out.txt" "$TMP_DIR/fail-err.txt" >&2
  exit 1
fi

echo 'pull-e2e-images.sh missing-image regression test passed'

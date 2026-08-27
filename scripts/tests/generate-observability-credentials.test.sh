#!/bin/sh

set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
SCRIPT_UNDER_TEST="$ROOT_DIR/scripts/generate-observability-credentials.sh"
TMP_DIR=$(mktemp -d)

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT INT TERM

"$SCRIPT_UNDER_TEST" --help >"$TMP_DIR/help.txt"
grep -q 'Generate CrowdSec and Grafana credentials' "$TMP_DIR/help.txt"

"$SCRIPT_UNDER_TEST" --output-dir "$TMP_DIR/credentials" --dry-run >"$TMP_DIR/dry-run.txt"
grep -q 'would generate' "$TMP_DIR/dry-run.txt"

if [ -e "$TMP_DIR/credentials" ]; then
  echo 'dry-run created credential output' >&2
  exit 1
fi

echo 'generate-observability-credentials test passed'

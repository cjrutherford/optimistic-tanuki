#!/usr/bin/env bash

set -Eeuo pipefail

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
SCRIPT_NAME="configurable-client-slice-8-4-browser"
BASE_URL="${BASE_URL:-http://127.0.0.1:8090}"
EVIDENCE_DIR="${EVIDENCE_DIR:-$ROOT_DIR/artifacts/agent-browser/$SCRIPT_NAME}"
AGENT_BROWSER_BIN="${AGENT_BROWSER_BIN:-agent-browser}"
COMMAND_TIMEOUT="${AGENT_BROWSER_TIMEOUT:-25s}"
SESSION_OVERRIDE="${AGENT_BROWSER_SESSION:-}"
SESSION=""
EMAIL="${CONFIGURABLE_CLIENT_OWNER_EMAIL:-configurable-client-owner-v2@optimistic-tanuki.local}"
PASSWORD=""
STEP=0
LAST_LOG=""
STARTED=false
RESULT="running"
IN_FAILURE=false

usage() {
  cat <<'EOF'
Usage: configurable-client-slice-8-4-browser.sh [options]

Options:
  --base-url URL       Configurable-client origin (default: $BASE_URL)
  --evidence-dir DIR   Evidence output directory
  --session NAME       Explicit Agent Browser session name
  --timeout DURATION   Per-command timeout accepted by `timeout` (default: 25s)
  -h, --help           Show this help

Credentials come from CONFIGURABLE_CLIENT_OWNER_EMAIL and
CONFIGURABLE_CLIENT_OWNER_PASSWORD. The password default is read from the
configurable-client fixture in scripts/dev-seed.sh. Secrets are never logged.
EOF
}

seed_default_password() {
  sed -n 's/^[[:space:]]*configurable_client_owner_password=.*:-\([^}]*\)}.*/\1/p' \
    "$ROOT_DIR/scripts/dev-seed.sh"
}

redact() {
  REDACT_SECRET="$PASSWORD" perl -pe 's/\Q$ENV{REDACT_SECRET}\E/[REDACTED]/g'
}

write_manifest() {
  local exit_code="$1"
  mkdir -p "$EVIDENCE_DIR"
  RESULT="$([ "$exit_code" -eq 0 ] && printf '%s' passed || printf '%s' failed)"
  RESULT="$RESULT" EXIT_CODE="$exit_code" BASE_URL="$BASE_URL" \
    EVIDENCE_DIR="$EVIDENCE_DIR" SESSION="$SESSION" EMAIL="$EMAIL" \
    SCRIPT_NAME="$SCRIPT_NAME" node -e '
      const fs = require("node:fs");
      const path = require("node:path");
      const evidence = process.env.EVIDENCE_DIR;
      const files = fs.existsSync(evidence) ? fs.readdirSync(evidence).sort() : [];
      fs.writeFileSync(path.join(evidence, "manifest.json"), JSON.stringify({
        proof: process.env.SCRIPT_NAME,
        result: process.env.RESULT,
        exitCode: Number(process.env.EXIT_CODE),
        baseUrl: process.env.BASE_URL,
        session: process.env.SESSION,
        ownerEmail: process.env.EMAIL,
        files,
      }, null, 2) + "\n");
    '
}

cleanup() {
  local exit_code=$?
  set +e
  if [ "$STARTED" = true ]; then
    run_browser close >/dev/null 2>&1
  fi
  write_manifest "$exit_code" >/dev/null 2>&1
  exit "$exit_code"
}
trap cleanup EXIT
trap on_error ERR
trap 'exit 143' TERM
trap 'exit 130' INT

fail_with_message() {
  printf 'FAIL: %s\n' "$1" >&2
  return 1
}

capture_failure() {
  local label="$1"
  local prefix="$EVIDENCE_DIR/failure-${STEP}-${label}"
  run_browser "failure-${label}-url" get url >"$prefix.url" || true
  run_browser "failure-${label}-snapshot" snapshot -i >"$prefix.snapshot" || true
  run_browser "failure-${label}-screenshot" screenshot --full "$prefix.png" >/dev/null || true
}

on_error() {
  local exit_code=$?
  if [ "$STARTED" = true ] && [ "$IN_FAILURE" = false ]; then
    IN_FAILURE=true
    capture_failure "command-failure-${exit_code}"
  fi
  exit "$exit_code"
}

capture_post_login() {
  run_browser post-login-snapshot snapshot -i >"$EVIDENCE_DIR/post-login.snapshot"
  run_browser post-login-screenshot screenshot --full "$EVIDENCE_DIR/post-login.png" >/dev/null
  run_browser post-login-url get url >"$EVIDENCE_DIR/post-login.url"
}

capture_post_login_network() {
  local raw="$EVIDENCE_DIR/post-login-network.raw"
  run_browser post-login-network network requests --json --filter '**/authentication/login' --method POST >"$raw" || true
  RAW_NETWORK="$raw" OUT_NETWORK="$EVIDENCE_DIR/post-login-network.json" node <<'NODE'
const fs = require('node:fs');
const raw = fs.readFileSync(process.env.RAW_NETWORK, 'utf8');
const jsonLine = raw.split('\n').reverse().find((line) => {
  try { JSON.parse(line); return true; } catch { return false; }
});
let value = { supported: true, requests: [] };
if (jsonLine) {
  try { value = JSON.parse(jsonLine); } catch { /* retain empty metadata */ }
}
const secret = /authorization|cookie|password|token/i;
const sanitize = (item, key = '') => {
  if (secret.test(key)) return undefined;
  if (Array.isArray(item)) return item.map((entry) => sanitize(entry)).filter((entry) => entry !== undefined);
  if (item && typeof item === 'object') {
    return Object.fromEntries(Object.entries(item)
      .filter(([entryKey]) => !secret.test(entryKey))
      .map(([entryKey, entryValue]) => [entryKey, sanitize(entryValue, entryKey)])
      .filter(([, entryValue]) => entryValue !== undefined));
  }
  return item;
};
fs.writeFileSync(process.env.OUT_NETWORK, JSON.stringify(sanitize(value), null, 2) + '\n');
NODE
}

supports_browser_cache_clear() {
  "$AGENT_BROWSER_BIN" --help 2>/dev/null | grep -Eiq 'cache[[:space:]].*clear|clear[[:space:]].*cache'
}

run_browser() {
  local label="$1"
  shift
  STEP=$((STEP + 1))
  LAST_LOG="$EVIDENCE_DIR/commands/$(printf '%03d' "$STEP")-${label}.log"
  mkdir -p "$(dirname -- "$LAST_LOG")"
  {
    printf 'label=%s\n' "$label"
    printf 'command=agent-browser --session %s %s\n' "$SESSION" "$*" | redact
    timeout --foreground "$COMMAND_TIMEOUT" "$AGENT_BROWSER_BIN" --session "$SESSION" "$@"
  } 2>&1 | redact | tee "$LAST_LOG"
}

assert_text() {
  local label="$1" needle="$2"
  if ! run_browser "assert-${label}" snapshot -i >/dev/null || ! grep -Fq -- "$needle" "$LAST_LOG"; then
    capture_failure "$label"
    fail_with_message "${label}: snapshot did not contain expected text"
  fi
}

assert_role_heading() {
  local label="$1" name="$2"
  if ! run_browser "ready-${label}" snapshot -i >/dev/null || ! grep -Fq -- "$name" "$LAST_LOG"; then
    capture_failure "$label"
    fail_with_message "${label}: heading was not ready"
  fi
}

assert_role_link() {
  local label="$1" name="$2"
  if ! run_browser "ready-${label}" snapshot -i >/dev/null || ! grep -Fq -- "$name" "$LAST_LOG"; then
    capture_failure "$label"
    fail_with_message "${label}: link was not ready"
  fi
}

assert_url_contains() {
  local label="$1" needle="$2"
  if ! run_browser "assert-${label}" get url >/dev/null || ! grep -Fq -- "$needle" "$LAST_LOG"; then
    capture_failure "$label"
    fail_with_message "${label}: URL did not contain expected path"
  fi
}

assert_url_equals() {
  local label="$1" expected="$2"
  if ! run_browser "assert-${label}" get url >/dev/null || ! grep -Fxq -- "$expected" "$LAST_LOG"; then
    capture_failure "$label"
    fail_with_message "${label}: URL did not equal expected URL"
  fi
}

assert_no_native_dialog() {
  if ! run_browser native-dialog-status dialog status >/dev/null || \
    grep -Eiq 'pending[=: ]+(true|yes)|open[=: ]+(true|yes)' "$LAST_LOG"; then
    capture_failure native-dialog
    fail_with_message 'native dialog was present'
  fi
}

open_editor_from_primary() {
  local label="$1"
  local href

  run_browser "${label}-get-href" get attr 'a.action--primary' href >/dev/null
  href="$(grep -E '^/owner/workspace/[^/]+/config/[^/]+$' "$LAST_LOG" | tail -n 1 || true)"
  if [[ ! "$href" =~ ^/owner/workspace/[^/]+/config/[^/]+$ ]]; then
    capture_failure "${label}-href"
    fail_with_message "${label}: primary editor href did not match the expected owner configuration route"
  fi
  printf 'editor-href=%s\n' "$href" | redact | tee "$EVIDENCE_DIR/${label}-href.log"

  run_browser "${label}-open" open "$BASE_URL$href"
  run_browser "${label}-wait-for-exact-route" wait --url "$BASE_URL$href"
  assert_url_equals "${label}-exact-route" "$BASE_URL$href"
  run_browser "${label}-wait-for-editor-control" wait --text 'Back to owner desk'
}

parse_args() {
  while (($#)); do
    case "$1" in
      --base-url) [ "${2:-}" ] || fail_with_message '--base-url requires a value'; BASE_URL="$2"; shift 2 ;;
      --evidence-dir) [ "${2:-}" ] || fail_with_message '--evidence-dir requires a value'; EVIDENCE_DIR="$2"; shift 2 ;;
      --session) [ "${2:-}" ] || fail_with_message '--session requires a value'; SESSION_OVERRIDE="$2"; shift 2 ;;
      --timeout) [ "${2:-}" ] || fail_with_message '--timeout requires a value'; COMMAND_TIMEOUT="$2"; shift 2 ;;
      -h|--help) usage; trap - EXIT; exit 0 ;;
      *) usage >&2; fail_with_message "unknown option: $1" ;;
    esac
  done
}

parse_args "$@"
[ -n "$BASE_URL" ] || fail_with_message 'BASE_URL or --base-url is required'
[ -n "$EVIDENCE_DIR" ] || fail_with_message 'EVIDENCE_DIR or --evidence-dir is required'
[ -n "$EMAIL" ] || fail_with_message 'CONFIGURABLE_CLIENT_OWNER_EMAIL is required'
PASSWORD="${CONFIGURABLE_CLIENT_OWNER_PASSWORD:-$(seed_default_password)}"
[ -n "$PASSWORD" ] || fail_with_message 'CONFIGURABLE_CLIENT_OWNER_PASSWORD or seed default is required'
command -v "$AGENT_BROWSER_BIN" >/dev/null || fail_with_message "agent-browser executable not found: $AGENT_BROWSER_BIN"
command -v timeout >/dev/null || fail_with_message 'timeout executable is required'
command -v perl >/dev/null || fail_with_message 'perl executable is required for redaction'

[ ! -e "$EVIDENCE_DIR" ] || [ -z "$(find "$EVIDENCE_DIR" -mindepth 1 -print -quit)" ] || \
  fail_with_message "evidence directory must be fresh and empty: $EVIDENCE_DIR"
mkdir -p "$EVIDENCE_DIR" "$EVIDENCE_DIR/commands"
SESSION="${SESSION_OVERRIDE:-configurable-client-slice-8-4-$(date +%s)-$$}"

run_browser launch-browser open "$BASE_URL"
STARTED=true
run_browser clear-cookies cookies clear
run_browser clear-local-storage storage local clear
run_browser clear-session-storage storage session clear
if supports_browser_cache_clear; then
  run_browser clear-browser-cache cache clear
else
  printf 'Browser cache clear: unsupported by installed agent-browser CLI\n' | tee "$EVIDENCE_DIR/cache-clear.log"
fi
LOGIN_URL="$BASE_URL/login?cb=$(date +%s%N)"
run_browser open-page open "$LOGIN_URL"
assert_role_heading login 'Sign in to continue.'
run_browser fill-email find label Email fill "$EMAIL"
run_browser fill-password find label Password fill "$PASSWORD"
run_browser submit-login find role button click --name Login
capture_post_login
capture_post_login_network
assert_url_equals post-login-root "$BASE_URL/"
assert_text authenticated-landing 'Open owner workspace'
run_browser open-owner-workspace find first 'a[href="/owner"]' click
run_browser wait-for-owner wait 'main[aria-labelledby="workspace-entry-title"]'
assert_role_heading owner-entry 'Choose a workspace.'
run_browser choose-workspace find first '.workspace-choice' click
run_browser wait-for-dashboard wait --text 'OWNER WORKSPACE'
assert_role_link dashboard 'Edit configuration'
run_browser screenshot-dashboard screenshot "$EVIDENCE_DIR/dashboard.png"
open_editor_from_primary dashboard-editor
run_browser wait-for-editor-back wait 'a.back-link'
run_browser screenshot-editor screenshot "$EVIDENCE_DIR/editor.png"
run_browser harmless-edit fill '#field-title input' 'Slice 8.4 unsaved proof draft'
assert_text dirty-proof 'Slice 8.4 unsaved proof draft'
assert_text dirty-save 'Save draft'

run_browser internal-back click 'a.back-link'
run_browser wait-internal-modal wait --text 'Leave this configuration?'
assert_text internal-modal 'You have unsaved changes.'
run_browser screenshot-internal-modal screenshot "$EVIDENCE_DIR/internal-back-modal.png"
run_browser stay-internal click '[data-action="cancel-unsaved-navigation"]'
assert_url_contains internal-stay '/config/'
assert_no_native_dialog
run_browser leave-internal click '[data-action="confirm-unsaved-navigation"]'
assert_role_link dashboard-after-internal-leave 'Edit configuration'
assert_url_contains internal-leave '/owner/workspace/'

open_editor_from_primary reopen-editor
run_browser harmless-edit-again fill '#field-title input' 'Slice 8.4 unsaved proof draft'
assert_text dirty-again-proof 'Slice 8.4 unsaved proof draft'
assert_text dirty-again-save 'Save draft'
run_browser browser-back back
run_browser wait-browser-back-modal wait --text 'Leave this configuration?'
run_browser screenshot-browser-back-modal screenshot "$EVIDENCE_DIR/browser-back-modal.png"
run_browser cancel-browser-back click '[data-action="cancel-unsaved-navigation"]'
assert_url_contains browser-back-cancel '/config/'
assert_no_native_dialog
run_browser browser-back-again back
run_browser wait-browser-back-modal-again wait --text 'Leave this configuration?'
run_browser leave-browser-back click '[data-action="confirm-unsaved-navigation"]'
assert_role_link final-dashboard 'Edit configuration'
assert_url_contains browser-back-leave '/owner/workspace/'
assert_no_native_dialog
run_browser screenshot-final screenshot "$EVIDENCE_DIR/final-dashboard.png"

RESULT=passed
printf 'PASS: %s\nEvidence: %s\n' "$SCRIPT_NAME" "$EVIDENCE_DIR"

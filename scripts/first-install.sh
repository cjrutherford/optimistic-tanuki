#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SETUP_PORT="${SETUP_PORT:-8099}"
OWNER_CONSOLE_PORT="${OWNER_CONSOLE_PORT:-8084}"

usage() {
  cat <<EOF
Usage: $(basename "$0") [command] [options]

Commands:
  check          Validate prerequisites (docker, node, pnpm, disk)
  setup          Build and launch the setup wizard (default)
  reconfigure    Launch the setup wizard in reconfigure mode
  stop           Stop the setup wizard if running
  help           Show this help

Options:
  --port <n>     Setup wizard port (default: 8099)
  --help         Show this help

The setup wizard runs at http://localhost:${SETUP_PORT}
After setup completes, it redirects to the owner console at http://localhost:${OWNER_CONSOLE_PORT}

Examples:
  $(basename "$0")              # Run the full setup wizard
  $(basename "$0") check        # Just check prerequisites
  $(basename "$0") reconfigure  # Edit settings and re-apply them
EOF
}

log() { echo "[first-install] $*"; }
die() { log "FATAL: $*"; exit 1; }
check_command() { command -v "$1" &> /dev/null; }

check_prerequisites() {
  log "Checking prerequisites..."
  local pass=0 fail=0 warn=0

  if check_command docker; then
    local ver; ver=$(docker --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+' | head -1)
    log "  [PASS] Docker ($ver)"; pass=$((pass + 1))
  else
    log "  [FAIL] Docker not found — https://docs.docker.com/get-docker/"; fail=$((fail + 1))
  fi

  if docker compose version &> /dev/null; then
    log "  [PASS] Docker Compose plugin"; pass=$((pass + 1))
  else
    log "  [WARN] Docker Compose plugin not found"; warn=$((warn + 1))
  fi

  if check_command node; then
    log "  [PASS] Node $(node --version 2>/dev/null)"; pass=$((pass + 1))
  else
    log "  [FAIL] Node.js not found — https://nodejs.org"; fail=$((fail + 1))
  fi

  if check_command pnpm; then
    log "  [PASS] pnpm"; pass=$((pass + 1))
  else
    log "  [FAIL] pnpm not found — https://pnpm.io/installation"; fail=$((fail + 1))
  fi

  local avail; avail=$(df -BG "$PROJECT_DIR" 2>/dev/null | awk 'NR==2{print $4}' | sed 's/G//')
  if [ -n "$avail" ] && [ "$avail" -ge 10 ] 2>/dev/null; then
    log "  [PASS] Disk ${avail}GB free"; pass=$((pass + 1))
  else
    log "  [WARN] Less than 10GB free (${avail:-?}GB)"; warn=$((warn + 1))
  fi

  log "Prerequisites: $pass pass, $fail fail, $warn warn"
  [ "$fail" -eq 0 ] && return 0 || return 1
}

is_setup_complete() {
  [ -f "$PROJECT_DIR/.setup-complete" ]
}

is_owner_console_running() {
  curl -sf "http://localhost:${OWNER_CONSOLE_PORT}/" &> /dev/null
}

is_setup_server_running() {
  curl -sf "http://localhost:${SETUP_PORT}/api/setup/status" &> /dev/null
}

open_browser() {
  local url="$1"
  log "Opening $url"
  if check_command xdg-open; then xdg-open "$url" &>/dev/null || true
  elif check_command open; then open "$url" &>/dev/null || true
  else log "Open $url in your browser"
  fi
}

build_setup_console() {
  log "Building setup wizard..."
  (cd "$PROJECT_DIR" && pnpm exec nx build setup-console 2>&1) || die "Build failed"
  log "Setup wizard built successfully"
}

start_setup_console() {
  local mode="${1:-setup}"
  log "Starting setup wizard on port $SETUP_PORT in ${mode} mode..."
  SETUP_WORKSPACE_ROOT="$PROJECT_DIR" \
  ADMIN_API_DEPLOYMENT_PATH="$PROJECT_DIR/ops/deployments/production.yaml" \
  ADMIN_API_SECRETS_PATH="$PROJECT_DIR/.secrets" \
  SETUP_CONSOLE_MODE="$mode" \
  PORT="$SETUP_PORT" \
  node "$PROJECT_DIR/dist/apps/setup-console/server/server.mjs" &
  SETUP_PID=$!
  echo "$SETUP_PID" > /tmp/setup-console.pid
  echo "$mode" > /tmp/setup-console.mode

  log "Waiting for setup wizard to be ready..."
  for i in $(seq 1 30); do
    if is_setup_server_running; then
      log "Setup wizard ready at http://localhost:${SETUP_PORT}"
      return 0
    fi
    sleep 1
  done
  die "Setup wizard failed to start"
}

stop_setup_console() {
  if [ -f /tmp/setup-console.pid ]; then
    local pid; pid=$(cat /tmp/setup-console.pid)
    kill "$pid" 2>/dev/null || true
    rm -f /tmp/setup-console.pid
    log "Setup wizard stopped"
  fi
  rm -f /tmp/setup-console.mode
}

current_setup_mode() {
  if [ -f /tmp/setup-console.mode ]; then
    cat /tmp/setup-console.mode
    return 0
  fi

  return 1
}

ensure_setup_console_mode() {
  local desired_mode="$1"

  if ! is_setup_server_running; then
    build_setup_console
    start_setup_console "$desired_mode"
    return 0
  fi

  local running_mode
  running_mode="$(current_setup_mode || true)"
  if [ "$running_mode" != "$desired_mode" ]; then
    log "Restarting setup wizard in ${desired_mode} mode"
    stop_setup_console
    build_setup_console
    start_setup_console "$desired_mode"
  fi
}

wait_for_setup_completion() {
  log "Waiting for setup to complete (open http://localhost:${SETUP_PORT})..."
  open_browser "http://localhost:${SETUP_PORT}"

  while true; do
    local status
    status=$(curl -sf "http://localhost:${SETUP_PORT}/api/setup/status" 2>/dev/null || echo '{"configured":false}')
    local configured
    configured=$(echo "$status" | grep -o '"configured":true' || echo "")

    if [ -n "$configured" ]; then
      log "Setup complete!"
      return 0
    fi

    if ! is_setup_server_running; then
      log "Setup wizard disconnected — retrying..."
      sleep 3
      continue
    fi

    sleep 2
  done
}

launch_reconfigure_console() {
  check_prerequisites || die "Prerequisites not met"

  if ! is_setup_complete; then
    log "Initial setup has not completed yet — launching setup mode instead"
    ensure_setup_console_mode "setup"
    open_browser "http://localhost:${SETUP_PORT}"
    return 0
  fi

  ensure_setup_console_mode "reconfigure"
  open_browser "http://localhost:${SETUP_PORT}"
}

start_full_stack() {
  log "Starting full platform stack..."
  (cd "$PROJECT_DIR" && docker compose up -d) || log "WARN: docker compose up had issues"
  log "Full stack started"
  open_browser "http://localhost:${OWNER_CONSOLE_PORT}"
}

main() {
  local command="${1:-setup}"
  [ "$#" -gt 0 ] && shift

  while [ $# -gt 0 ]; do
    case "$1" in
      --port) SETUP_PORT="$2"; shift 2 ;;
      --help) usage; exit 0 ;;
      *) die "Unknown option: $1" ;;
    esac
  done

  case "$command" in
    check|prerequisites)
      check_prerequisites
      ;;
    stop)
      stop_setup_console
      ;;
    reconfigure)
      launch_reconfigure_console
      ;;
    setup|start|run)
      check_prerequisites || die "Prerequisites not met"

      if is_owner_console_running; then
        log "Owner console is already running at http://localhost:${OWNER_CONSOLE_PORT}"
        open_browser "http://localhost:${OWNER_CONSOLE_PORT}"
        exit 0
      fi

      if is_setup_complete; then
        log "Setup already complete — starting full stack"
        start_full_stack
        exit 0
      fi

      ensure_setup_console_mode "setup"

      wait_for_setup_completion
      stop_setup_console
      start_full_stack
      ;;
    "")
      main setup
      ;;
    help|--help|-h)
      usage
      ;;
    *)
      die "Unknown command: $command"
      ;;
  esac
}

main "$@"

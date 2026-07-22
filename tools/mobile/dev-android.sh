#!/bin/bash
# Re-exec under bash if invoked via `sh` (dash can't parse the bashisms below).
if [ -z "${BASH_VERSION:-}" ]; then
  exec bash "$0" "$@"
fi
set -euo pipefail

# Orchestrates running a Capacitor dev build on Android with live reload.
# Usage: dev-android.sh <project> [--avd <name>] [--port <port>]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Valid projects (those with committed android/ directories)
VALID_PROJECTS=("forgeofwill" "client-interface" "fin-commander" "local-hub")

# Parse arguments
PROJECT=""
AVD_NAME=""
PORT=4200

while [[ $# -gt 0 ]]; do
  case "$1" in
    --avd)
      AVD_NAME="$2"
      shift 2
      ;;
    --port)
      PORT="$2"
      shift 2
      ;;
    *)
      if [[ -z "$PROJECT" ]]; then
        PROJECT="$1"
        shift
      else
        echo "Unexpected argument: $1" >&2
        exit 1
      fi
      ;;
  esac
done

# Validate project
if [[ -z "$PROJECT" ]]; then
  echo "Usage: dev-android.sh <project> [--avd <name>] [--port <port>]"
  echo ""
  echo "Valid projects: ${VALID_PROJECTS[*]}"
  exit 1
fi

PROJECT_VALID=0
for valid_proj in "${VALID_PROJECTS[@]}"; do
  if [[ "$PROJECT" == "$valid_proj" ]]; then
    PROJECT_VALID=1
    break
  fi
done

if [[ $PROJECT_VALID -eq 0 ]]; then
  echo "Error: Invalid project '$PROJECT'" >&2
  echo "Valid projects: ${VALID_PROJECTS[*]}" >&2
  exit 1
fi

# Validate android directory exists
if [[ ! -d "$WORKSPACE_ROOT/apps/$PROJECT/android" ]]; then
  echo "Error: apps/$PROJECT/android directory not found" >&2
  exit 1
fi

# Set up Android environment
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"

# The Capacitor Gradle template compiles at Java 21 (see docs/mobile.md). Prefer
# Android Studio's bundled JBR when present rather than trusting an inherited
# JAVA_HOME: a caller's shell may already export one pointing at an
# incompatible JDK (too old to satisfy sourceCompatibility 21, or too new for
# this Gradle version), which silently breaks the build instead of failing loudly.
if [[ -x /opt/android-studio/jbr/bin/java ]]; then
  export JAVA_HOME=/opt/android-studio/jbr
elif [[ -z "${JAVA_HOME:-}" ]]; then
  echo "Error: JAVA_HOME is not set and /opt/android-studio/jbr was not found." >&2
  echo "Set JAVA_HOME to a JDK 21 install before running this script." >&2
  exit 1
else
  echo "Warning: /opt/android-studio/jbr not found; using inherited JAVA_HOME=$JAVA_HOME (must be JDK 21)." >&2
fi

export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"

echo "Using ANDROID_HOME: $ANDROID_HOME"
echo "Using JAVA_HOME: $JAVA_HOME"
echo "Project: $PROJECT"
echo "Port: $PORT"
echo ""

# Check for connected devices/emulators. `adb devices` can emit daemon-startup
# noise ("* daemon not running...") and offline/unauthorized entries; only lines
# whose status column is exactly "device" are usable targets.
"$ANDROID_HOME/platform-tools/adb" start-server >/dev/null 2>&1 || true
DEVICE_ID=$("$ANDROID_HOME/platform-tools/adb" devices 2>/dev/null | awk 'NR>1 && $2=="device" {print $1; exit}' || true)

if [[ -n "$DEVICE_ID" ]]; then
  echo "Found connected device: $DEVICE_ID"
else
  echo "No connected device/emulator found. Launching emulator..."

  # Determine which AVD to launch
  if [[ -n "$AVD_NAME" ]]; then
    TARGET_AVD="$AVD_NAME"
  else
    # Get first AVD from list
    AVDS=$("$ANDROID_HOME/emulator/emulator" -list-avds 2>&1 | head -1)
    if [[ -z "$AVDS" ]]; then
      echo "Error: No AVDs available and --avd not specified" >&2
      echo "Please create an AVD or specify one with --avd" >&2
      exit 1
    fi
    TARGET_AVD="$AVDS"
  fi

  echo "Launching emulator: $TARGET_AVD"
  # The emulator's bundled Qt UI needs its own lib dir on LD_LIBRARY_PATH to
  # dlopen the xcb platform plugin, and defaults to whatever QT_QPA_PLATFORM
  # the desktop session exports (e.g. "wayland" under a Wayland session,
  # which the emulator does not ship a plugin for) -- force xcb via XWayland.
  LD_LIBRARY_PATH="$ANDROID_HOME/emulator/lib64:$ANDROID_HOME/emulator/lib64/qt/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}" \
  QT_QPA_PLATFORM=xcb \
  # -gpu host: the emulator's default gfxstream/Vulkan backend can fail a
  # driver feature check (VulkanVirtualQueue) and silently fall back to slow
  # software rendering, which shows up as visible tearing on animation-heavy
  # pages. -gpu host uses classic GL passthrough instead, which is broadly
  # compatible and noticeably smoother when it works.
  nohup "$ANDROID_HOME/emulator/emulator" -avd "$TARGET_AVD" -gpu host > /tmp/ot-emulator.log 2>&1 &
  EMULATOR_PID=$!

  echo "Waiting for emulator to boot (see /tmp/ot-emulator.log for details)..."

  # Poll for boot completion with timeout, bailing out immediately (with the
  # emulator's own error output) if the process dies instead of silently
  # waiting out the full timeout.
  BOOT_TIMEOUT=180
  BOOT_START=$(date +%s)
  while true; do
    if ! kill -0 "$EMULATOR_PID" 2>/dev/null; then
      echo "Error: emulator process exited before finishing boot. Log tail:" >&2
      tail -n 30 /tmp/ot-emulator.log >&2
      exit 1
    fi

    CURRENT=$(date +%s)
    if (( CURRENT - BOOT_START > BOOT_TIMEOUT )); then
      echo "Error: Emulator boot timeout (${BOOT_TIMEOUT}s)" >&2
      exit 1
    fi

    BOOT_COMPLETED=$("$ANDROID_HOME/platform-tools/adb" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)
    if [[ "$BOOT_COMPLETED" == "1" ]]; then
      echo "Emulator boot complete"
      break
    fi
    echo "  ...still booting ($((CURRENT - BOOT_START))s elapsed)"
    sleep 5
  done

  # Get device ID
  DEVICE_ID=$("$ANDROID_HOME/platform-tools/adb" devices 2>/dev/null | awk 'NR>1 && $2=="device" {print $1; exit}' || true)
  if [[ -z "$DEVICE_ID" ]]; then
    echo "Error: Could not determine device ID after emulator boot" >&2
    exit 1
  fi
  echo "Device ID: $DEVICE_ID"
fi

# Start Nx dev server in background
echo ""
echo "Starting Nx dev server for $PROJECT on port $PORT..."
cd "$WORKSPACE_ROOT"
# --host 0.0.0.0: the Angular/Vite dev server defaults to IPv6 loopback only
# ([::1]), but the emulator's 10.0.2.2 host alias only maps to the host's
# IPv4 loopback -- without this the webview gets ERR_CONNECTION_REFUSED even
# though the emulator can reach the host machine fine.
# --configuration mobile-dev: disables SSR for the dev server. With SSR on,
# Angular resolves the app's relative /api calls against the *incoming
# request's* Host header (10.0.2.2:<port>, since that's what the webview
# requested) -- correct for real deployments, but 10.0.2.2 only resolves
# from inside the emulator, not from the SSR process itself (which runs on
# the host), so any SSR-blocking API call hangs until it times out and takes
# the whole page down with it. mobile-dev keeps the local dev proxy (unlike
# the `mobile` build configuration, it does NOT swap in the absolute
# production API URL) while serving CSR-only, matching what the shipped
# mobile app actually is.
nohup pnpm exec nx serve "$PROJECT" --configuration mobile-dev --port "$PORT" --host 0.0.0.0 > "/tmp/ot-dev-server-${PROJECT}.log" 2>&1 &
DEV_SERVER_PID=$!

# Set trap to clean up dev server on exit
trap 'kill $DEV_SERVER_PID 2>/dev/null || true' EXIT

# Wait for dev server to be ready
DEV_SERVER_TIMEOUT=300
DEV_SERVER_START=$(date +%s)
while true; do
  CURRENT=$(date +%s)
  if (( CURRENT - DEV_SERVER_START > DEV_SERVER_TIMEOUT )); then
    echo "Error: Dev server startup timeout (${DEV_SERVER_TIMEOUT}s)" >&2
    exit 1
  fi

  if curl -sf "http://localhost:$PORT" > /dev/null 2>&1; then
    echo "Dev server is ready"
    break
  fi
  sleep 2
done

echo ""
echo "Syncing Capacitor config with env var..."
cd "$WORKSPACE_ROOT/apps/$PROJECT"
CAP_SERVER_URL="http://10.0.2.2:$PORT" pnpm exec cap sync android

echo ""
echo "Running Capacitor on Android device..."
CAP_SERVER_URL="http://10.0.2.2:$PORT" pnpm exec cap run android --target "$DEVICE_ID"

echo ""
echo "App running. Dev server is still running. Press Ctrl-C to stop."
wait $DEV_SERVER_PID

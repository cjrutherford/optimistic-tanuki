#!/bin/bash

# Script to capture screenshots of all Angular applications
# This script starts each Angular app individually and captures screenshots

set -e  # Exit on error

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$( cd "$SCRIPT_DIR/../.." && pwd )"
SCREENSHOTS_DIR="$ROOT_DIR/screenshots"

echo "==================================="
echo "Angular Apps Screenshot Capture"
echo "==================================="
echo ""
echo "This script will:"
echo "1. Build all Angular applications (if needed)"
echo "2. Start each application one at a time"
echo "3. Capture screenshots of all routes"
echo "4. Generate a features report"
echo ""
echo "Screenshots will be saved to: $SCREENSHOTS_DIR"
echo ""

# Create screenshots directory
mkdir -p "$SCREENSHOTS_DIR"

# Change to root directory
cd "$ROOT_DIR"

# List of Angular apps with their configurations
declare -a apps=(
  "client-interface:4200"
  "forgeofwill:4201"
  "christopherrutherford-net:4202"
  "digital-homestead:4203"
)

# Function to check if port is in use
check_port() {
  local port=$1
  if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
    return 0  # Port is in use
  else
    return 1  # Port is free
  fi
}

# Function to wait for server to be ready
wait_for_server() {
  local url=$1
  local max_attempts=60
  local attempt=0
  
  echo "Waiting for server at $url..."
  
  while [ $attempt -lt $max_attempts ]; do
    if curl -s -o /dev/null -w "%{http_code}" "$url" | grep -q "200\|404\|302"; then
      echo "✓ Server is ready!"
      return 0
    fi
    attempt=$((attempt + 1))
    echo "  Attempt $attempt/$max_attempts..."
    sleep 2
  done
  
  echo "✗ Server failed to start within timeout"
  return 1
}

# Function to capture screenshots for an app
capture_app_screenshots() {
  local app_name=$1
  local port=$2
  local base_url="http://localhost:$port"
  
  echo ""
  echo "==================================="
  echo "Processing: $app_name"
  echo "==================================="
  
  # Start the application
  echo "Starting $app_name on port $port..."
  npx nx serve "$app_name" --port="$port" > "/tmp/${app_name}-serve.log" 2>&1 &
  local serve_pid=$!
  
  # Wait for the server to be ready
  if ! wait_for_server "$base_url"; then
    echo "✗ Failed to start $app_name"
    kill $serve_pid 2>/dev/null || true
    return 1
  fi
  
  # Run Playwright tests for this app
  echo "Capturing screenshots for $app_name..."
  cd "$SCRIPT_DIR"
  BASE_URL="$base_url" APP_NAME="$app_name" npx playwright test --grep="$app_name" --config=playwright.config.ts || true
  
  # Stop the application
  echo "Stopping $app_name..."
  kill $serve_pid 2>/dev/null || true
  sleep 2
  
  echo "✓ Completed $app_name"
}

# Main execution
echo "Starting screenshot capture process..."
echo ""

# Process each app
for app_config in "${apps[@]}"; do
  IFS=':' read -r app_name port <<< "$app_config"
  capture_app_screenshots "$app_name" "$port"
done

echo ""
echo "==================================="
echo "Screenshot Capture Complete!"
echo "==================================="
echo ""
echo "Screenshots saved to: $SCREENSHOTS_DIR"
echo ""

# Generate features breakdown report
echo "Generating features breakdown report..."
"$SCRIPT_DIR/generate-features-report.sh"

echo ""
echo "To view the Playwright report, run:"
echo "  cd $SCRIPT_DIR && npm run report"
echo ""
echo "To view the features breakdown:"
echo "  cat $ROOT_DIR/FEATURES_BREAKDOWN.md"
echo ""

#!/bin/bash

# Simple script to capture screenshots of a single Angular application
# Usage: ./capture-single.sh <app-name> [port]

set -e

if [ $# -lt 1 ]; then
  echo "Usage: $0 <app-name> [port]"
  echo ""
  echo "Available apps:"
  echo "  - client-interface (default port: 4200)"
  echo "  - forgeofwill (default port: 4201)"
  echo "  - christopherrutherford-net (default port: 4202)"
  echo "  - digital-homestead (default port: 4203)"
  echo ""
  echo "Example: $0 client-interface 4200"
  exit 1
fi

APP_NAME=$1
PORT=${2:-4200}
BASE_URL="http://localhost:$PORT"

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$( cd "$SCRIPT_DIR/../.." && pwd )"

echo "==================================="
echo "Capturing screenshots for: $APP_NAME"
echo "Port: $PORT"
echo "==================================="

cd "$ROOT_DIR"

# Check if app is already running
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo "App is already running on port $PORT"
  echo "Using existing server..."
  SERVER_RUNNING=true
else
  echo "Starting $APP_NAME..."
  npx nx serve "$APP_NAME" --port="$PORT" > "/tmp/${APP_NAME}-serve.log" 2>&1 &
  SERVER_PID=$!
  SERVER_RUNNING=false
  
  # Wait for server
  echo "Waiting for server to be ready..."
  MAX_WAIT=60
  COUNT=0
  while [ $COUNT -lt $MAX_WAIT ]; do
    if curl -s -o /dev/null "$BASE_URL" 2>/dev/null; then
      echo "✓ Server is ready!"
      break
    fi
    COUNT=$((COUNT + 1))
    sleep 2
  done
  
  if [ $COUNT -eq $MAX_WAIT ]; then
    echo "✗ Server failed to start"
    kill $SERVER_PID 2>/dev/null || true
    exit 1
  fi
fi

# Run Playwright tests
cd "$SCRIPT_DIR"
echo "Capturing screenshots..."
BASE_URL="$BASE_URL" APP_NAME="$APP_NAME" npx playwright test --grep="$APP_NAME" --config=playwright.config.ts

# Cleanup
if [ "$SERVER_RUNNING" = false ]; then
  echo "Stopping server..."
  kill $SERVER_PID 2>/dev/null || true
fi

echo ""
echo "✓ Screenshots captured successfully!"
echo "Screenshots are in: $ROOT_DIR/screenshots/$APP_NAME/"

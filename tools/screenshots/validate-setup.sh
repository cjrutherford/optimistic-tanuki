#!/bin/bash

# Validation script to check if the screenshot capture tool is properly set up

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$( cd "$SCRIPT_DIR/../.." && pwd )"

echo "==================================="
echo "Screenshot Tool Setup Validation"
echo "==================================="
echo ""

# Check if we're in the right directory
if [ ! -f "$ROOT_DIR/package.json" ]; then
  echo "✗ Error: Not in the correct repository root"
  exit 1
fi
echo "✓ Repository root found"

# Check if node_modules exists
if [ ! -d "$ROOT_DIR/node_modules" ]; then
  echo "✗ node_modules not found. Please run: npm install"
  exit 1
fi
echo "✓ node_modules found"

# Check if Playwright is installed
if ! command -v npx &> /dev/null; then
  echo "✗ npx not found. Please install Node.js"
  exit 1
fi
echo "✓ npx available"

# Check if TypeScript compiles
echo ""
echo "Checking TypeScript compilation..."
cd "$SCRIPT_DIR"
if npx tsc --noEmit 2>&1 | grep -q "error TS"; then
  echo "✗ TypeScript compilation errors found"
  npx tsc --noEmit
  exit 1
fi
echo "✓ TypeScript compiles successfully"

# Check if Playwright config is valid
echo ""
echo "Checking Playwright configuration..."
if npx playwright test --list --config=playwright.config.ts > /dev/null 2>&1; then
  TEST_COUNT=$(npx playwright test --list --config=playwright.config.ts 2>/dev/null | grep "Total:" | awk '{print $2}')
  echo "✓ Playwright configuration valid"
  echo "  Found $TEST_COUNT tests configured"
else
  echo "✗ Playwright configuration has errors"
  exit 1
fi

# Check if Playwright browsers are installed
echo ""
echo "Checking Playwright browsers..."
if npx playwright install --dry-run chromium 2>&1 | grep -q "is already installed"; then
  echo "✓ Chromium browser is installed"
elif npx playwright install --dry-run chromium 2>&1 | grep -q "needs to be installed"; then
  echo "⚠ Chromium browser needs to be installed"
  echo "  Run: npx playwright install chromium"
  NEEDS_BROWSER=true
else
  # Try to check if browser exists
  if [ -d "$HOME/.cache/ms-playwright" ]; then
    echo "✓ Playwright browsers cache exists"
  else
    echo "⚠ Chromium browser may need to be installed"
    echo "  Run: npx playwright install chromium"
    NEEDS_BROWSER=true
  fi
fi

# Check Angular applications
echo ""
echo "Checking Angular applications..."
cd "$ROOT_DIR"

APPS=("client-interface" "forgeofwill" "christopherrutherford-net" "digital-homestead")
for app in "${APPS[@]}"; do
  if [ -d "apps/$app" ] && [ -f "apps/$app/project.json" ]; then
    echo "✓ $app found"
  else
    echo "✗ $app not found or missing project.json"
  fi
done

# Summary
echo ""
echo "==================================="
echo "Validation Summary"
echo "==================================="
echo ""

if [ "$NEEDS_BROWSER" = true ]; then
  echo "⚠ Setup is mostly complete, but Playwright browser needs installation:"
  echo "  npx playwright install chromium"
  echo ""
  echo "After installing the browser, you can run:"
  echo "  cd tools/screenshots"
  echo "  ./capture-single.sh client-interface 4200"
else
  echo "✓ Setup is complete! You can now capture screenshots."
  echo ""
  echo "Try running:"
  echo "  cd tools/screenshots"
  echo "  ./capture-single.sh client-interface 4200"
fi

echo ""
echo "For more information, see:"
echo "  - SCREENSHOT_CAPTURE_GUIDE.md (quick start)"
echo "  - tools/screenshots/README.md (full documentation)"
echo ""

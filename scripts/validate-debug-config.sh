#!/bin/bash
# Validation script for debugging and hot reload configuration
# This script validates that all configurations are properly aligned

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

echo "========================================="
echo "Debug Configuration Validation"
echo "========================================="
echo ""

ERRORS=0

# Function to report error
report_error() {
    echo "❌ ERROR: $1"
    ERRORS=$((ERRORS + 1))
}

# Function to report success
report_success() {
    echo "✅ $1"
}

echo "1. Validating inspector ports alignment..."
echo ""

# Check for duplicates in docker-compose.dev.yaml
echo "   Checking for duplicate ports..."
DUPLICATE_DOCKER_PORTS=$(grep -E "--inspect=" "$REPO_ROOT/docker-compose.dev.yaml" | sed 's/.*--inspect=0.0.0.0://' | sed "s/'.*//g" | sort | uniq -d)
if [ -n "$DUPLICATE_DOCKER_PORTS" ]; then
    report_error "Duplicate inspector ports in docker-compose.dev.yaml: $DUPLICATE_DOCKER_PORTS"
else
    report_success "No duplicate ports in docker-compose.dev.yaml"
fi

DUPLICATE_VSCODE_PORTS=$(grep '"port":' "$REPO_ROOT/.vscode/launch.json" | sed 's/.*: //' | sed 's/,$//' | sort | uniq -d)
if [ -n "$DUPLICATE_VSCODE_PORTS" ]; then
    report_error "Duplicate inspector ports in launch.json: $DUPLICATE_VSCODE_PORTS"
else
    report_success "No duplicate ports in launch.json"
fi

echo ""
echo "2. Validating source map configuration..."
echo ""

# Check all tsconfig.app.json files for sourceMap
MISSING_SOURCEMAP=0
for file in "$REPO_ROOT"/apps/*/tsconfig.app.json; do
    if [ -f "$file" ]; then
        app=$(basename $(dirname "$file"))
        if ! grep -q "sourceMap" "$file"; then
            report_error "Missing sourceMap in $app/tsconfig.app.json"
            MISSING_SOURCEMAP=$((MISSING_SOURCEMAP + 1))
        fi
    fi
done

if [ $MISSING_SOURCEMAP -eq 0 ]; then
    report_success "All tsconfig.app.json files have sourceMap enabled"
fi

echo ""
echo "3. Validating VS Code debug configurations..."
echo ""

# Count Docker debug configurations
DOCKER_CONFIGS=$(grep -c '"name".*Docker' "$REPO_ROOT/.vscode/launch.json" || echo 0)

# Count configurations with sourceMaps
SOURCEMAPS_COUNT=$(grep -c '"sourceMaps": true' "$REPO_ROOT/.vscode/launch.json" || echo 0)

# Count configurations with outFiles
OUTFILES_COUNT=$(grep -c '"outFiles":' "$REPO_ROOT/.vscode/launch.json" || echo 0)

if [ "$SOURCEMAPS_COUNT" -lt "$DOCKER_CONFIGS" ]; then
    report_error "Some Docker debug configurations missing sourceMaps property"
else
    report_success "All Docker debug configurations have sourceMaps enabled"
fi

if [ "$OUTFILES_COUNT" -lt "$DOCKER_CONFIGS" ]; then
    report_error "Some Docker debug configurations missing outFiles property"
else
    report_success "All Docker debug configurations have outFiles configured"
fi

echo ""
echo "4. Validating volume mount paths..."
echo ""

# Check for /usr/src_app (incorrect) in docker-compose files
if grep -q "/usr/src_app" "$REPO_ROOT/docker-compose.dev.yaml"; then
    report_error "Found incorrect path /usr/src_app in docker-compose.dev.yaml (should be /usr/src/app)"
else
    report_success "docker-compose.dev.yaml uses correct path /usr/src/app"
fi

if grep -q "/usr/src_app" "$REPO_ROOT/fow.docker-compose.dev.yaml"; then
    report_error "Found incorrect path /usr/src_app in fow.docker-compose.dev.yaml (should be /usr/src/app)"
else
    report_success "fow.docker-compose.dev.yaml uses correct path /usr/src/app"
fi

if grep -q "/usr/src_app" "$REPO_ROOT/.vscode/launch.json"; then
    report_error "Found incorrect path /usr/src_app in launch.json (should be /usr/src/app)"
else
    report_success "launch.json does not contain incorrect path /usr/src_app"
fi

echo ""
echo "5. Validating documentation..."
echo ""

if [ ! -f "$REPO_ROOT/DEVELOPMENT_DEBUGGING_GUIDE.md" ]; then
    report_error "DEVELOPMENT_DEBUGGING_GUIDE.md not found"
else
    report_success "DEVELOPMENT_DEBUGGING_GUIDE.md exists"
fi

# Check if README mentions debugging
if grep -q "DEVELOPMENT_DEBUGGING_GUIDE" "$REPO_ROOT/README.md"; then
    report_success "README.md references debugging guide"
else
    report_error "README.md does not reference DEVELOPMENT_DEBUGGING_GUIDE.md"
fi

echo ""
echo "========================================="
if [ $ERRORS -eq 0 ]; then
    echo "✅ All validation checks passed!"
    echo "========================================="
    exit 0
else
    echo "❌ Validation failed with $ERRORS error(s)"
    echo "========================================="
    exit 1
fi

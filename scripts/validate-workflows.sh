#!/bin/bash
# Validate GitHub Actions workflow files
# Uses actionlint if available; falls back to basic YAML syntax check via python or node

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
WORKFLOWS_DIR="$PROJECT_DIR/.github/workflows"

echo "========================================="
echo "GitHub Actions Workflow Validation"
echo "========================================="
echo ""

ERRORS=0

report_error() {
    echo "❌ ERROR: $1"
    ERRORS=$((ERRORS + 1))
}

report_success() {
    echo "✅ $1"
}

report_info() {
    echo "ℹ️  $1"
}

# Check that the workflows directory exists
if [ ! -d "$WORKFLOWS_DIR" ]; then
    report_error ".github/workflows directory not found: $WORKFLOWS_DIR"
    exit 1
fi

WORKFLOW_FILES=("$WORKFLOWS_DIR"/*.yml "$WORKFLOWS_DIR"/*.yaml)
# Filter to files that actually exist
FOUND_FILES=()
for f in "${WORKFLOW_FILES[@]}"; do
    [ -f "$f" ] && FOUND_FILES+=("$f")
done

if [ ${#FOUND_FILES[@]} -eq 0 ]; then
    report_error "No workflow files found in $WORKFLOWS_DIR"
    exit 1
fi

echo "Found ${#FOUND_FILES[@]} workflow file(s) in $WORKFLOWS_DIR"
echo ""

# -----------------------------------------------------------------------
# Step 1: actionlint (preferred)
# -----------------------------------------------------------------------
echo "1. Checking for actionlint..."
if command -v actionlint &>/dev/null; then
    report_success "actionlint is installed: $(actionlint --version 2>/dev/null || echo 'version unknown')"
    echo ""
    echo "   Running actionlint on all workflow files..."
    if actionlint "$WORKFLOWS_DIR"/*.yml "$WORKFLOWS_DIR"/*.yaml 2>/dev/null || \
       actionlint "$WORKFLOWS_DIR"/*.yml 2>/dev/null; then
        report_success "actionlint passed for all workflow files"
    else
        report_error "actionlint reported issues (see output above)"
    fi
else
    report_info "actionlint is not installed."
    echo ""
    echo "   actionlint provides comprehensive GitHub Actions validation including:"
    echo "   - Workflow syntax and schema validation"
    echo "   - Expression syntax checking"
    echo "   - Shell script analysis inside 'run:' steps"
    echo "   - Action input/output validation"
    echo ""
    echo "   Install actionlint:"
    echo "     # macOS (Homebrew) — verified via Homebrew's own checksum system"
    echo "     brew install actionlint"
    echo ""
    echo "     # Linux — download pre-built binary (review the script before running)"
    echo "     bash <(curl https://raw.githubusercontent.com/rhysd/actionlint/main/scripts/download-actionlint.bash)"
    echo "     # Or download a specific release and verify its SHA256 checksum:"
    echo "     # https://github.com/rhysd/actionlint/releases"
    echo ""
    echo "     # Go"
    echo "     go install github.com/rhysd/actionlint/cmd/actionlint@latest"
    echo ""
    report_info "Skipping actionlint check; falling back to basic YAML validation."
fi

echo ""

# -----------------------------------------------------------------------
# Step 2: Basic YAML syntax validation (always runs)
# -----------------------------------------------------------------------
echo "2. Running basic YAML syntax validation..."
echo ""

YAML_ERRORS=0

# Try python first, then node as fallback
if command -v python3 &>/dev/null; then
    for wf in "${FOUND_FILES[@]}"; do
        wf_name="$(basename "$wf")"
        if python3 -c "import sys, yaml; yaml.safe_load(open(sys.argv[1]))" "$wf" 2>/dev/null; then
            report_success "YAML syntax OK: $wf_name"
        else
            # Print the actual error
            python3 -c "
import sys, yaml
try:
    yaml.safe_load(open(sys.argv[1]))
except yaml.YAMLError as e:
    print(f'YAML error in {sys.argv[1]}: {e}')
    sys.exit(1)
" "$wf" || true
            report_error "YAML syntax error in $wf_name"
            YAML_ERRORS=$((YAML_ERRORS + 1))
        fi
    done
elif command -v node &>/dev/null; then
    for wf in "${FOUND_FILES[@]}"; do
        wf_name="$(basename "$wf")"
        if node -e "
const fs = require('fs');
const content = fs.readFileSync(process.argv[1], 'utf8');
// Very basic structural check: ensure it's non-empty and starts like YAML
if (!content.trim()) { console.error('Empty file'); process.exit(1); }
// Check for obvious tab indentation errors (YAML forbids tabs)
const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (/^\t/.test(lines[i])) {
    console.error('Tab indentation at line ' + (i+1) + ': ' + lines[i].substring(0,40));
    process.exit(1);
  }
}
" "$wf" 2>/dev/null; then
            report_success "YAML basic check OK: $wf_name"
        else
            report_error "YAML issue in $wf_name"
            YAML_ERRORS=$((YAML_ERRORS + 1))
        fi
    done
else
    report_info "Neither python3 nor node available; skipping YAML syntax check."
fi

if [ "$YAML_ERRORS" -gt 0 ]; then
    ERRORS=$((ERRORS + YAML_ERRORS))
fi

echo ""

# -----------------------------------------------------------------------
# Step 3: Check required top-level keys
# -----------------------------------------------------------------------
echo "3. Checking required workflow keys (name, on, jobs)..."
echo ""

for wf in "${FOUND_FILES[@]}"; do
    wf_name="$(basename "$wf")"
    missing_keys=""
    for key in "^name:" "^on:" "^jobs:"; do
        if ! grep -qE "$key" "$wf"; then
            missing_keys="$missing_keys $(echo "$key" | tr -d '^:')"
        fi
    done
    if [ -n "$missing_keys" ]; then
        report_error "$wf_name: missing required key(s):$missing_keys"
        ERRORS=$((ERRORS + 1))
    else
        report_success "Required keys present: $wf_name"
    fi
done

echo ""

# -----------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------
echo "========================================="
if [ "$ERRORS" -eq 0 ]; then
    echo "✅ Workflow validation passed!"
    echo "========================================="
    exit 0
else
    echo "❌ Workflow validation failed with $ERRORS error(s)"
    echo "========================================="
    exit 1
fi

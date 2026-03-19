#!/bin/bash
# Preflight check for GitHub Actions workflows
# Run this before pushing to catch workflow issues early
#
# Usage:
#   ./scripts/preflight-github-actions.sh
#   ./scripts/preflight-github-actions.sh --skip-references

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

SKIP_REFERENCES=false
for arg in "$@"; do
    case "$arg" in
        --skip-references) SKIP_REFERENCES=true ;;
        --help|-h)
            echo "Usage: $0 [--skip-references]"
            echo ""
            echo "Runs local preflight validation for GitHub Actions workflows:"
            echo "  1. Validates workflow YAML syntax and structure"
            echo "  2. Validates that files referenced by workflows exist"
            echo ""
            echo "Options:"
            echo "  --skip-references   Skip the file-reference validation step"
            echo "  --help              Show this help message"
            exit 0
            ;;
    esac
done

echo "========================================="
echo "GitHub Actions Preflight Check"
echo "========================================="
echo ""

OVERALL_ERRORS=0

# -----------------------------------------------------------------------
# Step 1: Workflow syntax validation
# -----------------------------------------------------------------------
echo ">>> Step 1/2: Validating workflow syntax"
echo ""

if bash "$SCRIPT_DIR/validate-workflows.sh"; then
    echo ""
    echo "✅ Step 1 passed"
else
    echo ""
    echo "❌ Step 1 failed"
    OVERALL_ERRORS=$((OVERALL_ERRORS + 1))
fi

echo ""

# -----------------------------------------------------------------------
# Step 2: Workflow reference validation
# -----------------------------------------------------------------------
if [ "$SKIP_REFERENCES" = false ]; then
    echo ">>> Step 2/2: Validating workflow file references"
    echo ""

    if bash "$SCRIPT_DIR/validate-workflow-references.sh"; then
        echo ""
        echo "✅ Step 2 passed"
    else
        echo ""
        echo "❌ Step 2 failed"
        OVERALL_ERRORS=$((OVERALL_ERRORS + 1))
    fi
else
    echo ">>> Step 2/2: Skipping reference validation (--skip-references)"
fi

echo ""

# -----------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------
echo "========================================="
if [ "$OVERALL_ERRORS" -eq 0 ]; then
    echo "✅ Preflight passed — safe to push!"
else
    echo "❌ Preflight failed with $OVERALL_ERRORS step(s) failing"
    echo ""
    echo "Fix the issues listed above before pushing."
fi
echo "========================================="

exit "$OVERALL_ERRORS"

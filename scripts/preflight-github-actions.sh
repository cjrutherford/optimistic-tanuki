#!/bin/bash
# Preflight check for GitHub Actions workflows
# Run this before pushing to catch workflow issues early
#
# Usage:
#   ./scripts/preflight-github-actions.sh
#   ./scripts/preflight-github-actions.sh --skip-references
#   ./scripts/preflight-github-actions.sh --act lint.yml
#   ./scripts/preflight-github-actions.sh --act lint.yml --act unit-tests.yml

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

SKIP_REFERENCES=false
ACT_WORKFLOWS=()

while [[ $# -gt 0 ]]; do
    case "$1" in
        --skip-references)
            SKIP_REFERENCES=true
            shift
            ;;
        --act)
            ACT_WORKFLOWS+=("$2")
            shift 2
            ;;
        --help|-h)
            echo "Usage: $0 [options]"
            echo ""
            echo "Runs local preflight validation for GitHub Actions workflows:"
            echo "  1. Validates workflow YAML syntax and structure"
            echo "  2. Validates that files referenced by workflows exist"
            echo "  3. (Optional) Runs selected Tier 1/2 workflows via 'act'"
            echo ""
            echo "Options:"
            echo "  --skip-references         Skip the file-reference validation step"
            echo "  --act <workflow.yml>       Run a specific workflow with act (repeatable)"
            echo "  --help                    Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0"
            echo "  $0 --act lint.yml --act unit-tests.yml"
            echo "  $0 --skip-references --act build.yml"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Run '$0 --help' for usage."
            exit 1
            ;;
    esac
done

TOTAL_STEPS=2
[ ${#ACT_WORKFLOWS[@]} -gt 0 ] && TOTAL_STEPS=$((TOTAL_STEPS + 1))

echo "========================================="
echo "GitHub Actions Preflight Check"
echo "========================================="
echo ""

OVERALL_ERRORS=0
CURRENT_STEP=0

# -----------------------------------------------------------------------
# Step 1: Workflow syntax validation
# -----------------------------------------------------------------------
CURRENT_STEP=$((CURRENT_STEP + 1))
echo ">>> Step $CURRENT_STEP/$TOTAL_STEPS: Validating workflow syntax"
echo ""

if bash "$SCRIPT_DIR/validate-workflows.sh"; then
    echo ""
    echo "✅ Step $CURRENT_STEP passed"
else
    echo ""
    echo "❌ Step $CURRENT_STEP failed"
    OVERALL_ERRORS=$((OVERALL_ERRORS + 1))
fi

echo ""

# -----------------------------------------------------------------------
# Step 2: Workflow reference validation
# -----------------------------------------------------------------------
CURRENT_STEP=$((CURRENT_STEP + 1))
if [ "$SKIP_REFERENCES" = false ]; then
    echo ">>> Step $CURRENT_STEP/$TOTAL_STEPS: Validating workflow file references"
    echo ""

    if bash "$SCRIPT_DIR/validate-workflow-references.sh"; then
        echo ""
        echo "✅ Step $CURRENT_STEP passed"
    else
        echo ""
        echo "❌ Step $CURRENT_STEP failed"
        OVERALL_ERRORS=$((OVERALL_ERRORS + 1))
    fi
else
    echo ">>> Step $CURRENT_STEP/$TOTAL_STEPS: Skipping reference validation (--skip-references)"
fi

echo ""

# -----------------------------------------------------------------------
# Step 3: Optional act execution
# -----------------------------------------------------------------------
if [ ${#ACT_WORKFLOWS[@]} -gt 0 ]; then
    CURRENT_STEP=$((CURRENT_STEP + 1))
    echo ">>> Step $CURRENT_STEP/$TOTAL_STEPS: Running workflows with act"
    echo ""

    ACT_ERRORS=0
    for wf in "${ACT_WORKFLOWS[@]}"; do
        echo "--- Running: $wf ---"
        if bash "$SCRIPT_DIR/run-workflow-act.sh" "$wf"; then
            echo "✅ act passed: $wf"
        else
            echo "❌ act failed: $wf"
            ACT_ERRORS=$((ACT_ERRORS + 1))
        fi
        echo ""
    done

    if [ "$ACT_ERRORS" -eq 0 ]; then
        echo "✅ Step $CURRENT_STEP passed"
    else
        echo "❌ Step $CURRENT_STEP failed ($ACT_ERRORS workflow(s) failed)"
        OVERALL_ERRORS=$((OVERALL_ERRORS + 1))
    fi

    echo ""
fi

# -----------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------
echo "========================================="
if [ "$OVERALL_ERRORS" -eq 0 ]; then
    echo "✅ Preflight passed — safe to push!"
    echo "========================================="
    exit 0
else
    echo "❌ Preflight failed with $OVERALL_ERRORS step(s) failing"
    echo ""
    echo "Fix the issues listed above before pushing."
    echo "========================================="
    exit 1
fi

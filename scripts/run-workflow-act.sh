#!/bin/bash
# Run GitHub Actions workflows locally using 'act'
# https://github.com/nektos/act
#
# Usage:
#   ./scripts/run-workflow-act.sh <workflow> [--job <job>] [--event <event>] [--dry-run]
#
# Examples:
#   ./scripts/run-workflow-act.sh lint.yml
#   ./scripts/run-workflow-act.sh build.yml --job build
#   ./scripts/run-workflow-act.sh unit-tests.yml --event push
#   ./scripts/run-workflow-act.sh ci.yml --dry-run

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
WORKFLOWS_DIR="$PROJECT_DIR/.github/workflows"

# ---------------------------------------------------------------------------
# Workflow tier classification
# Tier 1 – good act candidates (mostly local toolchain)
# Tier 2 – hybrid; act may work partially
# Tier 3 – remote-dominant; validate statically only, skip act execution
# ---------------------------------------------------------------------------
declare -A WORKFLOW_TIER
WORKFLOW_TIER["lint.yml"]=1
WORKFLOW_TIER["yci.yml"]=1
WORKFLOW_TIER["unit-tests.yml"]=1
WORKFLOW_TIER["build.yml"]=2
WORKFLOW_TIER["ci.yml"]=2
WORKFLOW_TIER["coverage.yml"]=2
WORKFLOW_TIER["e2e-tests.yml"]=2
WORKFLOW_TIER["capture-screenshots.yml"]=2
WORKFLOW_TIER["performance.yml"]=3
WORKFLOW_TIER["deploy.yml"]=3
WORKFLOW_TIER["docker-publish.yml"]=3
WORKFLOW_TIER["build-push.yml"]=3
WORKFLOW_TIER["dependency-updates.yml"]=3
WORKFLOW_TIER["njsscan.yml"]=3

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
WORKFLOW_NAME=""
JOB_FILTER=""
EVENT_TYPE=""
DRY_RUN=false
LIST_WORKFLOWS=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --job|-j)
            JOB_FILTER="$2"
            shift 2
            ;;
        --event|-e)
            EVENT_TYPE="$2"
            shift 2
            ;;
        --dry-run|-n)
            DRY_RUN=true
            shift
            ;;
        --list|-l)
            LIST_WORKFLOWS=true
            shift
            ;;
        --help|-h)
            cat <<'EOF'
Usage: run-workflow-act.sh <workflow> [options]

Run GitHub Actions workflows locally using 'act'.

Arguments:
  <workflow>          Workflow filename (e.g. lint.yml, build.yml)

Options:
  --job <name>        Run only a specific job within the workflow
  --event <type>      GitHub event to simulate (default: push)
  --dry-run           List what act would do without executing
  --list              List all workflows with their tier classification
  --help              Show this help message

Tier classifications:
  Tier 1  Good act candidates — run safely on local toolchain
  Tier 2  Hybrid — act may work for core steps; some steps skipped
  Tier 3  Remote-dominant — skip act; use static validation only

Requirements:
  - act must be installed (https://github.com/nektos/act)
  - Docker must be running
  - Optional: .act.secrets file at project root (see .act.secrets.example)

EOF
            exit 0
            ;;
        -*)
            echo "Unknown option: $1"
            exit 1
            ;;
        *)
            WORKFLOW_NAME="$1"
            shift
            ;;
    esac
done

# ---------------------------------------------------------------------------
# List mode
# ---------------------------------------------------------------------------
if [ "$LIST_WORKFLOWS" = true ]; then
    echo "========================================="
    echo "Workflow Tier Classification"
    echo "========================================="
    echo ""
    echo "Tier 1 — safe to run with act (local toolchain)"
    for wf in "${!WORKFLOW_TIER[@]}"; do
        if [ "${WORKFLOW_TIER[$wf]}" = "1" ]; then echo "  ✅ $wf"; fi
    done | sort
    echo ""
    echo "Tier 2 — hybrid; act may work for core steps"
    for wf in "${!WORKFLOW_TIER[@]}"; do
        if [ "${WORKFLOW_TIER[$wf]}" = "2" ]; then echo "  ⚠️  $wf"; fi
    done | sort
    echo ""
    echo "Tier 3 — remote-dominant; static validation only"
    for wf in "${!WORKFLOW_TIER[@]}"; do
        if [ "${WORKFLOW_TIER[$wf]}" = "3" ]; then echo "  🔒 $wf"; fi
    done | sort
    echo ""
    exit 0
fi

# ---------------------------------------------------------------------------
# Require workflow name
# ---------------------------------------------------------------------------
if [ -z "$WORKFLOW_NAME" ]; then
    echo "Error: No workflow specified."
    echo "Usage: $0 <workflow.yml> [--job <job>] [--event <event>] [--dry-run]"
    echo "       $0 --list  (show all workflows and their tier)"
    exit 1
fi

# ---------------------------------------------------------------------------
# Check act is installed
# ---------------------------------------------------------------------------
if ! command -v act &>/dev/null; then
    echo "========================================="
    echo "❌ 'act' is not installed"
    echo "========================================="
    echo ""
    echo "'act' runs GitHub Actions workflows locally using Docker."
    echo ""
    echo "Install act:"
    echo ""
    echo "  # macOS (Homebrew)"
    echo "  brew install act"
    echo ""
    echo "  # Linux — download binary (review before running)"
    echo "  curl -s https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash"
    echo ""
    echo "  # Go toolchain"
    echo "  go install github.com/nektos/act@latest"
    echo ""
    echo "  # Full install docs: https://nektosact.com/installation/"
    echo ""
    echo "Docker must also be running for act to work."
    exit 1
fi

# ---------------------------------------------------------------------------
# Check Docker is running
# ---------------------------------------------------------------------------
if ! docker info &>/dev/null; then
    echo "❌ Docker is not running. Start Docker and try again."
    exit 1
fi

# ---------------------------------------------------------------------------
# Resolve workflow file
# ---------------------------------------------------------------------------
WORKFLOW_FILE="$WORKFLOWS_DIR/$WORKFLOW_NAME"
if [ ! -f "$WORKFLOW_FILE" ]; then
    echo "❌ Workflow file not found: $WORKFLOW_FILE"
    echo "   Available workflows:"
    ls "$WORKFLOWS_DIR"/*.yml 2>/dev/null | xargs -n1 basename | sed 's/^/     /'
    exit 1
fi

# ---------------------------------------------------------------------------
# Check tier
# ---------------------------------------------------------------------------
TIER="${WORKFLOW_TIER[$WORKFLOW_NAME]:-2}"

if [ "$TIER" = "3" ]; then
    echo "========================================="
    echo "⚠️  $WORKFLOW_NAME is Tier 3 (remote-dominant)"
    echo "========================================="
    echo ""
    echo "This workflow requires remote GitHub infrastructure:"
    echo "  - Docker registry credentials"
    echo "  - OIDC tokens / cloud auth"
    echo "  - Kubernetes cluster access"
    echo "  - GitHub-specific context (GITHUB_TOKEN, environments)"
    echo ""
    echo "Recommendation: Use static validation instead:"
    echo "  npm run ci:validate:workflows"
    echo "  npm run ci:validate:references"
    echo ""
    echo "To override and attempt act execution anyway, set:"
    echo "  ACT_FORCE=1 $0 $WORKFLOW_NAME"
    echo ""
    if [ "${ACT_FORCE:-0}" != "1" ]; then
        exit 1
    fi
    echo "ACT_FORCE=1 set — attempting act execution (may fail at auth steps)..."
    echo ""
fi

# ---------------------------------------------------------------------------
# Determine event type
# ---------------------------------------------------------------------------
if [ -z "$EVENT_TYPE" ]; then
    # Use a sensible default per workflow
    case "$WORKFLOW_NAME" in
        dependency-updates.yml)   EVENT_TYPE="schedule" ;;
        capture-screenshots.yml)  EVENT_TYPE="workflow_dispatch" ;;
        performance.yml)          EVENT_TYPE="pull_request" ;;
        *)                        EVENT_TYPE="push" ;;
    esac
fi

# ---------------------------------------------------------------------------
# Build act command
# ---------------------------------------------------------------------------
ACT_CMD="act $EVENT_TYPE"
ACT_CMD+=" --workflows $WORKFLOW_FILE"

# Use a medium runner image that's compatible with most workflows
ACT_CMD+=" --platform ubuntu-latest=ghcr.io/catthehacker/ubuntu:act-22.04"

# Load secrets from .act.secrets if it exists
SECRETS_FILE="$PROJECT_DIR/.act.secrets"
if [ -f "$SECRETS_FILE" ]; then
    ACT_CMD+=" --secret-file $SECRETS_FILE"
else
    echo "ℹ️  No .act.secrets file found. Copy .act.secrets.example to .act.secrets and fill in values."
    echo "   Some workflow steps may fail without secrets."
    echo ""
fi

# Load env vars from .act.env if it exists
ENV_FILE="$PROJECT_DIR/.act.env"
if [ -f "$ENV_FILE" ]; then
    ACT_CMD+=" --env-file $ENV_FILE"
fi

# Apply job filter
if [ -n "$JOB_FILTER" ]; then
    ACT_CMD+=" --job $JOB_FILTER"
fi

# Apply dry run
if [ "$DRY_RUN" = true ]; then
    ACT_CMD+=" --list"
fi

# ---------------------------------------------------------------------------
# Execute
# ---------------------------------------------------------------------------
echo "========================================="
echo "Running: $WORKFLOW_NAME"
echo "  Event:  $EVENT_TYPE"
echo "  Tier:   $TIER"
[ -n "$JOB_FILTER" ] && echo "  Job:    $JOB_FILTER"
[ "$DRY_RUN" = true ] && echo "  Mode:   dry run (--list)"
echo "========================================="
echo ""

cd "$PROJECT_DIR"
eval "$ACT_CMD"

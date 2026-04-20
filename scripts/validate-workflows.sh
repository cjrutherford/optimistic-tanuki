#!/usr/bin/env bash
# validate-workflows.sh - Validate GitHub Actions workflow files before committing.
#
# Usage:
#   ./scripts/validate-workflows.sh                 # validates .github/workflows/
#   ./scripts/validate-workflows.sh path/to/dir     # validates a specific directory
#
# Checks performed:
#   1. YAML syntax (via actionlint, yamllint, or python3 as fallback)
#   2. Common anti-patterns (wrong package manager in pnpm repo, missing permissions, overlay loop risk)
#
# Install actionlint for the most thorough checks:
#   go install github.com/rhysd/actionlint/cmd/actionlint@latest
#
# To run as a git pre-commit hook, add this to .git/hooks/pre-commit:
#   #!/usr/bin/env bash
#   bash scripts/validate-workflows.sh
#   exit $?

set -euo pipefail

WORKFLOW_DIR="${1:-.github/workflows}"
ERRORS=0
WARNINGS=0

echo "Validating GitHub Actions workflows in '$WORKFLOW_DIR'..."
echo ""

# ── 1. Structural YAML validation ────────────────────────────────────────────

if command -v actionlint >/dev/null 2>&1; then
  echo "▶ Running actionlint (full semantic validation)..."
  if ! actionlint "$WORKFLOW_DIR"/*.yml; then
    ERRORS=$((ERRORS + 1))
  fi
  echo ""
elif command -v yamllint >/dev/null 2>&1; then
  echo "▶ Running yamllint (YAML syntax, structure errors only)..."
  YAMLLINT_CFG="{extends: default, rules: {line-length: disable, trailing-spaces: disable, comments: disable, comments-indentation: disable, document-start: disable}}"
  YAML_ERRORS=0
  for file in "$WORKFLOW_DIR"/*.yml; do
    OUTPUT=$(yamllint -d "$YAMLLINT_CFG" "$file" 2>&1 | grep '\[error\]' || true)
    if [ -n "$OUTPUT" ]; then
      echo "  ❌ $file:"
      echo "$OUTPUT" | sed 's/^/     /'
      YAML_ERRORS=$((YAML_ERRORS + 1))
    fi
  done
  if [ "$YAML_ERRORS" -gt 0 ]; then
    ERRORS=$((ERRORS + 1))
  fi
  echo ""
else
  echo "▶ Checking YAML syntax with python3..."
  for file in "$WORKFLOW_DIR"/*.yml; do
    if ! python3 -c "import yaml, sys; yaml.safe_load(open(sys.argv[1]))" "$file" 2>/dev/null; then
      echo "  ❌ Invalid YAML: $file"
      ERRORS=$((ERRORS + 1))
    else
      echo "  ✅ OK: $file"
    fi
  done
  echo ""
fi

# ── 2. Common anti-pattern checks ────────────────────────────────────────────

echo "▶ Checking for common anti-patterns..."

for file in "$WORKFLOW_DIR"/*.yml; do
  filename=$(basename "$file")
  HAS_OVERLAY_NEGATION=0
  if grep -qE "^\s+-\s+'?!k8s/overlays/staging/\*\*'?" "$file" && \
     grep -qE "^\s+-\s+'?!k8s/overlays/production/\*\*'?" "$file"; then
    HAS_OVERLAY_NEGATION=1
  fi

  # Warn if the wrong package manager is used in a pnpm-managed repo
  # (skip YAML comments — lines whose first non-space character is '#')
  # Use \bnpm\b to avoid false-positive matches on 'pnpm install'
  if grep -qE '^\s+run:.*\bnpm (ci|install)\b' "$file" || \
     grep -qE '^\s+- \bnpm (ci|install)\b' "$file"; then
    echo "  ⚠️  $filename: uses the wrong package manager in a pnpm repo — use 'pnpm install --frozen-lockfile'"
    WARNINGS=$((WARNINGS + 1))
  fi

  # Warn if no top-level permissions block
  if ! grep -q '^permissions:' "$file"; then
    echo "  ⚠️  $filename: no top-level 'permissions:' block — consider adding least-privilege permissions"
    WARNINGS=$((WARNINGS + 1))
  fi

  # Warn if workflow triggers on k8s/** push but has no paths-ignore for overlays
  if grep -qE "^\s+-\s+'?k8s/\*\*'?" "$file" && \
     grep -q 'on:' "$file" && \
     grep -qE 'push:' "$file"; then
    if ! grep -q 'paths-ignore:' "$file" && [ "$HAS_OVERLAY_NEGATION" -eq 0 ]; then
      echo "  ⚠️  $filename: triggers on 'k8s/**' push with no 'paths-ignore' — overlay commits may cause infinite workflow loops"
      WARNINGS=$((WARNINGS + 1))
    fi
  fi

  # Warn if workflow commits to the repo but does not have paths-ignore or an actor guard
  # that would prevent the bot commit from re-triggering this workflow.
  if grep -q 'git push' "$file"; then
    HAS_PATHS_IGNORE=$(grep -c 'paths-ignore:' "$file" || true)
    HAS_ACTOR_GUARD=$(grep -cE "github\.actor\s*!=\s*'github-actions\[bot\]'" "$file" || true)
    if [ "$HAS_PATHS_IGNORE" -eq 0 ] && [ "$HAS_ACTOR_GUARD" -eq 0 ] && [ "$HAS_OVERLAY_NEGATION" -eq 0 ]; then
      echo "  ⚠️  $filename: commits and pushes without 'paths-ignore' or an actor guard — verify no self-trigger loop is possible"
      WARNINGS=$((WARNINGS + 1))
    fi
  fi
done

# ── 3. Summary ────────────────────────────────────────────────────────────────

echo ""
if [ "$ERRORS" -gt 0 ]; then
  echo "❌ Validation failed: $ERRORS error(s), $WARNINGS warning(s)."
  exit 1
elif [ "$WARNINGS" -gt 0 ]; then
  echo "✅ Validation passed with $WARNINGS warning(s) — review warnings before merging."
  exit 0
else
  echo "✅ All workflows validated successfully."
  exit 0
fi

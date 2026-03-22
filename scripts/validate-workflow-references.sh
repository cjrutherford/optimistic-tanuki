#!/bin/bash
# Validate that files explicitly referenced in GitHub Actions workflow definitions exist
# Checks local shell scripts, Docker Compose files, and other local file references
# Conservative approach: only checks explicit, unambiguous file references

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
WORKFLOWS_DIR="$PROJECT_DIR/.github/workflows"

echo "========================================="
echo "Workflow Reference Validation"
echo "========================================="
echo ""

ERRORS=0
WARNINGS=0

report_error() {
    echo "❌ ERROR: $1"
    ERRORS=$((ERRORS + 1))
}

report_warning() {
    echo "⚠️  WARNING: $1"
    WARNINGS=$((WARNINGS + 1))
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

WORKFLOW_FILES=()
for f in "$WORKFLOWS_DIR"/*.yml "$WORKFLOWS_DIR"/*.yaml; do
    [ -f "$f" ] && WORKFLOW_FILES+=("$f")
done

if [ ${#WORKFLOW_FILES[@]} -eq 0 ]; then
    report_error "No workflow files found in $WORKFLOWS_DIR"
    exit 1
fi

echo "Checking ${#WORKFLOW_FILES[@]} workflow file(s) for local file references..."
echo ""

# -----------------------------------------------------------------------
# Helper: check a referenced path exists
# -----------------------------------------------------------------------
check_file_reference() {
    local ref_file="$1"
    local workflow_name="$2"
    local context="$3"

    # Resolve relative to project root
    local full_path="$PROJECT_DIR/$ref_file"

    if [ -e "$full_path" ]; then
        report_success "$workflow_name: found $ref_file ($context)"
        return 0
    else
        report_error "$workflow_name: referenced file not found: $ref_file ($context)"
        return 1
    fi
}

# -----------------------------------------------------------------------
# Step 1: Check explicitly referenced local shell scripts
# -----------------------------------------------------------------------
echo "1. Checking referenced local shell scripts..."
echo ""

for wf in "${WORKFLOW_FILES[@]}"; do
    wf_name="$(basename "$wf")"

    # Match patterns like: ./scripts/foo.sh, scripts/foo.sh, bash scripts/foo.sh
    # Use grep to extract candidate script paths; be conservative about what counts
    while IFS= read -r line; do
        # Strip leading whitespace and common run: prefixes
        line="${line#"${line%%[![:space:]]*}"}"

        # Extract paths matching scripts/*.sh or ./scripts/*.sh
        if [[ "$line" =~ (\.?/?(scripts|tools)/[A-Za-z0-9_/.-]+\.sh) ]]; then
            ref="${BASH_REMATCH[1]}"
            # Normalize: remove leading ./
            ref="${ref#./}"
            check_file_reference "$ref" "$wf_name" "shell script" || true
        fi
    done < <(grep -E '\./?(scripts|tools)/[A-Za-z0-9_/.-]+\.sh' "$wf" 2>/dev/null || true)
done

echo ""

# -----------------------------------------------------------------------
# Step 2: Check referenced Docker Compose files
# -----------------------------------------------------------------------
echo "2. Checking referenced Docker Compose files..."
echo ""

for wf in "${WORKFLOW_FILES[@]}"; do
    wf_name="$(basename "$wf")"

    # Match explicit docker-compose file references: -f <file>, --file <file>
    # Also match plain docker-compose.*.yaml references
    while IFS= read -r match; do
        # Normalize: remove leading ./
        ref="${match#./}"
        # Skip template variables like ${{ matrix.service }}
        if [[ "$ref" == *'${'* ]]; then
            report_info "$wf_name: skipping dynamic compose file reference: $ref"
            continue
        fi
        check_file_reference "$ref" "$wf_name" "Docker Compose file" || true
    done < <(grep -oE '(-f|--file)[[:space:]]+[./]?[A-Za-z0-9_./-]+\.ya?ml' "$wf" 2>/dev/null \
        | grep -oE '[./]?[A-Za-z0-9_./-]+\.ya?ml' || true)
done

echo ""

# -----------------------------------------------------------------------
# Step 3: Check referenced package.json scripts are defined
# -----------------------------------------------------------------------
echo "3. Checking referenced npm/npx script names..."
echo ""

PKG_JSON="$PROJECT_DIR/package.json"
if [ ! -f "$PKG_JSON" ]; then
    report_warning "package.json not found; skipping npm script validation"
else
    # Extract defined script names from package.json
    DEFINED_SCRIPTS=$(node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
const scripts = Object.keys(pkg.scripts || {});
console.log(scripts.join('\n'));
" "$PKG_JSON" 2>/dev/null || true)

    for wf in "${WORKFLOW_FILES[@]}"; do
        wf_name="$(basename "$wf")"

        # Find npm run <script> or "npm run-script <script>" calls
        while IFS= read -r npm_script; do
            # Skip empty
            [ -z "$npm_script" ] && continue
            # Skip lines with template variables
            [[ "$npm_script" == *'${'* ]] && continue

            if echo "$DEFINED_SCRIPTS" | grep -qx "$npm_script"; then
                report_success "$wf_name: npm script '$npm_script' exists in package.json"
            else
                report_warning "$wf_name: npm script '$npm_script' not found in package.json (may be defined elsewhere or dynamic)"
            fi
        done < <(grep -oE 'npm run [A-Za-z0-9:._-]+' "$wf" 2>/dev/null \
            | sed 's/npm run //' || true)
    done
fi

echo ""

# -----------------------------------------------------------------------
# Step 4: Check that key local files workflows depend on exist
# -----------------------------------------------------------------------
echo "4. Checking key project files expected by workflows..."
echo ""

# These are well-known files that the repo's CI workflows depend on
EXPECTED_FILES=(
    "package.json"
    ".github/workflows"
)

for expected in "${EXPECTED_FILES[@]}"; do
    full="$PROJECT_DIR/$expected"
    if [ -e "$full" ]; then
        report_success "Required path exists: $expected"
    else
        report_error "Required path missing: $expected"
    fi
done

# Check for docker-compose.yaml (used by multiple workflows)
if [ -f "$PROJECT_DIR/docker-compose.yaml" ]; then
    report_success "docker-compose.yaml exists"
elif [ -f "$PROJECT_DIR/docker-compose.yml" ]; then
    report_success "docker-compose.yml exists"
else
    report_warning "No docker-compose.yaml found at project root (used by several workflows)"
fi

# Check docker-compose.k8s.yaml used by deploy.yml
if [ -f "$PROJECT_DIR/docker-compose.k8s.yaml" ]; then
    report_success "docker-compose.k8s.yaml exists"
else
    report_warning "docker-compose.k8s.yaml not found (referenced by deploy.yml)"
fi

echo ""

# -----------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------
echo "========================================="
if [ "$ERRORS" -eq 0 ] && [ "$WARNINGS" -eq 0 ]; then
    echo "✅ All reference checks passed!"
elif [ "$ERRORS" -eq 0 ]; then
    echo "⚠️  Reference checks passed with $WARNINGS warning(s)"
    echo "   (Warnings do not fail the build — review manually)"
else
    echo "❌ Reference validation failed with $ERRORS error(s) and $WARNINGS warning(s)"
fi
echo "========================================="

if [ "$ERRORS" -gt 0 ]; then
    exit 1
fi
exit 0

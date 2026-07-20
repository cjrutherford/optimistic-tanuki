#!/usr/bin/env bash
set -euo pipefail

echo "=== Slice checkpoint: incremental dev refresh ==="
pnpm run docker:dev
echo ""

echo "=== Slice checkpoint: full dev bootstrap ==="
pnpm run docker:dev:bootstrap
echo ""

echo "Slice checkpoint complete."

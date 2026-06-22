#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"

exec "$PROJECT_DIR/scripts/docker-compose-deploy.sh" "$@"

#!/usr/bin/env bash
set -euo pipefail

WATCH=0
PROJECTS=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --)
      ;;
    --watch)
      WATCH=1
      ;;
    --projects=*)
      PROJECTS="${1#*=}"
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
  shift
done

if [ -z "$PROJECTS" ]; then
  echo "Pass --projects=project-a,project-b" >&2
  exit 2
fi

ARGS=(run-many --target=build --projects="$PROJECTS" --configuration=development)

if [ "$WATCH" -eq 1 ]; then
  ARGS+=(--watch)
fi

NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm exec nx "${ARGS[@]}"

#!/bin/sh
# The database may be external to Compose, so container start order is not readiness.
# Keep command output private: database driver errors can contain connection details.
set -eu
if [ -z "${DIRECTORY_DATABASE_URL:-}" ]; then
  echo 'Directory migration: DIRECTORY_DATABASE_URL is required' >&2
  exit 1
fi
attempt=1
while [ "$attempt" -le 12 ]; do
  if timeout 60s pnpm exec nx run directory:typeorm:migration:run >/dev/null 2>&1; then
    echo 'Directory migration completed'
    exit 0
  fi
  echo "Directory migration attempt $attempt failed or timed out" >&2
  if [ "$attempt" -lt 12 ]; then sleep 5; fi
  attempt=$((attempt + 1))
done
echo 'Directory migration exhausted retries' >&2
exit 1

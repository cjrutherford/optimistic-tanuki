#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
config=.env.directory.local
if [[ ! -f "$config" ]]; then
  printf 'Missing .env.directory.local; configure the local Directory stack first.\n' >&2
  exit 1
fi
for container in db redis town-square-directory-db; do
  if ! docker inspect "$container" >/dev/null 2>&1; then
    printf 'Required local container %s is missing.\n' "$container" >&2
    exit 1
  fi
  if [[ "$(docker inspect --format '{{.State.Running}}' "$container")" != true ]]; then
    printf 'Required local container %s is stopped; start it before continuing.\n' "$container" >&2
    exit 1
  fi
done
exec docker compose -p optimistic-tanuki --profile directory --env-file "$config" up -d --no-deps --no-build social authentication permissions payments profile directory directory-worker gateway local-hub-client-interface owner-console

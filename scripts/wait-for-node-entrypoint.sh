#!/bin/sh

set -eu

if [ "$#" -lt 1 ]; then
  echo "usage: wait-for-node-entrypoint.sh <entrypoint> [node args...]" >&2
  exit 1
fi

ENTRYPOINT=$1
shift

while [ ! -f "$ENTRYPOINT" ]; do
  sleep 1
done

exec node "$@" "$ENTRYPOINT"

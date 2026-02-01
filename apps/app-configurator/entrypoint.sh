#!/bin/sh
set -e

if [ "$RUN_SEED" = "true" ]; then
  echo "Running seed script..."
  node seed-data/seed-script.js
fi

exec "$@"

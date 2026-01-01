#!/bin/bash
set -euo pipefail

echo "Starting e2e DB setup script"
apt-get update
apt-get install -y postgresql-client

# Install node deps for running migrations
npm ci --silent

# Run the repo's setup-and-migrate script
sh ./setup-and-migrate.sh

echo "e2e DB setup complete"

#!/bin/sh

# Seed script wrapper for docker-compose execution
# This script runs the TypeScript seed script after the service is built

echo "Starting app-configurator seed process..."

# Wait for the service to be fully ready
sleep 5

# Run the seed script
node seed-data/seed-script.js

echo "Seed process completed"

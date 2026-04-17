#!/bin/bash
# Fix Docker dist folder permissions
# This script fixes file ownership issues that prevent Docker builds

set -e

echo "Fixing dist folder permissions..."

# Find all dist folders and fix ownership
# This is needed when previous builds were run as root or different user

# Get current user info
CURRENT_USER=$(whoami)
CURRENT_UID=$(id -u)
CURRENT_GID=$(id -g)

echo "Current user: $CURRENT_USER (UID: $CURRENT_UID, GID: $CURRENT_GID)"

# Fix ownership of dist folders
if [ -d "dist" ]; then
    echo "Fixing dist folder ownership..."
    chown -R "$CURRENT_UID:$CURRENT_GID" dist/
    chmod -R u+rw dist/
fi

# Also fix any nested dist folders that might have wrong permissions
find . -type d -name "dist" -exec chown -R "$CURRENT_UID:$CURRENT_GID" {} \; 2>/dev/null || true
find . -type d -name "dist" -exec chmod -R u+rw {} \; 2>/dev/null || true

echo "Dist folder permissions fixed!"

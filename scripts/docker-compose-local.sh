#!/usr/bin/env bash
set -euo pipefail

# Bind-mounted outputs must be created with the caller's identity. Compose cannot
# discover it itself, so every supported local entry point comes through here.
export LOCAL_UID="${LOCAL_UID:-$(id -u)}"
export LOCAL_GID="${LOCAL_GID:-$(id -g)}"

exec docker compose "$@"

#!/usr/bin/env sh
set -eu

git rev-parse --git-dir >/dev/null 2>&1 || exit 0

git config core.hooksPath .husky/_

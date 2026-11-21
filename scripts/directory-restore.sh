#!/usr/bin/env bash
# Restore one database (and optionally the export artifacts) from a directory-backup.sh backup.
#   scripts/directory-restore.sh <backup-dir> --target-db NAME [--source-db NAME] [--exports-dir DIR] [--replace] [--live]
# Restoring into ot_directory / ot_directory_census_stage needs --live AND every directory container stopped.
# FENCE: docs/plans/town-square-directory/S3-restore-fencing.md requires serving and workers to be fenced externally
# before any restore. An independent restore cannot be detected from restored state; this script only checks that the
# directory containers are stopped, it does not rotate recovery epochs or complete the recovery workflow.
# Env: DIRECTORY_DB_CONTAINER (town-square-directory-db), DIRECTORY_DB_SUPERUSER (postgres).
set -euo pipefail
umask 077

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB="$HERE/directory-backup-lib.cjs"
CONTAINER="${DIRECTORY_DB_CONTAINER:-town-square-directory-db}"
PGSU="${DIRECTORY_DB_SUPERUSER:-postgres}"

die() { echo "directory-restore: $*" >&2; exit 1; }

[ $# -ge 1 ] || die "usage: directory-restore.sh <backup-dir> --target-db NAME [--source-db NAME] [--exports-dir DIR] [--replace] [--live]"
BACKUP="$1"; shift
TARGET=""; SOURCE=""; EXPORTS_DIR=""; REPLACE=0; LIVE=0
while [ $# -gt 0 ]; do
  case "$1" in
    --target-db) TARGET="${2:?}"; shift 2 ;;
    --source-db) SOURCE="${2:?}"; shift 2 ;;
    --exports-dir) EXPORTS_DIR="${2:?}"; shift 2 ;;
    --replace) REPLACE=1; shift ;;
    --live) LIVE=1; shift ;;
    *) die "unknown argument: $1" ;;
  esac
done
[ -n "$TARGET" ] || die "--target-db is required"
[ -d "$BACKUP" ] || die "backup directory not found"
[ -n "$SOURCE" ] || SOURCE="$TARGET"

echo "FENCE REQUIREMENT: before restoring into a live database, all directory serving and workers must be fenced"
echo "(see docs/plans/town-square-directory/S3-restore-fencing.md). Scratch targets are not fenced."

RUNNING="$(docker ps --format '{{.Names}}' | tr '\n' ',')"
GUARD=(node "$LIB" guard --target "$TARGET" --running "$RUNNING")
[ "$LIVE" = 1 ] && GUARD+=(--live)
[ "$REPLACE" = 1 ] && GUARD+=(--replace)
"${GUARD[@]}" || die "guard refused the restore"

echo "verifying backup checksums"
node "$LIB" check-backup "$BACKUP" >/dev/null || die "backup verification failed; nothing was restored"
DUMP="$BACKUP/$(node "$LIB" manifest-file "$BACKUP" --db "$SOURCE")"
[ -f "$DUMP" ] && [ "$DUMP" != "$BACKUP/" ] || die "source database $SOURCE is not in this backup"
TAR="$BACKUP/$(node "$LIB" manifest-file "$BACKUP" --db exports)"

psql_su() { docker exec -i "$CONTAINER" psql -U "$PGSU" -d postgres -v ON_ERROR_STOP=1 -qAt "$@"; }
EXISTS="$(psql_su -c "SELECT 1 FROM pg_database WHERE datname = '$TARGET'")"
if [ -n "$EXISTS" ]; then
  [ "$REPLACE" = 1 ] || die "target database already exists; pass --replace to drop and recreate it"
  psql_su -c "DROP DATABASE \"$TARGET\" WITH (FORCE)" >/dev/null
fi
START=$(date +%s)
psql_su -c "CREATE DATABASE \"$TARGET\"" >/dev/null
echo "restoring $SOURCE into $TARGET"
docker exec -i "$CONTAINER" pg_restore -U "$PGSU" -d "$TARGET" --exit-on-error <"$DUMP" || die "pg_restore failed"
echo "database restored in $(( $(date +%s) - START ))s"

if [ -n "$EXPORTS_DIR" ]; then
  mkdir -p "$EXPORTS_DIR"
  chmod 700 "$EXPORTS_DIR"
  tar -xf "$TAR" -C "$EXPORTS_DIR" --no-same-owner || die "export extraction failed"
  echo "export artifacts extracted"
fi
echo "restore complete; run directory-restore-verify.cjs before trusting it"

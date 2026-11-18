#!/usr/bin/env bash
# Backup the Town Square Directory databases and export artifact volume.
# Read-only against the live stack. Usage:
#   scripts/directory-backup.sh [--out DIR] [--databases a,b]
# Env: DIRECTORY_DB_CONTAINER (town-square-directory-db), DIRECTORY_DB_SUPERUSER (postgres),
#      DIRECTORY_EXPORT_VOLUME (optimistic-tanuki_directory_exports), DIRECTORY_TAR_IMAGE (postgres:16-alpine).
# Credentials are never read: psql/pg_dump run inside the container over its local socket.
set -euo pipefail
umask 077

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTAINER="${DIRECTORY_DB_CONTAINER:-town-square-directory-db}"
PGSU="${DIRECTORY_DB_SUPERUSER:-postgres}"
VOLUME="${DIRECTORY_EXPORT_VOLUME:-optimistic-tanuki_directory_exports}"
TAR_IMAGE="${DIRECTORY_TAR_IMAGE:-postgres:16-alpine}"
DATABASES="ot_directory,ot_directory_census_stage"
OUT=""

die() { echo "directory-backup: $*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --out) OUT="${2:?--out needs a value}"; shift 2 ;;
    --databases) DATABASES="${2:?--databases needs a value}"; shift 2 ;;
    -h|--help) sed -n 2,7p "$0"; exit 0 ;;
    *) die "unknown argument: $1" ;;
  esac
done

[ -n "$OUT" ] || OUT="$HOME/.cache/optimistic-tanuki/directory-backups/$(date -u +%Y%m%dT%H%M%SZ)"
REPO="$(cd "$HERE/.." && pwd)"
case "$(readlink -m "$OUT")/" in "$REPO/"*) die "backup directory must not be inside the repository" ;; esac
mkdir -p "$(dirname "$OUT")"
mkdir "$OUT" || die "output directory already exists"
chmod 700 "$OUT"

docker inspect "$CONTAINER" >/dev/null 2>&1 || die "database container not found"
docker volume inspect "$VOLUME" >/dev/null 2>&1 || die "export volume not found"
docker image inspect "$TAR_IMAGE" >/dev/null 2>&1 || die "tar image $TAR_IMAGE not present locally"

# Counts of every directory_* table plus the migration head and provider budget totals,
# all read through the exported snapshot so they agree with the dump.
read -r -d '' INFO_SQL <<'SQL' || true
SELECT json_build_object(
  'latestMigration', (SELECT name FROM migrations ORDER BY id DESC LIMIT 1),
  'rowCounts', (SELECT json_object_agg(table_name, cnt) FROM (
      SELECT table_name::text,
             (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I.%I', table_schema, table_name), false, true, '')))[1]::text::bigint AS cnt
        FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
         AND (table_name LIKE 'directory\_%' OR table_name = 'migrations')) t),
  'providerBudget', CASE WHEN to_regclass('public.directory_provider_budget_attempt') IS NULL THEN NULL ELSE
      (SELECT json_build_object('attempts', c, 'reservedCents', s) FROM (
         SELECT (xpath('/row/c/text()', x))[1]::text::bigint AS c, (xpath('/row/s/text()', x))[1]::text::bigint AS s
           FROM (SELECT query_to_xml('SELECT count(*) AS c, coalesce(sum("reservedCents"),0) AS s FROM directory_provider_budget_attempt', false, true, '') AS x) y) z) END
);
SQL

START=$(date +%s)
IFS=',' read -r -a DBS <<<"$DATABASES"
for DB in "${DBS[@]}"; do
  [[ "$DB" =~ ^[a-z][a-z0-9_]{0,62}$ ]] || die "unsafe database name"
  echo "dumping $DB"
  # Hold a REPEATABLE READ transaction open and export its snapshot for pg_dump and the counts.
  coproc HOLD { docker exec -i "$CONTAINER" psql -U "$PGSU" -d "$DB" -v ON_ERROR_STOP=1 -qAt; }
  printf 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;\nSELECT pg_export_snapshot();\n' >&"${HOLD[1]}"
  IFS= read -r -t 30 SNAP <&"${HOLD[0]}" || die "could not export snapshot for $DB"
  [[ "$SNAP" =~ ^[0-9A-F-]+$ ]] || die "unexpected snapshot id for $DB"
  docker exec "$CONTAINER" pg_dump -U "$PGSU" -d "$DB" -Fc --snapshot="$SNAP" >"$OUT/$DB.dump" || die "pg_dump failed for $DB"
  {
    echo "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;"
    echo "SET TRANSACTION SNAPSHOT '$SNAP';"
    echo "$INFO_SQL"
    echo "COMMIT;"
  } | docker exec -i "$CONTAINER" psql -U "$PGSU" -d "$DB" -v ON_ERROR_STOP=1 -qAt >"$OUT/$DB.info.json" || die "count query failed for $DB"
  printf 'COMMIT;\n\\q\n' >&"${HOLD[1]}" || true
  wait "$HOLD_PID" 2>/dev/null || true
  [ -s "$OUT/$DB.dump" ] || die "empty dump for $DB"
done

echo "archiving export volume"
docker run --rm -v "$VOLUME":/src:ro --entrypoint tar "$TAR_IMAGE" -C /src -cf - . >"$OUT/exports.tar" || die "export archive failed"
FILECOUNT=$(tar -tf "$OUT/exports.tar" | grep -vc '/$' || true)
printf '{"fileCount":%s,"volume":"%s"}\n' "$FILECOUNT" "$VOLUME" >"$OUT/exports.info.json"

node "$HERE/directory-backup-lib.cjs" assemble "$OUT" >/dev/null || die "manifest assembly failed"
rm -f "$OUT"/*.info.json
chmod 600 "$OUT"/*
chmod 700 "$OUT"
echo "backup complete in $(( $(date +%s) - START ))s: $OUT"

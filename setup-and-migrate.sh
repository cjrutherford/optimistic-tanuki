#!/bin/sh
set -eu

# Set environment variables
export POSTGRES_USER=postgres
export POSTGRES_PASSWORD=postgres
export POSTGRES_HOST=${POSTGRES_HOST:-127.0.0.1}
export POSTGRES_PORT=5432
export NODE_ENV=development
export ADDITIONAL_DBS=${ADDITIONAL_DBS:-ot_authentication,ot_profile,ot_social,ot_assets,ot_project_planning,ot_chat_collector,ot_telos_docs_service,ot_blogging,ot_permissions,ot_store,ot_app_configurator,ot_forum,ot_finance,ot_videos,ot_wellness,ot_classifieds,classifieds_db,ot_payments,ot_lead_tracker,ot_system_configurator}

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

resolve_app_name() {
    db_name="$1"
    case "$db_name" in
      ot_system_configurator)
        echo "system-configurator-api"
        ;;
      classifieds_db)
        echo "classifieds"
        ;;
      *)
        echo "$db_name" | sed 's/^ot_//' | tr '_' '-'
        ;;
    esac
}

if [ ! -d "$ROOT_DIR/node_modules" ]; then
  echo "Installing dependencies for migration runtime (ts-node/typeorm)..."
  (cd "$ROOT_DIR" && corepack enable && pnpm install --frozen-lockfile)
fi

# Run database creation script
(cd "$ROOT_DIR" && sh ./create-dbs.sh)

# Run TypeORM migrations for each service
# Loop through ADDITIONAL_DBS, map DB name to app directory, and run migrations.
OLD_IFS="$IFS"
IFS=','
set -- $ADDITIONAL_DBS
IFS="$OLD_IFS"
for db_with_prefix in "$@"; do
  app_name="$(resolve_app_name "$db_with_prefix")"
  app_dir="$ROOT_DIR/apps/$app_name"

  if [ ! -d "$app_dir" ]; then
    echo "ERROR: App directory does not exist for database '$db_with_prefix': $app_dir"
    exit 1
  fi

  if [ ! -f "$app_dir/tsconfig.app.json" ]; then
    echo "ERROR: Missing tsconfig.app.json for app '$app_name' at $app_dir"
    exit 1
  fi

  if [ ! -f "$app_dir/src/app/staticDatabase.ts" ]; then
    echo "ERROR: Missing staticDatabase.ts for app '$app_name' at $app_dir/src/app/staticDatabase.ts"
    exit 1
  fi

  export POSTGRES_DB="$db_with_prefix"
  echo "Running migrations for $app_name (Database: $POSTGRES_DB)"

  (
    cd "$app_dir"
    export TS_NODE_PROJECT=./tsconfig.app.json
    node -r ts-node/register -r tsconfig-paths/register "$ROOT_DIR/node_modules/typeorm/cli.js" -d ./src/app/staticDatabase.ts migration:run
  )
done

echo "Database setup and migrations complete."

# Seed permissions (app scopes, roles, and permissions) after migrations
# this is handled in typescript as a post install script. do not use this.
# specifically keeping so the LLM does not use it.
# echo "Seeding permissions into ot_permissions database."
# sh ./seed-permissions.sh
# echo "Permissions seeding complete."

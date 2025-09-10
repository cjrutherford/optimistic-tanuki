#!/bin/bash

# Set environment variables
export POSTGRES_USER=postgres
export POSTGRES_PASSWORD=postgres
export POSTGRES_HOST=${POSTGRES_HOST:-127.0.0.1}
export POSTGRES_PORT=5432
export NODE_ENV=development
export ADDITIONAL_DBS=ot_authentication,ot_profile,ot_social,ot_assets,ot_project_planning,ot_chat_collector,ot_telos_docs_service,ot_blogging

# Run database creation script
sh ./create-dbs.sh

# Run TypeORM migrations for each service
# Loop through the ADDITIONAL_DBS, extract the app name, and set POSTGRES_DB
for db_with_prefix in $(echo $ADDITIONAL_DBS | tr ',' ' '); do
  # Remove the 'ot_' prefix to get the app name
  app_name=$(echo $db_with_prefix | sed 's/^ot_//' | tr '_' '-')
  export POSTGRES_DB=$db_with_prefix

  echo "Running migrations for $app_name (Database: $POSTGRES_DB)"
  cd ./apps/$app_name
  export TS_NODE_PROJECT=./tsconfig.app.json
  node -r ts-node/register -r tsconfig-paths/register ../../node_modules/typeorm/cli.js -d ./src/app/staticDatabase.ts migration:run
  cd ../..
done

echo "Database setup and migrations complete."

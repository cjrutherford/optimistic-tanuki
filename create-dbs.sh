#!/bin/bash
set -euo pipefail

database_exists() {
    local db_name="$1"
    psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d postgres -tAc \
        "SELECT 1 FROM pg_database WHERE datname='${db_name}'" | grep -q 1
}

echo "Additional databases: $ADDITIONAL_DBS"
echo "Waiting for postgres to be ready..."
echo "postgres user: $POSTGRES_USER"
echo "postgres password: $POSTGRES_PASSWORD"
if command -v pg_isready >/dev/null 2>&1; then
    until pg_isready \
        -h "$POSTGRES_HOST" \
        -U "$POSTGRES_USER"; do
            sleep 1
        done
else
    echo "pg_isready not found, falling back to psql connectivity check..."
    export PGPASSWORD="$POSTGRES_PASSWORD"
    until psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d postgres -c '\\q' >/dev/null 2>&1; do
        sleep 1
    done
fi

echo "Postgres is ready"
echo "Creating additional databases"
export PGPASSWORD="$POSTGRES_PASSWORD"
for db in $(echo "$ADDITIONAL_DBS" | tr ',' ' '); do
    if database_exists "$db"; then
        echo "Database $db already exists"
        continue
    fi

    echo "Creating database $db"
    psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE $db;"
    echo "Database $db created"
done
echo "All databases created"

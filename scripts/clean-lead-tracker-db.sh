#!/bin/bash
set -e

# Lead Tracker Database Cleanup Script
# This script truncates all tables in the lead_tracker database

DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-ot_lead_tracker}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-postgres}"

echo "Cleaning lead tracker database: $DB_NAME"

# Export PGPASSWORD for psql
export PGPASSWORD="$DB_PASSWORD"

# Check if database exists
if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -t -c "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1; then
    echo "Database $DB_NAME exists. Proceeding with cleanup..."
else
    echo "Database $DB_NAME does not exist. Creating it..."
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "CREATE DATABASE $DB_NAME"
    echo "Database created. No data to clean."
    exit 0
fi

# Truncate all tables (disable foreign keys, truncate, re-enable)
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" <<-EOSQL
    -- Disable foreign key checks
    SET FOREIGN_KEY_CHECKS = 0;

    -- Truncate all tables
    TRUNCATE TABLE lead_topic_links RESTART IDENTITY CASCADE;
    TRUNCATE TABLE lead_flags RESTART IDENTITY CASCADE;
    TRUNCATE TABLE lead_topics RESTART IDENTITY CASCADE;
    TRUNCATE TABLE leads RESTART IDENTITY CASCADE;

    -- Re-enable foreign key checks
    SET FOREIGN_KEY_CHECKS = 1;

    -- Show results
    SELECT 'lead_topic_links' as table_name, count(*) as row_count FROM lead_topic_links
    UNION ALL
    SELECT 'lead_flags', count(*) FROM lead_flags
    UNION ALL
    SELECT 'lead_topics', count(*) FROM lead_topics
    UNION ALL
    SELECT 'leads', count(*) FROM leads;
EOSQL

echo "Lead tracker database cleaned successfully!"

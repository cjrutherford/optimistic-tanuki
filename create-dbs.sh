#!/bin/bash
echo "Additional databases: $ADDITIONAL_DBS"
echo "Waiting for postgres to be ready..."
echo "postgres user: $POSTGRES_USER"
echo "postgres password: $POSTGRES_PASSWORD"
until pg_isready \
    -h $POSTGRES_HOST \
    -U $POSTGRES_USER; do 
        sleep 1; 
    done; 
    echo "Postgres is ready"
    echo "Creating additional databases"
    export PGPASSWORD=$POSTGRES_PASSWORD
    for db in $(echo $ADDITIONAL_DBS | tr ',' ' '); do 
        echo "Creating database $db";
        psql -h $POSTGRES_HOST -U $POSTGRES_USER -c "CREATE DATABASE $db;"; 
        echo "Database $db created";
    done
echo "All databases created"
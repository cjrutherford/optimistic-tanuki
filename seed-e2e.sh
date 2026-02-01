#!/bin/bash
set -e

# Seeding script for E2E tests
# Ensures the test user exists and has necessary permissions

export POSTGRES_HOST=${POSTGRES_HOST:-db}
export POSTGRES_USER=${POSTGRES_USER:-postgres}
export POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-postgres}
export PGPASSWORD=$POSTGRES_PASSWORD

echo "Seeding E2E test data..."

# 1. Create test user in authentication database
echo "Creating test user in ot_authentication..."
psql -h $POSTGRES_HOST -U $POSTGRES_USER -d ot_authentication <<EOF
INSERT INTO "user" (id, email, password, "firstName", "lastName", "isActive")
VALUES ('00000000-0000-0000-0000-000000000001', 'test@example.com', 'password123', 'Test', 'User', true)
ON CONFLICT (email) DO NOTHING;
EOF

# 2. Create profile for the test user
echo "Creating profile in ot_profile..."
psql -h $POSTGRES_HOST -U $POSTGRES_USER -d ot_profile <<EOF
INSERT INTO "profile" (id, "userId", "displayName", "bio")
VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Test User', 'E2E Test Profile')
ON CONFLICT (id) DO NOTHING;
EOF

# 3. Assign permissions/roles
echo "Assigning roles in ot_permissions..."
psql -h $POSTGRES_HOST -U $POSTGRES_USER -d ot_permissions <<EOF
-- Ensure 'owner' role exists
INSERT INTO "role" (id, name, description)
VALUES ('00000000-0000-0000-0000-000000000003', 'owner', 'Owner with all permissions')
ON CONFLICT (name) DO NOTHING;

-- Assign role to user
INSERT INTO "user_role" ("profileId", "roleId")
VALUES ('00000000-0000-0000-0000-000000000002', (SELECT id FROM "role" WHERE name = 'owner'))
ON CONFLICT ("profileId", "roleId") DO NOTHING;
EOF

echo "E2E seeding complete."

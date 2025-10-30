#!/bin/bash
set -euo pipefail

# Usage: scripts/seed-app-scopes.sh
# Expects POSTGRES_HOST, POSTGRES_PORT, POSTGRES_USER, POSTGRES_PASSWORD to be set in the environment.
# Will connect to the ot_permissions database by default.

POSTGRES_HOST=${POSTGRES_HOST:-127.0.0.1}
POSTGRES_PORT=${POSTGRES_PORT:-5432}
POSTGRES_USER=${POSTGRES_USER:-postgres}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-postgres}
POSTGRES_DB=${POSTGRES_DB:-ot_permissions}

if ! command -v psql >/dev/null 2>&1; then
  echo "psql not found in PATH. Please install the Postgres client." >&2
  exit 1
fi

export PGPASSWORD="$POSTGRES_PASSWORD"

echo "Seeding app scopes into database: $POSTGRES_DB on $POSTGRES_HOST:$POSTGRES_PORT"

psql -v ON_ERROR_STOP=1 -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<'SQL'
INSERT INTO "app_scope" ("name", "description", "active") VALUES
('global', 'Global scope - applies across all applications', true),
('forgeofwill', 'Forge of Will application', true),
('client-interface', 'Main client interface', true),
('digital-homestead', 'Digital Homestead application', true),
('christopherrutherford-net', 'Personal website', true),
('blogging', 'Blogging platform', true),
('project-planning', 'Project planning application', true),
('assets', 'Assets service', true),
('social', 'Social features', true),
('authentication', 'Authentication service', true),
('profile', 'Profile service', true);
SQL

psql -v ON_ERROR_STOP=1 -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<'SQL'
BEGIN;

INSERT INTO "role" (name, description, "appScopeId")
VALUES
  ('digital_homesteader', 'Manage own profile and blog posts from Digital Homestead', (SELECT id FROM app_scope WHERE name = 'digital-homestead')),
  ('digital_follower', 'Follower: read profiles and social content for Digital Homestead', (SELECT id FROM app_scope WHERE name = 'digital-homestead'))
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "role" (name, description, "appScopeId")
VALUES
  ('client_profile_owner', 'Owner of profile data via client-interface', (SELECT id FROM app_scope WHERE name = 'client-interface')),
  ('client_follower', 'Follower role for client-interface (view/subscribe)', (SELECT id FROM app_scope WHERE name = 'client-interface')),
  ('client_asset_manager', 'Manage own assets via client-interface', (SELECT id FROM app_scope WHERE name = 'client-interface'))
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "role" (name, description, "appScopeId")
VALUES
  ('forgeofwill_planner', 'Project planner role for Forge of Will (project-planning)', (SELECT id FROM app_scope WHERE name = 'forgeofwill')),
  ('forgeofwill_profile_owner', 'Profile owner role for Forge of Will (profile integration)', (SELECT id FROM app_scope WHERE name = 'forgeofwill'))
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "role" (name, description, "appScopeId")
VALUES
  ('blog_author', 'Author role for blogging', (SELECT id FROM app_scope WHERE name = 'blogging')),
  ('blog_reader', 'Reader role for blogging', (SELECT id FROM app_scope WHERE name = 'blogging'))
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "role" (name, description, "appScopeId")
VALUES
  ('asset_owner', 'Owner of assets', (SELECT id FROM app_scope WHERE name = 'assets'))
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "role" (name, description, "appScopeId")
VALUES
  ('social_user', 'Social user (follow/post)', (SELECT id FROM app_scope WHERE name = 'social'))
ON CONFLICT ("name") DO NOTHING;

COMMIT;
SQL

psql -v ON_ERROR_STOP=1 -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<'SQL'
BEGIN;

-- Ensure a unique index for permission name + appScopeId so same permission name can exist per app scope
CREATE UNIQUE INDEX IF NOT EXISTS permission_name_appscope_idx ON "permission" (name, "appScopeId");

-- Profile permissions (insert once per relevant app scope)
INSERT INTO "permission" (name, description, resource, action, "targetId", "appScopeId")
VALUES
  ('profile.read', 'Read profile', 'profile', 'read', NULL, (SELECT id FROM app_scope WHERE name='client-interface')),
  ('profile.update', 'Update profile', 'profile', 'update', NULL, (SELECT id FROM app_scope WHERE name='client-interface'))
ON CONFLICT (name, "appScopeId") DO NOTHING;

-- Also add profile-scoped permission entries (same names) for the profile service app scope
INSERT INTO "permission" (name, description, resource, action, "targetId", "appScopeId")
VALUES
  ('profile.read', 'Read profile (profile service)', 'profile', 'read', NULL, (SELECT id FROM app_scope WHERE name='profile')),
  ('profile.update', 'Update profile (profile service)', 'profile', 'update', NULL, (SELECT id FROM app_scope WHERE name='profile'))
ON CONFLICT (name, "appScopeId") DO NOTHING;

-- Asset permissions
INSERT INTO "permission" (name, description, resource, action, "targetId", "appScopeId")
VALUES
  ('asset.create', 'Create asset', 'asset', 'create', NULL, (SELECT id FROM app_scope WHERE name='client-interface')),
  ('asset.read',   'Read asset',   'asset', 'read',   NULL, (SELECT id FROM app_scope WHERE name='client-interface')),
  ('asset.update', 'Update asset', 'asset', 'update', NULL, (SELECT id FROM app_scope WHERE name='client-interface')),
  ('asset.delete', 'Delete asset', 'asset', 'delete', NULL, (SELECT id FROM app_scope WHERE name='client-interface'))
ON CONFLICT (name, "appScopeId") DO NOTHING;

-- Blogging permissions
INSERT INTO "permission" (name, description, resource, action, "targetId", "appScopeId")
VALUES
  ('blog.post.create', 'Create blog post', 'post', 'create', NULL, (SELECT id FROM app_scope WHERE name='blogging')),
  ('blog.post.read',   'Read blog post',   'post', 'read',   NULL, (SELECT id FROM app_scope WHERE name='blogging')),
  ('blog.post.update', 'Update blog post', 'post', 'update', NULL, (SELECT id FROM app_scope WHERE name='blogging')),
  ('blog.post.delete', 'Delete blog post', 'post', 'delete', NULL, (SELECT id FROM app_scope WHERE name='blogging'))
ON CONFLICT (name, "appScopeId") DO NOTHING;

-- Project / planning permissions (forgeofwill / project-planning)
INSERT INTO "permission" (name, description, resource, action, "targetId", "appScopeId")
VALUES
  ('project.create', 'Create project', 'project', 'create', NULL, (SELECT id FROM app_scope WHERE name='project-planning')),
  ('project.read',   'Read project',   'project', 'read',   NULL, (SELECT id FROM app_scope WHERE name='project-planning')),
  ('project.update', 'Update project', 'project', 'update', NULL, (SELECT id FROM app_scope WHERE name='project-planning')),
  ('task.create',    'Create task',    'task', 'create', NULL, (SELECT id FROM app_scope WHERE name='project-planning')),
  ('task.read',      'Read task',      'task', 'read',   NULL, (SELECT id FROM app_scope WHERE name='project-planning')),
  ('task.update',    'Update task',    'task', 'update', NULL, (SELECT id FROM app_scope WHERE name='project-planning'))
ON CONFLICT (name, "appScopeId") DO NOTHING;

-- Social permissions
INSERT INTO "permission" (name, description, resource, action, "targetId", "appScopeId")
VALUES
  ('social.follow', 'Follow/unfollow users', 'follow', 'create', NULL, (SELECT id FROM app_scope WHERE name='social')),
  ('social.post.create', 'Create social post', 'post', 'create', NULL, (SELECT id FROM app_scope WHERE name='social')),
  ('social.post.read',   'Read social post',   'post', 'read',   NULL, (SELECT id FROM app_scope WHERE name='social'))
ON CONFLICT (name, "appScopeId") DO NOTHING;

-- Map permissions to roles (role_permission)
-- Note: when mapping, choose the permission row that matches the role's app scope.
-- digital_homesteader (digital-homestead scope) should map to blogging permissions (blogging scope)
INSERT INTO "role_permission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM role r JOIN permission p ON p.name = 'profile.read' AND p."appScopeId" = (SELECT id FROM app_scope WHERE name='digital-homestead')
WHERE r.name = 'digital_homesteader'
ON CONFLICT DO NOTHING;

-- digital_homesteader blog mapping
INSERT INTO "role_permission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM role r JOIN permission p ON p.name IN ('blog.post.create', 'blog.post.read', 'blog.post.update', 'blog.post.delete') AND p."appScopeId" = (SELECT id FROM app_scope WHERE name='blogging')
WHERE r.name = 'digital_homesteader'
ON CONFLICT DO NOTHING;

-- digital_follower
INSERT INTO "role_permission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM role r JOIN permission p ON p.name IN ('profile.read','blog.post.read','social.post.read') AND (
    (p.name = 'profile.read' AND p."appScopeId" = (SELECT id FROM app_scope WHERE name='digital-homestead'))
    OR (p.name <> 'profile.read')
)
WHERE r.name = 'digital_follower'
ON CONFLICT DO NOTHING;

-- client_profile_owner (use client-interface profile permissions)
INSERT INTO "role_permission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM role r JOIN permission p ON p.name IN ('profile.read', 'profile.update') AND p."appScopeId" = (SELECT id FROM app_scope WHERE name='client-interface')
WHERE r.name = 'client_profile_owner'
ON CONFLICT DO NOTHING;

-- client_follower
INSERT INTO "role_permission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM role r JOIN permission p ON p.name = 'profile.read' AND p."appScopeId" = (SELECT id FROM app_scope WHERE name='client-interface')
WHERE r.name = 'client_follower'
ON CONFLICT DO NOTHING;

-- client_asset_manager
INSERT INTO "role_permission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM role r JOIN permission p ON p.name IN ('asset.create', 'asset.read', 'asset.update', 'asset.delete') AND p."appScopeId" = (SELECT id FROM app_scope WHERE name='client-interface')
WHERE r.name = 'client_asset_manager'
ON CONFLICT DO NOTHING;

-- forgeofwill_planner (project-planning permissions)
INSERT INTO "role_permission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM role r JOIN permission p ON p.name IN ('project.create', 'project.read', 'project.update', 'task.create', 'task.read', 'task.update') AND p."appScopeId" = (SELECT id FROM app_scope WHERE name='project-planning')
WHERE r.name = 'forgeofwill_planner'
ON CONFLICT DO NOTHING;

-- forgeofwill_profile_owner (use profile permission rows tied to forgeofwill scope if present,
-- otherwise fall back to profile service/profile name rows - map to profile.read/profile.update with profile appScope)
INSERT INTO "role_permission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM role r JOIN permission p ON p.name IN ('profile.read', 'profile.update') AND p."appScopeId" = (
    SELECT COALESCE(
      (SELECT id FROM app_scope WHERE name = 'forgeofwill'),
      (SELECT id FROM app_scope WHERE name = 'profile')
    )
)
WHERE r.name = 'forgeofwill_profile_owner'
ON CONFLICT DO NOTHING;

-- blogging roles
INSERT INTO "role_permission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM role r JOIN permission p ON p.name IN ('blog.post.create', 'blog.post.read', 'blog.post.update', 'blog.post.delete') AND p."appScopeId" = (SELECT id FROM app_scope WHERE name='blogging')
WHERE r.name = 'blog_author'
ON CONFLICT DO NOTHING;

INSERT INTO "role_permission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM role r JOIN permission p ON p.name = 'blog.post.read' AND p."appScopeId" = (SELECT id FROM app_scope WHERE name='blogging')
WHERE r.name = 'blog_reader'
ON CONFLICT DO NOTHING;

-- assets role
INSERT INTO "role_permission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM role r JOIN permission p ON p.name IN ('asset.create', 'asset.read', 'asset.update', 'asset.delete') AND p."appScopeId" = (SELECT id FROM app_scope WHERE name='assets')
WHERE r.name = 'asset_owner'
ON CONFLICT DO NOTHING;

-- social role
INSERT INTO "role_permission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM role r JOIN permission p ON p.name IN ('social.follow', 'social.post.create', 'social.post.read') AND p."appScopeId" = (SELECT id FROM app_scope WHERE name='social')
WHERE r.name = 'social_user'
ON CONFLICT DO NOTHING;

COMMIT;
SQL

echo "App scopes seeded."
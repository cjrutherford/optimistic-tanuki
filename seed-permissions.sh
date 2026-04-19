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
('profile', 'Profile service', true),
('local-hub', 'Local Hub - classifieds, communities, and city pages', true),
('video-client', 'Video platform and channel communities', true);
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

-- Local Hub roles
INSERT INTO "role" (name, description, "appScopeId")
VALUES
  ('local_hub_member', 'Local Hub community member with classifieds access', (SELECT id FROM app_scope WHERE name = 'local-hub')),
  ('local_hub_community_poster', 'Community-scoped poster for local-hub communities', (SELECT id FROM app_scope WHERE name = 'local-hub'))
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "role" (name, description, "appScopeId")
VALUES
  ('video_client_member', 'Standard member for the video platform community experience', (SELECT id FROM app_scope WHERE name = 'video-client')),
  ('video_channel_creator', 'Creator role for managing a video channel, schedule, and live feed', (SELECT id FROM app_scope WHERE name = 'video-client'))
ON CONFLICT ("name") DO NOTHING;

-- Global scope roles
INSERT INTO "role" (name, description, "appScopeId")
VALUES
  ('owner_console_owner', 'Owner console administrator with full permissions', (SELECT id FROM app_scope WHERE name = 'global')),
  ('global_admin', 'Global administrator with elevated permissions', (SELECT id FROM app_scope WHERE name = 'global')),
  ('system_admin', 'System administrator with full system access', (SELECT id FROM app_scope WHERE name = 'global')),
  ('standard_user', 'Standard user with basic permissions', (SELECT id FROM app_scope WHERE name = 'global'))
ON CONFLICT ("name") DO NOTHING;

-- Standard user roles for each app scope
INSERT INTO "role" (name, description, "appScopeId")
VALUES
  ('forgeofwill_standard_user', 'Standard user for Forge of Will', (SELECT id FROM app_scope WHERE name = 'forgeofwill')),
  ('client_interface_user', 'Standard user for client interface', (SELECT id FROM app_scope WHERE name = 'client-interface')),
  ('digital_standard_user', 'Standard user for Digital Homestead', (SELECT id FROM app_scope WHERE name = 'digital-homestead')),
  ('christopherrutherford_standard_user', 'Standard user for Christopher Rutherford site', (SELECT id FROM app_scope WHERE name = 'christopherrutherford-net')),
  ('christopherrutherford_owner_user', 'Owner user for Christopher Rutherford site', (SELECT id FROM app_scope WHERE name = 'christopherrutherford-net')),
  ('local_hub_standard_user', 'Standard user for Local Hub', (SELECT id FROM app_scope WHERE name = 'local-hub'))
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

-- Reaction permissions for client-interface scope (mapped from social)
INSERT INTO "permission" (name, description, resource, action, "targetId", "appScopeId")
VALUES
  ('social.reaction.create', 'Create reaction', 'reaction', 'create', NULL, (SELECT id FROM app_scope WHERE name='client-interface')),
  ('social.reaction.read',   'Read reaction',   'reaction', 'read',   NULL, (SELECT id FROM app_scope WHERE name='client-interface'))
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

-- Reaction permissions for social scope
INSERT INTO "permission" (name, description, resource, action, "targetId", "appScopeId")
VALUES
  ('social.reaction.create', 'Create reaction', 'reaction', 'create', NULL, (SELECT id FROM app_scope WHERE name='social')),
  ('social.reaction.read',   'Read reaction',   'reaction', 'read',   NULL, (SELECT id FROM app_scope WHERE name='social'))
ON CONFLICT (name, "appScopeId") DO NOTHING;

-- Global scope permissions for owner-console registered users
INSERT INTO "permission" (name, description, resource, action, "targetId", "appScopeId")
VALUES
  ('profile.read', 'Read profile (global)', 'profile', 'read', NULL, (SELECT id FROM app_scope WHERE name='global')),
  ('profile.update', 'Update profile (global)', 'profile', 'update', NULL, (SELECT id FROM app_scope WHERE name='global')),
  ('profile.delete', 'Delete profile (global)', 'profile', 'delete', NULL, (SELECT id FROM app_scope WHERE name='global')),
  ('asset.create', 'Create asset (global)', 'asset', 'create', NULL, (SELECT id FROM app_scope WHERE name='global')),
  ('asset.read', 'Read asset (global)', 'asset', 'read', NULL, (SELECT id FROM app_scope WHERE name='global')),
  ('asset.update', 'Update asset (global)', 'asset', 'update', NULL, (SELECT id FROM app_scope WHERE name='global')),
  ('asset.delete', 'Delete asset (global)', 'asset', 'delete', NULL, (SELECT id FROM app_scope WHERE name='global')),
  ('social.follow', 'Follow/unfollow users (global)', 'follow', 'create', NULL, (SELECT id FROM app_scope WHERE name='global')),
  ('social.post.create', 'Create social post (global)', 'post', 'create', NULL, (SELECT id FROM app_scope WHERE name='global')),
  ('social.post.read', 'Read social post (global)', 'post', 'read', NULL, (SELECT id FROM app_scope WHERE name='global')),
  ('social.post.update', 'Update social post (global)', 'post', 'update', NULL, (SELECT id FROM app_scope WHERE name='global')),
  ('social.post.delete', 'Delete social post (global)', 'post', 'delete', NULL, (SELECT id FROM app_scope WHERE name='global')),
  ('blog.post.create', 'Create blog post (global)', 'post', 'create', NULL, (SELECT id FROM app_scope WHERE name='global')),
  ('blog.post.read', 'Read blog post (global)', 'post', 'read', NULL, (SELECT id FROM app_scope WHERE name='global')),
  ('blog.post.update', 'Update blog post (global)', 'post', 'update', NULL, (SELECT id FROM app_scope WHERE name='global')),
  ('blog.post.delete', 'Delete blog post (global)', 'post', 'delete', NULL, (SELECT id FROM app_scope WHERE name='global')),
  ('project.create', 'Create project (global)', 'project', 'create', NULL, (SELECT id FROM app_scope WHERE name='global')),
  ('project.read', 'Read project (global)', 'project', 'read', NULL, (SELECT id FROM app_scope WHERE name='global')),
  ('project.update', 'Update project (global)', 'project', 'update', NULL, (SELECT id FROM app_scope WHERE name='global')),
  ('project.delete', 'Delete project (global)', 'project', 'delete', NULL, (SELECT id FROM app_scope WHERE name='global')),
  ('task.create', 'Create task (global)', 'task', 'create', NULL, (SELECT id FROM app_scope WHERE name='global')),
  ('task.read', 'Read task (global)', 'task', 'read', NULL, (SELECT id FROM app_scope WHERE name='global')),
  ('task.update', 'Update task (global)', 'task', 'update', NULL, (SELECT id FROM app_scope WHERE name='global')),
  ('task.delete', 'Delete task (global)', 'task', 'delete', NULL, (SELECT id FROM app_scope WHERE name='global'))
ON CONFLICT (name, "appScopeId") DO NOTHING;

-- Forgeofwill scope permissions
INSERT INTO "permission" (name, description, resource, action, "targetId", "appScopeId")
VALUES
  ('profile.read', 'Read profile (forgeofwill)', 'profile', 'read', NULL, (SELECT id FROM app_scope WHERE name='forgeofwill')),
  ('profile.update', 'Update profile (forgeofwill)', 'profile', 'update', NULL, (SELECT id FROM app_scope WHERE name='forgeofwill')),
  ('asset.create', 'Create asset (forgeofwill)', 'asset', 'create', NULL, (SELECT id FROM app_scope WHERE name='forgeofwill')),
  ('asset.read', 'Read asset (forgeofwill)', 'asset', 'read', NULL, (SELECT id FROM app_scope WHERE name='forgeofwill')),
  ('asset.update', 'Update asset (forgeofwill)', 'asset', 'update', NULL, (SELECT id FROM app_scope WHERE name='forgeofwill')),
  ('asset.delete', 'Delete asset (forgeofwill)', 'asset', 'delete', NULL, (SELECT id FROM app_scope WHERE name='forgeofwill')),
  ('social.post.create', 'Create social post (forgeofwill)', 'post', 'create', NULL, (SELECT id FROM app_scope WHERE name='forgeofwill')),
  ('social.post.read', 'Read social post (forgeofwill)', 'post', 'read', NULL, (SELECT id FROM app_scope WHERE name='forgeofwill'))
ON CONFLICT (name, "appScopeId") DO NOTHING;

-- Local Hub scope permissions (classifieds, community management)
INSERT INTO "permission" (name, description, resource, action, "targetId", "appScopeId")
VALUES
  ('classified.create', 'Create classified ad', 'classified', 'create', NULL, (SELECT id FROM app_scope WHERE name='local-hub')),
  ('classified.read', 'Read classified ad', 'classified', 'read', NULL, (SELECT id FROM app_scope WHERE name='local-hub')),
  ('classified.update', 'Update classified ad', 'classified', 'update', NULL, (SELECT id FROM app_scope WHERE name='local-hub')),
  ('classified.delete', 'Delete classified ad', 'classified', 'delete', NULL, (SELECT id FROM app_scope WHERE name='local-hub')),
  ('community.join', 'Join community', 'community', 'join', NULL, (SELECT id FROM app_scope WHERE name='local-hub')),
  ('community.leave', 'Leave community', 'community', 'leave', NULL, (SELECT id FROM app_scope WHERE name='local-hub')),
  ('community.read', 'Read community', 'community', 'read', NULL, (SELECT id FROM app_scope WHERE name='local-hub')),
  ('business.create', 'Create business page', 'business', 'create', NULL, (SELECT id FROM app_scope WHERE name='local-hub')),
  ('business.update', 'Update business page', 'business', 'update', NULL, (SELECT id FROM app_scope WHERE name='local-hub')),
  ('election.vote', 'Vote in community elections', 'election', 'vote', NULL, (SELECT id FROM app_scope WHERE name='local-hub')),
  ('election.nominate', 'Nominate in community elections', 'election', 'nominate', NULL, (SELECT id FROM app_scope WHERE name='local-hub'))
ON CONFLICT (name, "appScopeId") DO NOTHING;

-- Local Hub social permissions
INSERT INTO "permission" (name, description, resource, action, "targetId", "appScopeId")
VALUES
  ('social.follow', 'Follow/unfollow users (local-hub)', 'follow', 'create', NULL, (SELECT id FROM app_scope WHERE name='local-hub')),
  ('social.post.create', 'Create social post (local-hub)', 'post', 'create', NULL, (SELECT id FROM app_scope WHERE name='local-hub')),
  ('social.post.read', 'Read social post (local-hub)', 'post', 'read', NULL, (SELECT id FROM app_scope WHERE name='local-hub')),
  ('social.post.update', 'Update social post (local-hub)', 'post', 'update', NULL, (SELECT id FROM app_scope WHERE name='local-hub')),
  ('social.post.delete', 'Delete social post (local-hub)', 'post', 'delete', NULL, (SELECT id FROM app_scope WHERE name='local-hub')),
  ('social.comment.create', 'Create comment (local-hub)', 'comment', 'create', NULL, (SELECT id FROM app_scope WHERE name='local-hub')),
  ('social.vote.create', 'Vote (local-hub)', 'vote', 'create', NULL, (SELECT id FROM app_scope WHERE name='local-hub')),
  ('social.reaction.create', 'Create reaction (local-hub)', 'reaction', 'create', NULL, (SELECT id FROM app_scope WHERE name='local-hub')),
  ('social.reaction.read', 'Read reaction (local-hub)', 'reaction', 'read', NULL, (SELECT id FROM app_scope WHERE name='local-hub'))
ON CONFLICT (name, "appScopeId") DO NOTHING;

-- Video client permissions
INSERT INTO "permission" (name, description, resource, action, "targetId", "appScopeId")
VALUES
  ('videos.channel.create', 'Create a video channel community', 'videos.channel', 'create', NULL, (SELECT id FROM app_scope WHERE name='video-client')),
  ('videos.channel.update', 'Update a video channel community', 'videos.channel', 'update', NULL, (SELECT id FROM app_scope WHERE name='video-client')),
  ('videos.channel.delete', 'Delete a video channel community', 'videos.channel', 'delete', NULL, (SELECT id FROM app_scope WHERE name='video-client')),
  ('videos.video.create', 'Create a video entry', 'videos.video', 'create', NULL, (SELECT id FROM app_scope WHERE name='video-client')),
  ('videos.video.update', 'Update a video entry', 'videos.video', 'update', NULL, (SELECT id FROM app_scope WHERE name='video-client')),
  ('videos.video.delete', 'Delete a video entry', 'videos.video', 'delete', NULL, (SELECT id FROM app_scope WHERE name='video-client')),
  ('videos.schedule.create', 'Create a scheduled feed block', 'videos.schedule', 'create', NULL, (SELECT id FROM app_scope WHERE name='video-client')),
  ('videos.schedule.update', 'Update a scheduled feed block', 'videos.schedule', 'update', NULL, (SELECT id FROM app_scope WHERE name='video-client')),
  ('videos.schedule.delete', 'Delete a scheduled feed block', 'videos.schedule', 'delete', NULL, (SELECT id FROM app_scope WHERE name='video-client')),
  ('videos.live.start', 'Start a live on-air session', 'videos.live', 'start', NULL, (SELECT id FROM app_scope WHERE name='video-client')),
  ('videos.live.stop', 'Stop a live on-air session', 'videos.live', 'stop', NULL, (SELECT id FROM app_scope WHERE name='video-client')),
  ('community.join', 'Join a video channel community', 'community', 'join', NULL, (SELECT id FROM app_scope WHERE name='video-client')),
  ('community.leave', 'Leave a video channel community', 'community', 'leave', NULL, (SELECT id FROM app_scope WHERE name='video-client')),
  ('community.read', 'Read a video channel community', 'community', 'read', NULL, (SELECT id FROM app_scope WHERE name='video-client')),
  ('social.post.create', 'Create a channel community post', 'post', 'create', NULL, (SELECT id FROM app_scope WHERE name='video-client')),
  ('social.post.read', 'Read a channel community post', 'post', 'read', NULL, (SELECT id FROM app_scope WHERE name='video-client')),
  ('social.comment.create', 'Create a channel community comment', 'comment', 'create', NULL, (SELECT id FROM app_scope WHERE name='video-client')),
  ('social.vote.create', 'Vote in a channel community', 'vote', 'create', NULL, (SELECT id FROM app_scope WHERE name='video-client')),
  ('social.reaction.create', 'Create a channel community reaction', 'reaction', 'create', NULL, (SELECT id FROM app_scope WHERE name='video-client')),
  ('social.reaction.read', 'Read a channel community reaction', 'reaction', 'read', NULL, (SELECT id FROM app_scope WHERE name='video-client'))
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
FROM role r JOIN permission p ON p.name IN ('social.follow', 'social.post.create', 'social.post.read', 'social.reaction.create', 'social.reaction.read') AND p."appScopeId" = (SELECT id FROM app_scope WHERE name='social')
WHERE r.name = 'social_user'
ON CONFLICT DO NOTHING;

-- Global scope owner roles (owner_console_owner, global_admin, system_admin) - full permissions
INSERT INTO "role_permission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM role r 
CROSS JOIN permission p 
WHERE r.name IN ('owner_console_owner', 'global_admin', 'system_admin')
  AND p."appScopeId" = (SELECT id FROM app_scope WHERE name='global')
ON CONFLICT DO NOTHING;

-- standard_user (global scope) - basic read/write permissions
INSERT INTO "role_permission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM role r JOIN permission p ON p.name IN (
  'profile.read', 'profile.update',
  'asset.create', 'asset.read', 'asset.update',
  'social.follow', 'social.post.create', 'social.post.read',
  'social.reaction.create', 'social.reaction.read'
) AND p."appScopeId" = (SELECT id FROM app_scope WHERE name='global')
WHERE r.name = 'standard_user'
ON CONFLICT DO NOTHING;

-- forgeofwill_standard_user - profile and social permissions for forgeofwill scope
INSERT INTO "role_permission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM role r JOIN permission p ON p.name IN (
  'profile.read', 'profile.update',
  'asset.create', 'asset.read', 'asset.update', 'asset.delete',
  'social.post.create', 'social.post.read',
  'social.reaction.create', 'social.reaction.read'
) AND p."appScopeId" = (SELECT id FROM app_scope WHERE name='forgeofwill')
WHERE r.name = 'forgeofwill_standard_user'
ON CONFLICT DO NOTHING;

-- client_interface_user - basic client interface permissions
INSERT INTO "role_permission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM role r JOIN permission p ON p.name IN (
  'profile.read', 'profile.update',
  'asset.create', 'asset.read', 'asset.update',
  'social.reaction.create', 'social.reaction.read'
) AND p."appScopeId" = (SELECT id FROM app_scope WHERE name='client-interface')
WHERE r.name = 'client_interface_user'
ON CONFLICT DO NOTHING;

-- client_interface_user - social permissions via social app scope
INSERT INTO "role_permission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM role r
JOIN permission p ON p.name IN (
  'social.post.create',
  'social.post.read',
  'social.post.update',
  'social.post.delete',
  'social.comment.create',
  'social.vote.create',
  'social.follow',
  'social.reaction.create',
  'social.reaction.read'
) AND p."appScopeId" = (SELECT id FROM app_scope WHERE name='social')
WHERE r.name = 'client_interface_user'
ON CONFLICT DO NOTHING;

-- digital_standard_user - basic digital homestead permissions
INSERT INTO "role_permission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM role r 
CROSS JOIN permission p 
WHERE r.name = 'digital_standard_user'
  AND p."appScopeId" = (SELECT id FROM app_scope WHERE name='digital-homestead')
ON CONFLICT DO NOTHING;

-- christopherrutherford_standard_user - basic permissions
INSERT INTO "role_permission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM role r 
CROSS JOIN permission p 
WHERE r.name = 'christopherrutherford_standard_user'
  AND p."appScopeId" = (SELECT id FROM app_scope WHERE name='christopherrutherford-net')
ON CONFLICT DO NOTHING;

-- christopherrutherford_owner_user - full permissions
INSERT INTO "role_permission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM role r 
CROSS JOIN permission p 
WHERE r.name = 'christopherrutherford_owner_user'
  AND p."appScopeId" = (SELECT id FROM app_scope WHERE name='christopherrutherford-net')
ON CONFLICT DO NOTHING;

-- local_hub_member - full classifieds, community, and social permissions
INSERT INTO "role_permission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM role r JOIN permission p ON p.name IN (
  'classified.create',
  'classified.read',
  'classified.update',
  'classified.delete',
  'community.join',
  'community.leave',
  'community.read',
  'election.vote',
  'election.nominate',
  'social.follow',
  'social.post.create',
  'social.post.read',
  'social.post.update',
  'social.post.delete',
  'social.comment.create',
  'social.vote.create',
  'social.reaction.create',
  'social.reaction.read'
) AND p."appScopeId" = (SELECT id FROM app_scope WHERE name='local-hub')
WHERE r.name = 'local_hub_member'
ON CONFLICT DO NOTHING;

-- local_hub_community_poster - community posting via local-hub social permissions
INSERT INTO "role_permission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM role r JOIN permission p ON p.name = 'social.post.create' AND p."appScopeId" = (SELECT id FROM app_scope WHERE name='local-hub')
WHERE r.name = 'local_hub_community_poster'
ON CONFLICT DO NOTHING;

-- local_hub_standard_user - basic read permissions + social read permissions
INSERT INTO "role_permission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM role r JOIN permission p ON p.name IN (
  'classified.read',
  'community.read',
  'social.post.read',
  'social.reaction.read'
) AND p."appScopeId" = (SELECT id FROM app_scope WHERE name='local-hub')
WHERE r.name = 'local_hub_standard_user'
ON CONFLICT DO NOTHING;

-- video_client_member - community participation permissions for channel communities
INSERT INTO "role_permission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM role r JOIN permission p ON p.name IN (
  'community.join',
  'community.leave',
  'community.read',
  'social.post.create',
  'social.post.read',
  'social.comment.create',
  'social.vote.create',
  'social.reaction.create',
  'social.reaction.read'
) AND p."appScopeId" = (SELECT id FROM app_scope WHERE name='video-client')
WHERE r.name = 'video_client_member'
ON CONFLICT DO NOTHING;

-- video_channel_creator - creator permissions for channel, video, schedule, live, and community participation
INSERT INTO "role_permission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM role r JOIN permission p ON p.name IN (
  'videos.channel.create',
  'videos.channel.update',
  'videos.channel.delete',
  'videos.video.create',
  'videos.video.update',
  'videos.video.delete',
  'videos.schedule.create',
  'videos.schedule.update',
  'videos.schedule.delete',
  'videos.live.start',
  'videos.live.stop',
  'community.join',
  'community.leave',
  'community.read',
  'social.post.create',
  'social.post.read',
  'social.comment.create',
  'social.vote.create',
  'social.reaction.create',
  'social.reaction.read'
) AND p."appScopeId" = (SELECT id FROM app_scope WHERE name='video-client')
WHERE r.name = 'video_channel_creator'
ON CONFLICT DO NOTHING;

COMMIT;
SQL

echo "App scopes seeded."

-- =============================================================================
-- Promote an existing account to Platform Owner (owner-console access)
-- =============================================================================
-- Run with psql against the deployment database host, for example:
--   psql -d ot_permissions -f scripts/promote-owner-console.sql
-- Set this to the existing authentication account to promote.
\set owner_email 'owner@example.com'
--
-- Owner-console login (via the gateway) requires the profile used at login to hold
-- one of {owner_console_owner, owner, global_admin, system_admin} in the GLOBAL app
-- scope. This grants the seeded `owner` role to that profile in the global scope.

-- Resolve the account in its owning databases. These are separate PostgreSQL
-- databases, so they cannot be joined directly from ot_permissions.
\connect ot_authentication
SELECT id AS owner_user_id
FROM user_entity
WHERE lower(email) = lower(:'owner_email');
\gset

\if :{?owner_user_id}
\else
  \error 'No authentication user found for the configured owner_email'
\endif

\connect ot_profile
SELECT id AS owner_profile_id
FROM profile
WHERE "userId" = :'owner_user_id';
\gset

\if :{?owner_profile_id}
\else
  \error 'No profile found for the configured owner email'
\endif

\connect ot_permissions
SELECT id AS owner_role_id
FROM role
WHERE name = 'owner';
\gset

\if :{?owner_role_id}
\else
  \error 'The seeded owner role does not exist'
\endif

SELECT id AS global_scope_id
FROM app_scope
WHERE name = 'global';
\gset

\if :{?global_scope_id}
\else
  \error 'The global app scope does not exist'
\endif

BEGIN;

INSERT INTO role_assignment
  (id, "profileId", "roleId", "appScopeId", "targetId", created_at)
VALUES
  (uuid_generate_v4(), :'owner_profile_id', :'owner_role_id',
   :'global_scope_id', NULL, now())
ON CONFLICT ("roleId", "profileId", "appScopeId") DO NOTHING;

SELECT ra."profileId", r.name AS role_name, s.name AS scope_name
FROM role_assignment ra
JOIN role r ON r.id = ra."roleId"
JOIN app_scope s ON s.id = ra."appScopeId"
WHERE ra."profileId" = :'owner_profile_id'
  AND s.name = 'global'
ORDER BY r.name;

COMMIT;

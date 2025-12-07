# Permissions audit — matrix & diagram

Summary
- Source: `apps/permissions/src/assets/default-permissions.json` (seed).
- Enforcement model in gateway:
  - Decorator: `RequirePermissions(...permissions)` sets metadata key `permissions`.
  - Guard: `PermissionsGuard` reads `x-ot-appscope` header, resolves app scope via Permissions microservice, and calls `RoleCommands.CheckPermission` for each permission with `{ profileId, permission, appScopeId }`.
  - If no decorator on handler/class, guard allows access (no requirement).
- Key implication: permissions are checked per app-scope (header-driven) and per-profileId (extracted from authenticated request). Controllers must be annotated with `RequirePermissions(...)` and/or use `UseGuards(PermissionsGuard)`.

Permissions matrix (condensed)
- client-interface
  - profile.read — read profile for client UI
  - profile.update — update profile via client UI
  - asset.create / asset.read / asset.update / asset.delete — full asset CRUD for client UI
- profile
  - profile.read — service reads profile
  - profile.update — profile writes
- blogging
  - blog.post.create — create blog posts
  - blog.post.read — read blog posts
  - blog.post.update — update posts
  - blog.post.delete — delete posts
- project-planning
  - project.create / project.read / project.update
  - task.create / task.read / task.update
- social
  - social.follow — follow/unfollow operations
  - social.post.create — create social posts
  - social.post.read — read social posts
- assets
  - asset.* — same CRUD semantics as client-interface but scoped to assets service
- owner-console (admin)
  - permissions.*, roles.*, users.*, appscopes.* — management CRUD

Notes on mapping & enforcement
- Permission token naming is resource.action (e.g., `blog.post.create`). The guard expects exact permission strings.
- App scope resolution is mandatory: `x-ot-appscope` header must be set or `PermissionsGuard` will reject.
- Some permissions appear across multiple app scopes (e.g., `profile.read` in both `profile` and `client-interface`): ensure controllers use the correct app-scope header to disambiguate.
- Default behavior: if a handler has no `RequirePermissions(...)` metadata, the guard treats it as publicly allowed (i.e., no permission check). This means missing decorators are the primary gap.

Actionable next steps (short)
- Annotate controllers that should be guarded with `RequirePermissions(...)` and ensure requests include `x-ot-appscope`.
- Add unit tests for `PermissionsGuard` covering: missing header, missing app-scope, user without profileId, permission denied, permission allowed.
- Add integration tests that verify gateway → permissions service → microservice flows for representative endpoints (e.g., blogging post.create, social.follow).

Mermaid diagram — overall flow & key scopes
```mermaid
flowchart TD
  subgraph RequestFlow["Request -> Gateway"]
    A["Client Request<br/>(JWT, x-ot-appscope)"] --> B[Gateway Controller Handler]
    B --> C{Has RequirePermissions?}
    C -- no --> D["Allow (no guard checks)"]
    C -- yes --> E[PermissionsGuard]
    E --> F["Permissions Service<br/>(AppScope lookup)"]
    E --> G["RoleCommands.CheckPermission<br/>(profileId, permission, appScopeId)"]
    G -- true --> H[Allow handler to execute]
    G -- false --> I[403 Forbidden]
  end

  subgraph AppScopes["App Scopes & Representative Permissions"]
    direction TB
    BLOG[blogging]
    SOCIAL[social]
    ASSETS[assets]
    PROFILE[profile]
    CLIENT[client-interface]
    OWNER[owner-console]
  end

  subgraph PermissionsPerScope["Permissions (examples)"]
    direction LR
    P1[blog.post.create<br/>blog.post.read<br/>blog.post.update<br/>blog.post.delete]
    P2[social.follow<br/>social.post.create<br/>social.post.read]
    P3[asset.create<br/>asset.read<br/>asset.update<br/>asset.delete]
    P4[profile.read<br/>profile.update]
    P5[permissions.*<br/>roles.*<br/>users.*]
  end

  BLOG --> P1
  SOCIAL --> P2
  ASSETS --> P3
  PROFILE --> P4
  CLIENT --> P3
  CLIENT --> P4
  OWNER --> P5

  style RequestFlow stroke:#333,stroke-width:1px
  style AppScopes stroke:#666,stroke-dasharray: 4 2
  style PermissionsPerScope stroke:#999

```

```mermaid
flowchart LR
  %% App scopes grouped with roles -> permissions (permissionName@appScope)

  subgraph client_interface["appScope: client-interface"]
    direction TB
    CI_user["role: client_interface_user"]
    CI_profile_owner["role: client_profile_owner"]
    CI_follower["role: client_follower"]
    CI_asset_manager["role: client_asset_manager"]

    P_profile_read_CI["perm: profile.read@client-interface"]
    P_profile_update_CI["perm: profile.update@client-interface"]
    P_asset_create_CI["perm: asset.create@client-interface"]
    P_asset_read_CI["perm: asset.read@client-interface"]
    P_asset_update_CI["perm: asset.update@client-interface"]
    P_asset_delete_CI["perm: asset.delete@client-interface"]

    CI_user --> P_profile_read_CI
    CI_profile_owner --> P_profile_read_CI
    CI_profile_owner --> P_profile_update_CI
    CI_follower --> P_profile_read_CI
    CI_asset_manager --> P_asset_create_CI
    CI_asset_manager --> P_asset_read_CI
    CI_asset_manager --> P_asset_update_CI
    CI_asset_manager --> P_asset_delete_CI
  end

  subgraph profile["appScope: profile"]
    direction TB
    P_profile_read_PR["perm: profile.read@profile"]
    P_profile_update_PR["perm: profile.update@profile"]
  end

  subgraph blogging["appScope: blogging"]
    direction TB
    Blog_author["role: blog_author"]
    Blog_standard["role: blog_standard_user"]
    Blog_reader["role: blog_reader"]

    PB_post_create["perm: blog.post.create@blogging"]
    PB_post_read["perm: blog.post.read@blogging"]
    PB_post_update["perm: blog.post.update@blogging"]
    PB_post_delete["perm: blog.post.delete@blogging"]

    Blog_author --> PB_post_create
    Blog_author --> PB_post_read
    Blog_author --> PB_post_update
    Blog_author --> PB_post_delete
    Blog_standard --> PB_post_read
    Blog_reader --> PB_post_read
  end

  subgraph project_planning["appScope: project-planning"]
    direction TB
    Planner["role: forgeofwill_planner"]
    Planner --> PP_project_create["perm: project.create@project-planning"]
    Planner --> PP_project_read["perm: project.read@project-planning"]
    Planner --> PP_project_update["perm: project.update@project-planning"]
    Planner --> PP_task_create["perm: task.create@project-planning"]
    Planner --> PP_task_read["perm: task.read@project-planning"]
    Planner --> PP_task_update["perm: task.update@project-planning"]
  end

  subgraph assets["appScope: assets"]
    direction TB
    Asset_owner["role: asset_owner"]
    Asset_owner --> A_asset_create["perm: asset.create@assets"]
    Asset_owner --> A_asset_read["perm: asset.read@assets"]
    Asset_owner --> A_asset_update["perm: asset.update@assets"]
    Asset_owner --> A_asset_delete["perm: asset.delete@assets"]
  end

  subgraph social["appScope: social"]
    direction TB
    Social_user["role: social_user"]
    Social_standard["role: social_standard_user"]

    S_follow["perm: social.follow@social"]
    S_post_create["perm: social.post.create@social"]
    S_post_read["perm: social.post.read@social"]

    Social_user --> S_follow
    Social_user --> S_post_create
    Social_user --> S_post_read
    Social_standard --> S_post_read
  end

  subgraph owner_console["appScope: owner-console"]
    direction TB
    Owner_owner["role: owner_console_owner"]

    OC_permissions_read["perm: permissions.read@owner-console"]
    OC_permissions_create["perm: permissions.create@owner-console"]
    OC_permissions_update["perm: permissions.update@owner-console"]
    OC_permissions_delete["perm: permissions.delete@owner-console"]

    OC_roles_read["perm: roles.read@owner-console"]
    OC_roles_create["perm: roles.create@owner-console"]
    OC_roles_update["perm: roles.update@owner-console"]
    OC_roles_delete["perm: roles.delete@owner-console"]

    OC_users_read["perm: users.read@owner-console"]
    OC_users_update["perm: users.update@owner-console"]

    OC_appscopes_read["perm: appscopes.read@owner-console"]
    OC_appscopes_create["perm: appscopes.create@owner-console"]
    OC_appscopes_update["perm: appscopes.update@owner-console"]
    OC_appscopes_delete["perm: appscopes.delete@owner-console"]

    Owner_owner --> OC_permissions_read
    Owner_owner --> OC_permissions_create
    Owner_owner --> OC_permissions_update
    Owner_owner --> OC_permissions_delete

    Owner_owner --> OC_roles_read
    Owner_owner --> OC_roles_create
    Owner_owner --> OC_roles_update
    Owner_owner --> OC_roles_delete

    Owner_owner --> OC_users_read
    Owner_owner --> OC_users_update

    Owner_owner --> OC_appscopes_read
    Owner_owner --> OC_appscopes_create
    Owner_owner --> OC_appscopes_update
    Owner_owner --> OC_appscopes_delete
  end

  subgraph digital_homestead["appScope: digital-homestead"]
    direction TB
    DH_homesteader["role: digital_homesteader"]
    DH_follower["role: digital_follower"]
    DH_standard["role: digital_standard_user"]

    DH_profile_read["perm: profile.read@digital-homestead"]
    DH_blog_create["perm: blog.post.create@blogging"]
    DH_blog_read["perm: blog.post.read@blogging"]
    DH_blog_update["perm: blog.post.update@blogging"]
    DH_blog_delete["perm: blog.post.delete@blogging"]

    DH_homesteader --> DH_profile_read
    DH_homesteader --> DH_blog_create
    DH_homesteader --> DH_blog_read
    DH_homesteader --> DH_blog_update
    DH_homesteader --> DH_blog_delete

    DH_follower --> DH_profile_read
    DH_follower --> DH_blog_read
    DH_follower --> S_post_read
  end

  %% cross-scope / special mappings
  Forge_profile_owner["role: forgeofwill_profile_owner"]
  Forge_profile_owner --> FP_profile_read["perm: profile.read@forgeofwill_or_profile"]
  Forge_profile_owner --> FP_profile_update["perm: profile.update@forgeofwill_or_profile"]

  Forge_standard_user["role: forgeofwill_standard_user"]
  Forge_standard_user --> FP_profile_read2["perm: profile.read@forgeofwill"]

  %% layout hints
  classDef scope fill:#f9f,stroke:#333,stroke-width:1px;
  class client_interface,profile,blogging,project_planning,assets,social,owner_console,digital_homestead scope;
```
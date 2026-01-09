# Permissions System Fix Summary

## Problem Statement

Users signing up via the owner console were unable to:
1. Update their profiles in apps like forgeofwill and client-interface
2. Create social posts (permission denied for `social.post.create`)

## Root Causes Identified

### 1. Missing Roles in Seed Data
The permission initialization builder (`libs/permission-lib/src/lib/permission-builder.ts`) referenced roles that didn't exist in the seed scripts:

**Missing Global Scope Roles:**
- `owner_console_owner` - Owner console administrator
- `global_admin` - Global administrator
- `system_admin` - System administrator  
- `standard_user` - Standard global user

**Missing App-Specific Roles:**
- `forgeofwill_standard_user`
- `client_interface_user`
- `digital_standard_user`
- `christopherrutherford_standard_user`
- `christopherrutherford_owner_user`

### 2. Bug in PermissionsGuard
**File:** `apps/gateway/src/guards/permissions.guard.ts`
**Line:** 84
**Issue:** Used `user.id` instead of `user.userId` when querying profiles
**Impact:** The guard couldn't properly look up user profiles, causing permission checks to fail

### 3. Missing Global Scope Permissions
Users registering via owner-console get a global scope profile, but the permissions for actions like `social.post.create` and `profile.update` weren't available in the global scope, only in app-specific scopes.

## Changes Made

### 1. Fixed PermissionsGuard Bug
**File:** `apps/gateway/src/guards/permissions.guard.ts`

```typescript
// Before (line 84):
userId: user.id,

// After:
userId: user.userId,
```

This ensures the guard correctly queries profiles using the `userId` field from the `UserContext` interface.

### 2. Updated Shell Seed Script
**File:** `seed-permissions.sh`

Added the missing roles:
- Global admin roles: `owner_console_owner`, `global_admin`, `system_admin`, `standard_user`
- App-specific standard user roles for all scopes
- Christopher Rutherford owner role

Added global scope permissions for:
- Profile operations (read, update, delete)
- Asset operations (create, read, update, delete)
- Social operations (follow, post.create, post.read, post.update, post.delete)
- Blog operations (post.create, post.read, post.update, post.delete)
- Project/task operations (create, read, update, delete)

Added forgeofwill scope permissions for:
- Profile operations (read, update)
- Asset operations (create, read, update, delete)
- Social post operations (create, read)

Added role-permission mappings for all new roles.

### 3. Updated JSON Seed Data
**File:** `apps/permissions/src/assets/default-permissions.json`

Added the same roles and 186 new role-permission mappings:
- 174 mappings for global admin roles (58 permissions × 3 roles)
- 11 mappings for standard_user (basic operations)
- 1 mapping for forgeofwill_standard_user (profile.update)

## How Permission Flow Works Now

### Profile Creation Flow

1. User signs up via owner-console
2. Profile is created with `appScope: 'global'`
3. `ProfileController.createProfile()` calls `initializeProfilePermissions()`
4. Checks if user has global owner roles via `checkUserHasGlobalOwnerRoles()`
5. If yes, assigns owner roles for the app scope using `RoleInitBuilder.addOwnerScopeDefaults()`
6. If no, assigns standard user roles using `RoleInitBuilder.addAppScopeDefaults()`
7. Always adds asset permissions via `addAssetOwnerPermissions()` for profile pictures

### Permission Check Flow

1. Request comes to gateway with `x-ot-appscope` header
2. `AuthGuard` validates JWT and sets `request.user` (UserContext with userId, profileId)
3. `PermissionsGuard` checks required permissions:
   a. Queries profiles by `userId` (now correctly using `user.userId`)
   b. Finds global profile and app-specific profile
   c. First tries global scope permissions
   d. If global doesn't grant access, tries app-specific scope
   e. Uses `checkGlobalFallback: true` to allow global permissions to work for app-specific requests

### Global Scope Advantages

Users with global scope profiles now have:
- **Owner roles** (`owner_console_owner`, `global_admin`, `system_admin`): Full permissions across all operations
- **Standard role** (`standard_user`): Basic operations (profile read/update, asset management, social posting)
- **Cross-app access**: Global permissions apply to requests with any `x-ot-appscope` header via fallback mechanism

## Testing Recommendations

### Unit Tests
- Verify PermissionsGuard uses `user.userId` correctly
- Test global scope fallback mechanism
- Test role assignment during profile creation

### Integration Tests
1. Create user via owner-console
2. Verify global profile is created
3. Verify correct roles are assigned
4. Test profile update in forgeofwill with `x-ot-appscope: forgeofwill`
5. Test social post creation with `x-ot-appscope: social`
6. Verify global permissions grant access even with app-specific scope headers

### E2E Tests
1. Sign up via owner console
2. Navigate to forgeofwill
3. Update profile (should succeed)
4. Create a social post (should succeed)
5. Upload profile picture (should succeed via asset permissions)

## Migration Notes

### For Existing Users
If users were created before this fix:
1. They may have incomplete role assignments
2. Run the seed script to add new roles and permissions to the database
3. Consider creating a migration script to assign missing roles to existing profiles

### For New Deployments
1. Run database migrations
2. Run `seed-permissions.sh` or execute the TypeScript seed from the permissions service
3. Verify all roles and permissions are created
4. Test user registration and permission checks

## Related Files

- `apps/gateway/src/guards/permissions.guard.ts` - Permission checking guard
- `apps/gateway/src/controllers/profile/profile.controller.ts` - Profile creation and permission initialization
- `libs/permission-lib/src/lib/permission-builder.ts` - Role assignment builder
- `apps/permissions/src/app/roles.service.ts` - Permission checking logic
- `seed-permissions.sh` - Shell-based seed script
- `apps/permissions/src/assets/default-permissions.json` - JSON-based seed data
- `apps/permissions/src/app/seed-permissions.ts` - TypeScript seed script

## Verification Checklist

- [x] PermissionsGuard uses correct user property (userId vs id)
- [x] All referenced roles exist in seed scripts
- [x] Global scope has necessary permissions
- [x] Role-permission mappings are complete
- [x] Code compiles without errors
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing of user registration flow
- [ ] Manual testing of profile updates
- [ ] Manual testing of social post creation

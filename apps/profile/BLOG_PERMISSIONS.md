# Blog Permission System

## Overview

The blog permission system controls who can create, edit, and delete blog posts. Users are assigned one of three blog roles:

- **NONE** (default): Cannot create, edit, or delete blog posts
- **POSTER**: Can create, edit, and delete blog posts
- **OWNER**: Can create, edit, and delete blog posts, plus promote other users to poster or owner

## Architecture

### Profile Entity
The `Profile` entity has been extended with a `blogRole` field:
- Type: `BlogRole` enum (NONE, POSTER, OWNER)
- Default: `NONE`
- Stored in the database as a varchar

### Gateway Protection
Blog-related endpoints in the gateway are protected with:
- `AuthGuard`: Ensures user is authenticated
- `BlogPermissionGuard`: Checks user has appropriate blog role
- `@RequireBlogPermissions()` decorator: Specifies required permissions

Protected endpoints:
- `POST /api/post` - Create blog post (requires POSTER or OWNER)
- `PATCH /api/post/:id` - Update blog post (requires POSTER or OWNER)
- `DELETE /api/post/:id` - Delete blog post (requires POSTER or OWNER)

Public endpoints (no permission required):
- `GET /api/post/:id` - View blog post
- `POST /api/post/find` - Query blog posts

### Profile Service
New methods added to ProfileService:
- `setBlogRole(profileId: string, blogRole: BlogRole)`: Set a user's blog role
- `getBlogRole(userId: string)`: Get a user's current blog role
- `findByUserId(userId: string)`: Find profile by userId

### Message Patterns
New message patterns added to ProfileCommands:
- `SetBlogRole`: Set a user's blog role
- `GetBlogRole`: Get a user's current blog role

## Promoting Users

### Using the Script

A command-line script is provided to promote users:

```bash
# From the root directory
cd apps/profile
npm run promote-blog-role <userId> <role>
```

Arguments:
- `userId`: The user ID (from authentication system)
- `role`: One of `poster`, `owner`, or `none`

Examples:
```bash
# Promote user to poster
npm run promote-blog-role user-123 poster

# Promote user to owner
npm run promote-blog-role user-456 owner

# Revoke blog permissions
npm run promote-blog-role user-789 none
```

### Using the API

Owners can promote users programmatically through the Profile service message patterns:

```typescript
// Set blog role
await profileService.send(
  { cmd: ProfileCommands.SetBlogRole },
  { profileId: 'profile-id-here', blogRole: BlogRole.POSTER }
);

// Get blog role
const role = await profileService.send(
  { cmd: ProfileCommands.GetBlogRole },
  'user-id-here'
);
```

## Permission Matrix

| Action | NONE | POSTER | OWNER |
|--------|------|--------|-------|
| View posts | ✅ | ✅ | ✅ |
| Create posts | ❌ | ✅ | ✅ |
| Edit posts | ❌ | ✅ | ✅ |
| Delete posts | ❌ | ✅ | ✅ |
| Promote users | ❌ | ❌ | ✅ |

## Error Handling

When a user without proper permissions attempts a protected action, they receive:
- HTTP Status: `403 Forbidden`
- Message: "You do not have permission to perform this action. Contact an administrator to be granted blog posting privileges."

## Migration

A database migration is provided to add the `blogRole` column to existing profiles:
- File: `migrations/1730838000000-add-blog-role.ts`
- Default value: `NONE`
- Run with: `npm run migration:run`

## Future Enhancements

Potential improvements to the permission system:
- Per-post ownership tracking (users can only edit their own posts)
- Admin role with full system control
- Temporary permissions with expiration dates
- Permission audit logging
- UI for owners to manage permissions
- Group-based permissions

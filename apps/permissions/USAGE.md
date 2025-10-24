# Permissions System Usage Guide

This guide provides examples of how to use the permissions system in the Optimistic Tanuki platform.

## Overview

The permissions system consists of three main concepts:
- **Permissions**: Define what actions can be performed on resources
- **Roles**: Group permissions together
- **Role Assignments**: Assign roles to user profiles with application scope

## Setting Up Permissions

### Creating Permissions

```typescript
// Example: Create a permission for writing blog posts
POST /permissions/permission
{
  "name": "blog:posts:write",
  "description": "Allows creating and editing blog posts",
  "resource": "blog_posts",
  "action": "write"
}

// Example: Create a permission for item-level access
POST /permissions/permission
{
  "name": "blog:posts:delete",
  "description": "Allows deleting blog posts",
  "resource": "blog_posts",
  "action": "delete",
  "targetId": "specific-post-id" // Optional: for item-level permissions
}
```

### Creating Roles

```typescript
// Example: Create a blogger role
POST /permissions/role
{
  "name": "blogger",
  "description": "Can create and edit blog posts",
  "appScope": "forgeofwill"
}

// Example: Create a moderator role
POST /permissions/role
{
  "name": "moderator",
  "description": "Can moderate content and manage users",
  "appScope": "global"
}
```

### Adding Permissions to Roles

```typescript
// Add the blog:posts:write permission to the blogger role
POST /permissions/role/{roleId}/permission/{permissionId}
```

## Assigning Roles to Users

### Assign a Role

```typescript
POST /permissions/assignment
{
  "roleId": "role-uuid",
  "profileId": "user-profile-uuid",
  "appScope": "forgeofwill"
}
```

### Remove a Role Assignment

```typescript
DELETE /permissions/assignment/{assignmentId}
```

## Checking Permissions

### Check if a User Has Permission

```typescript
POST /permissions/check-permission
{
  "permission": "blog:posts:write",
  "appScope": "forgeofwill",
  "targetId": "optional-item-id" // Optional: for item-level permissions
}

// Response: true or false
```

### Get All User Roles

```typescript
GET /permissions/user-roles/{profileId}
{
  "appScope": "forgeofwill" // Optional: filter by app scope
}
```

## Using Guards and Decorators in Controllers

### Protecting Endpoints with Permissions

```typescript
import { Controller, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../auth/auth.guard';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { RequirePermissions } from '../../decorators/permissions.decorator';
import { User, UserDetails } from '../../decorators/user.decorator';

@Controller('blog')
@UseGuards(AuthGuard, PermissionsGuard)
export class BlogController {
  
  @Post('posts')
  @RequirePermissions(['blog:posts:write'], 'forgeofwill')
  async createPost(@User() user: UserDetails, @Body() dto: CreatePostDto) {
    // Only users with blog:posts:write permission in forgeofwill can access this
    return this.blogService.createPost(dto);
  }

  @Delete('posts/:id')
  @RequirePermissions(['blog:posts:delete'], 'forgeofwill')
  async deletePost(@Param('id') id: string) {
    // Only users with blog:posts:delete permission in forgeofwill can access this
    return this.blogService.deletePost(id);
  }

  @Get('posts')
  // No permissions required - public endpoint
  async getPosts() {
    return this.blogService.getPosts();
  }
}
```

### Multiple Permissions Required

```typescript
@Post('admin/users')
@RequirePermissions(['users:write', 'admin:access'], 'global')
async createUser(@Body() dto: CreateUserDto) {
  // User must have BOTH permissions
  return this.userService.createUser(dto);
}
```

## Example Use Cases

### Case 1: Blog System with Roles

1. Create permissions:
   - `blog:posts:write` - Create/edit posts
   - `blog:posts:delete` - Delete posts
   - `blog:comments:moderate` - Moderate comments
   - `blog:settings:manage` - Manage blog settings

2. Create roles:
   - **Blogger** (appScope: forgeofwill)
     - Permissions: blog:posts:write
   - **Moderator** (appScope: forgeofwill)
     - Permissions: blog:posts:write, blog:posts:delete, blog:comments:moderate
   - **Admin** (appScope: global)
     - Permissions: blog:posts:write, blog:posts:delete, blog:comments:moderate, blog:settings:manage

3. Assign roles to users based on their responsibilities

### Case 2: Project Management with Item-Level Permissions

1. Create general permissions:
   - `projects:read` - View projects
   - `projects:write` - Create/edit projects
   - `projects:delete` - Delete projects

2. Create item-specific permissions:
   - `projects:write` with targetId="{project-id}" - Edit specific project
   - `projects:delete` with targetId="{project-id}" - Delete specific project

3. Assign roles:
   - **Project Member** gets `projects:read` for all projects
   - **Project Owner** gets `projects:write` and `projects:delete` for their specific project

### Case 3: Multi-Application Permissions

```typescript
// Global admin can access everything
POST /permissions/role
{
  "name": "global_admin",
  "description": "Administrator across all applications",
  "appScope": "global"
}

// App-specific admin
POST /permissions/role
{
  "name": "fow_admin",
  "description": "Administrator for Forge of Will only",
  "appScope": "forgeofwill"
}

// Assign global admin
POST /permissions/assignment
{
  "roleId": "global-admin-role-id",
  "profileId": "user-profile-id",
  "appScope": "global"
}

// Assign app-specific admin
POST /permissions/assignment
{
  "roleId": "fow-admin-role-id",
  "profileId": "user-profile-id",
  "appScope": "forgeofwill"
}
```

## Permission Naming Conventions

Follow these conventions for permission names:

- Format: `{app}:{resource}:{action}`
- Examples:
  - `blog:posts:read`
  - `blog:posts:write`
  - `blog:posts:delete`
  - `social:comments:moderate`
  - `profile:settings:manage`
  - `admin:users:impersonate`

## Application Scopes

Common application scopes:
- `global` - Applies across all applications
- `forgeofwill` - Forge of Will application
- `client-interface` - Main client interface
- `digital-homestead` - Digital Homestead application
- `christopherrutherford-net` - Personal website
- `blogging` - Blogging platform

## API Endpoints Summary

### Permissions
- `POST /permissions/permission` - Create permission
- `GET /permissions/permission/:id` - Get permission
- `GET /permissions/permission` - Get all permissions
- `PUT /permissions/permission/:id` - Update permission
- `DELETE /permissions/permission/:id` - Delete permission

### Roles
- `POST /permissions/role` - Create role
- `GET /permissions/role/:id` - Get role
- `GET /permissions/role` - Get all roles
- `PUT /permissions/role/:id` - Update role
- `DELETE /permissions/role/:id` - Delete role
- `POST /permissions/role/:roleId/permission/:permissionId` - Add permission to role
- `DELETE /permissions/role/:roleId/permission/:permissionId` - Remove permission from role

### Assignments
- `POST /permissions/assignment` - Assign role to user
- `DELETE /permissions/assignment/:assignmentId` - Unassign role
- `GET /permissions/user-roles/:profileId` - Get user roles
- `POST /permissions/check-permission` - Check if user has permission

## Best Practices

1. **Start with Coarse Permissions**: Begin with broad permissions and refine as needed
2. **Use Role Hierarchies**: Create roles that build upon each other
3. **Document Permissions**: Keep a registry of all permissions and their purposes
4. **Regular Audits**: Periodically review role assignments
5. **Principle of Least Privilege**: Only grant permissions that are absolutely necessary
6. **App Scoping**: Use appropriate app scopes to limit permission blast radius
7. **Item-Level Sparingly**: Only use item-level permissions when truly necessary (performance consideration)

## Migration Path

For existing applications:

1. Identify all protected resources and actions
2. Create corresponding permissions
3. Create roles that group related permissions
4. Migrate existing authorization logic to use the permissions system
5. Assign roles to existing users based on their current access levels
6. Update controllers to use `@RequirePermissions` decorator and `PermissionsGuard`
7. Remove old authorization logic once migration is complete

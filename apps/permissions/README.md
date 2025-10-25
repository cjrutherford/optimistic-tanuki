# Permissions Service

The Permissions Service is a microservice that manages roles, permissions, and access control across all applications in the Optimistic Tanuki stack.

## Features

- **Role Management**: Create and manage roles scoped to specific applications
- **Permission Management**: Define fine-grained permissions for resources and actions
- **Role Assignments**: Assign roles to user profiles with application scope
- **Permission Checking**: Check if a user has specific permissions for resources
- **Item-Level Permissions**: Support for permissions scoped to specific database items

## Architecture

### Entities

1. **Permission**: Defines what actions can be performed on resources
   - `name`: Unique permission name
   - `description`: Human-readable description
   - `resource`: The resource this permission applies to
   - `action`: The action that can be performed (read, write, delete, etc.)
   - `targetId`: Optional ID for item-level permissions

2. **Role**: Groups permissions together under a named role
   - `name`: Unique role name
   - `description`: Human-readable description
   - `appScope`: Application scope (global, forgeofwill, client-interface, etc.)
   - `permissions`: Many-to-many relationship with permissions

3. **RoleAssignment**: Assigns roles to user profiles
   - `profileId`: Reference to user profile
   - `appScope`: Application scope where role applies
   - `role`: Reference to the assigned role

## API Commands

### Permission Commands
- `Create:Permission` - Create a new permission
- `Get:Permission` - Get a permission by ID
- `GetAll:Permission` - Get all permissions
- `Update:Permission` - Update a permission
- `Delete:Permission` - Delete a permission

### Role Commands
- `Create:Role` - Create a new role
- `Get:Role` - Get a role by ID
- `GetAll:Role` - Get all roles
- `Update:Role` - Update a role
- `Delete:Role` - Delete a role
- `AddPermission:Role` - Add a permission to a role
- `RemovePermission:Role` - Remove a permission from a role
- `Assign:Role` - Assign a role to a user profile
- `Unassign:Role` - Unassign a role from a user profile
- `GetUserRoles:Role` - Get all roles assigned to a user profile
- `CheckPermission:Role` - Check if a user has a specific permission

## Usage

### Checking Permissions

```typescript
const hasPermission = await permissionsService.send(
  { cmd: RoleCommands.CheckPermission },
  {
    profileId: 'user-profile-id',
    permission: 'posts:write',
    appScope: 'forgeofwill',
    targetId: 'optional-item-id'
  }
);
```

### Assigning a Role

```typescript
await permissionsService.send(
  { cmd: RoleCommands.Assign },
  {
    roleId: 'role-id',
    profileId: 'user-profile-id',
    appScope: 'forgeofwill'
  }
);
```

## Configuration

The service listens on port 3012 by default and connects to the `ot_permissions` PostgreSQL database.

Configuration is loaded from `src/assets/config.yaml`:

```yaml
listenPort: 3012
database:
  host: db
  port: 5432
  username: postgres
  password: postgres
  database: ot_permissions
```

## Guards and Decorators

The permissions service provides guards and decorators that can be used in gateway controllers to enforce permissions:

### @RequirePermissions Decorator

Use this decorator on controller methods to require specific permissions:

```typescript
@RequirePermissions('posts:write')
@Post()
async createPost(@User() user: UserDetails, @Body() dto: CreatePostDto) {
  // Only users with posts:write permission can access this
  // The guard automatically checks across all app scopes the user has access to
}
```

### PermissionsGuard

The guard automatically checks permissions based on the `@RequirePermissions` decorator. It queries the permissions service to determine which app scopes and roles the user has, then verifies the required permissions across all accessible scopes.

## Database Migrations

Generate a new migration:
```bash
nx run permissions:typeorm:migration:generate --name=migration-name
```

Run migrations:
```bash
nx run permissions:typeorm:migration:run
```

Revert last migration:
```bash
nx run permissions:typeorm:migration:revert
```

## Integration with Profile Service

The permissions service relies on the profile service for user profile management. The `profileId` field in `RoleAssignment` should correspond to profile IDs from the profile service.

## Application Scopes

Application scopes define where permissions apply. Common scopes include:
- `global` - Applies across all applications
- `forgeofwill` - Specific to Forge of Will application
- `client-interface` - Specific to main client interface
- `digital-homestead` - Specific to Digital Homestead application
- `christopherrutherford-net` - Specific to personal website

## Future Enhancements

- Dynamic permission attachment
- Permission inheritance
- Time-limited permissions
- Permission audit logging
- Role templates

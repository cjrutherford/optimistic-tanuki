# Permissions System - Implementation Summary

This document summarizes the permissions system that has been added to the Optimistic Tanuki platform.

## What Was Added

A comprehensive permissions system has been implemented as a new microservice that enables fine-grained access control across all applications in the stack.

## Quick Start

### Using Permissions in Your Code

```typescript
import { RequirePermissions } from '../../decorators/permissions.decorator';
import { PermissionsGuard } from '../../guards/permissions.guard';

@Controller('your-resource')
@UseGuards(AuthGuard, PermissionsGuard)
export class YourController {
  
  @Post()
  @RequirePermissions('your-app:resource:create')
  async create(@Body() dto: CreateDto) {
    // Only users with the permission can access this
    // Requires X-ot-appscope header specifying the target app scope
  }
}
```

**Required Header**: All protected endpoints require `X-ot-appscope` header with the app scope name (e.g., `forgeofwill`, `global`).

### API Endpoints

All available via the gateway at `http://localhost:3000/permissions`:

- **Permissions**: `/permission` (POST, GET, PUT, DELETE)
- **Roles**: `/role` (POST, GET, PUT, DELETE)
- **Role-Permission**: `/role/{roleId}/permission/{permissionId}` (POST, DELETE)
- **Assignments**: `/assignment` (POST, DELETE)
- **User Roles**: `/user-roles/{profileId}` (GET)
- **Check Permission**: `/check-permission` (POST)

## Key Concepts

### Permission
Defines what action can be performed on a resource:
- **name**: Unique identifier (e.g., "blog:posts:write")
- **resource**: What the permission applies to
- **action**: What can be done (read, write, delete, etc.)
- **targetId**: (Optional) For item-level permissions

### Role
Groups permissions together:
- **name**: Role identifier (e.g., "blogger", "admin")
- **description**: Human-readable description
- **appScope**: Where the role applies (global, forgeofwill, etc.)
- **permissions**: Collection of permissions

### Role Assignment
Links a role to a user profile:
- **roleId**: The role being assigned
- **profileId**: The user's profile ID
- **appScope**: Where this assignment applies

## Service Details

- **Port**: 3012 (TCP microservice)
- **Database**: ot_permissions (PostgreSQL)
- **Transport**: TCP (internal microservice communication)
- **API**: REST via gateway

## Integration Points

### Gateway
The gateway exposes all permissions endpoints via REST API and includes the PermissionsGuard for protecting routes.

### Profile Service
Role assignments reference profiles maintained by the profile service via profileId.

### Constants Library
New command constants exported:
- `PermissionCommands`
- `RoleCommands`

### Models Library
New DTOs exported:
- `CreatePermissionDto`, `UpdatePermissionDto`, `PermissionDto`
- `CreateRoleDto`, `UpdateRoleDto`, `AssignRoleDto`, `RoleDto`, `RoleAssignmentDto`

## Documentation

Detailed documentation available in `apps/permissions/`:

1. **[README.md](apps/permissions/README.md)** - Architecture, features, and API reference
2. **[USAGE.md](apps/permissions/USAGE.md)** - Code examples and best practices
3. **[DEPLOYMENT.md](apps/permissions/DEPLOYMENT.md)** - Deployment and troubleshooting

## Application Scopes

Common application scopes used in the platform:

- `global` - Applies across all applications
- `forgeofwill` - Forge of Will application
- `client-interface` - Main client interface
- `digital-homestead` - Digital Homestead application
- `christopherrutherford-net` - Personal website
- `blogging` - Blogging platform

## Example Use Cases

### Blog Permissions
```typescript
// Create permissions for blog
POST /permissions/permission
{
  "name": "blog:posts:write",
  "description": "Create and edit blog posts",
  "resource": "blog_posts",
  "action": "write"
}

// Create blogger role
POST /permissions/role
{
  "name": "blogger",
  "description": "Can write blog posts",
  "appScope": "forgeofwill"
}

// Assign to user
POST /permissions/assignment
{
  "roleId": "{role-id}",
  "profileId": "{user-profile-id}",
  "appScope": "forgeofwill"
}
```

### Protecting Endpoints
```typescript
@Post('posts')
@RequirePermissions('blog:posts:write')
async createPost(@Body() dto: CreatePostDto) {
  return this.blogService.createPost(dto);
}
```

## Database Schema

The permissions database includes:
- `permission` - Stores all permissions
- `role` - Stores all roles
- `role_assignment` - Links roles to profiles
- `role_permissions` - Many-to-many join table

## Running the System

### Development
```bash
npm run build
npm run docker:dev
```

### Production
```bash
npm run build
docker-compose up -d
```

The permissions service will:
1. Start on port 3012
2. Create the ot_permissions database
3. Run migrations automatically
4. Register with the gateway

## Migrating Existing Code

To migrate existing authorization logic:

1. **Identify** protected resources and actions
2. **Create** corresponding permissions
3. **Create** roles that group related permissions
4. **Assign** roles to users based on current access
5. **Update** controllers to use `@RequirePermissions`
6. **Remove** old authorization code
7. **Test** thoroughly

## Best Practices

1. Use descriptive permission names following the pattern: `{app}:{resource}:{action}`
2. Create roles for common use cases rather than assigning individual permissions
3. Use appropriate app scopes to limit permission blast radius
4. Document all custom permissions in your application
5. Regular audit role assignments
6. Follow principle of least privilege

## Support & Resources

- **Issues**: Check service logs with `docker logs ot_permissions`
- **Database**: Connect with `docker exec -it db psql -U postgres -d ot_permissions`
- **Testing**: See DEPLOYMENT.md for test procedures
- **Examples**: See USAGE.md for code examples

## Architecture Diagram

```
┌─────────────┐
│   Gateway   │ ← REST API
│   (3000)    │
└──────┬──────┘
       │ TCP
       ▼
┌─────────────┐      ┌──────────────┐
│ Permissions │ ───► │  PostgreSQL  │
│  Service    │      │ot_permissions│
│   (3012)    │      └──────────────┘
└─────────────┘
       │ References
       ▼
┌─────────────┐
│   Profile   │
│  Service    │
└─────────────┘
```

## Files Modified/Created

### New Service Files (apps/permissions/)
- Entities, DTOs, Services, Controllers
- Configuration, migrations, Dockerfile
- README, USAGE, DEPLOYMENT docs

### Modified Files
- `apps/gateway/` - Added controller, guard, decorator
- `libs/constants/` - Added permission commands
- `libs/models/` - Added permission DTOs
- `docker-compose.yaml` - Added permissions service
- `package.json` - Updated build scripts
- `setup-and-migrate.sh` - Added permissions DB

## Version Information

- Node.js: 18+
- NestJS: 10.x
- TypeORM: 0.3.x
- PostgreSQL: Latest

## Next Steps

1. Review documentation in `apps/permissions/`
2. Deploy the service using docker-compose
3. Create initial roles and permissions for your use case
4. Start protecting endpoints with `@RequirePermissions`
5. Migrate existing authorization logic

## Questions?

Refer to the detailed documentation:
- [Architecture](apps/permissions/README.md)
- [Usage Examples](apps/permissions/USAGE.md)
- [Deployment](apps/permissions/DEPLOYMENT.md)

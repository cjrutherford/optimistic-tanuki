# Permissions System Deployment Guide

This guide covers deploying and testing the permissions system.

## Prerequisites

- Docker and Docker Compose installed
- Node.js 18+ and npm installed
- PostgreSQL client tools (for manual database operations)

## Deployment Steps

### 1. Build All Services

```bash
npm install --legacy-peer-deps
npm run build
```

This builds all services including the new permissions service.

### 2. Start with Docker Compose

For development:
```bash
npm run docker:dev
```

For production:
```bash
npm run docker:up
```

The permissions service will:
- Start on port 3012
- Connect to PostgreSQL database `ot_permissions`
- Run migrations automatically via db-setup service
- Register with the gateway

### 3. Verify Service is Running

Check Docker logs:
```bash
docker logs ot_permissions
```

Expected output:
```
Microservice is listening On Port: 3012
```

Check service health via gateway:
```bash
curl http://localhost:3000/permissions/role
```

## Testing the Permissions System

### Test 1: Create a Permission

```bash
curl -X POST http://localhost:3000/permissions/permission \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "test:resource:read",
    "description": "Test read permission",
    "resource": "test_resource",
    "action": "read"
  }'
```

### Test 2: Create a Role

```bash
curl -X POST http://localhost:3000/permissions/role \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "test_role",
    "description": "Test role for development",
    "appScope": "global"
  }'
```

### Test 3: Add Permission to Role

```bash
curl -X POST http://localhost:3000/permissions/role/{roleId}/permission/{permissionId} \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test 4: Assign Role to User

```bash
curl -X POST http://localhost:3000/permissions/assignment \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "roleId": "YOUR_ROLE_ID",
    "profileId": "YOUR_PROFILE_ID",
    "appScope": "global"
  }'
```

### Test 5: Check Permission

```bash
curl -X POST http://localhost:3000/permissions/check-permission \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "permission": "test:resource:read",
    "appScope": "global"
  }'
```

Expected response: `true` or `false`

## Database Operations

### Connect to Database

```bash
docker exec -it db psql -U postgres -d ot_permissions
```

### Verify Tables Created

```sql
\dt
```

Expected tables:
- permission
- role
- role_assignment
- role_permissions
- migrations

### View Data

```sql
-- View all permissions
SELECT * FROM permission;

-- View all roles
SELECT * FROM role;

-- View role assignments
SELECT * FROM role_assignment;

-- View role-permission mappings
SELECT * FROM role_permissions;
```

## Troubleshooting

### Service Won't Start

Check logs:
```bash
docker logs ot_permissions
```

Common issues:
- Database connection: Verify `ot_permissions` database exists
- Port conflict: Ensure port 3012 is not in use
- Dependencies: Check that db-setup service completed successfully

### Migrations Failed

Manually run migrations:
```bash
cd apps/permissions
export POSTGRES_HOST=localhost
export POSTGRES_DB=ot_permissions
npx typeorm migration:run -d src/app/staticDatabase.ts
```

### Gateway Can't Connect

1. Verify permissions service is running: `docker ps | grep permissions`
2. Check gateway configuration: `apps/gateway/src/assets/config.yaml`
3. Ensure gateway has restarted after adding permissions service
4. Check gateway logs: `docker logs ot_gateway`

### Permission Checks Always Fail

1. Verify user has a profile in the profile service
2. Check role assignments: `GET /permissions/user-roles/{profileId}`
3. Verify permissions are added to the role
4. Check app scope matches between assignment and check

## Initial Setup Script

Create initial roles and permissions:

```typescript
// create-initial-permissions.ts
import axios from 'axios';

const API_BASE = 'http://localhost:3000/permissions';
const TOKEN = 'YOUR_AUTH_TOKEN';

async function setup() {
  const headers = { Authorization: `Bearer ${TOKEN}` };

  // Create permissions
  const readPerm = await axios.post(`${API_BASE}/permission`, {
    name: 'global:read',
    description: 'Read access',
    resource: 'all',
    action: 'read'
  }, { headers });

  const writePerm = await axios.post(`${API_BASE}/permission`, {
    name: 'global:write',
    description: 'Write access',
    resource: 'all',
    action: 'write'
  }, { headers });

  // Create roles
  const userRole = await axios.post(`${API_BASE}/role`, {
    name: 'user',
    description: 'Basic user',
    appScope: 'global'
  }, { headers });

  const adminRole = await axios.post(`${API_BASE}/role`, {
    name: 'admin',
    description: 'Administrator',
    appScope: 'global'
  }, { headers });

  // Add permissions to roles
  await axios.post(
    `${API_BASE}/role/${userRole.data.id}/permission/${readPerm.data.id}`,
    {},
    { headers }
  );

  await axios.post(
    `${API_BASE}/role/${adminRole.data.id}/permission/${readPerm.data.id}`,
    {},
    { headers }
  );

  await axios.post(
    `${API_BASE}/role/${adminRole.data.id}/permission/${writePerm.data.id}`,
    {},
    { headers }
  );

  console.log('Initial setup complete!');
}

setup().catch(console.error);
```

Run with:
```bash
npx ts-node create-initial-permissions.ts
```

## Monitoring

### Health Checks

Add this endpoint to monitor service health:

```typescript
@Get('/health')
async health() {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'permissions'
  };
}
```

### Logs

Monitor permissions service logs:
```bash
docker logs -f ot_permissions
```

Monitor all services:
```bash
docker-compose logs -f
```

## Production Considerations

1. **Environment Variables**: Set production database credentials
2. **Backups**: Regular backups of ot_permissions database
3. **Monitoring**: Set up logging and monitoring for permission checks
4. **Performance**: Consider caching for frequently checked permissions
5. **Audit**: Log all permission changes and role assignments
6. **Migration Strategy**: Plan for zero-downtime permission updates

## Next Steps

1. Create initial roles and permissions for your use cases
2. Integrate `@RequirePermissions` decorator in existing controllers
3. Migrate existing authorization logic to use permissions system
4. Set up permission auditing and monitoring
5. Create admin UI for managing permissions (optional)

## Support

For issues or questions:
- Check the README.md for architecture details
- Review USAGE.md for code examples
- Consult service logs for error messages
- Verify database schema matches migration

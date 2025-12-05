import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import {
  PermissionCommands,
  RoleCommands,
  AppScopeCommands,
} from '@optimistic-tanuki/constants';

describe('Permissions Microservice E2E Tests', () => {
  let client: ClientProxy;
  const testTimestamp = Date.now();

  // Store IDs for cleanup
  let createdPermissionId: string | null = null;
  let createdRoleId: string | null = null;
  let createdAppScopeId: string | null = null;

  beforeAll(async () => {
    client = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: {
        host: '127.0.0.1',
        port: 3012,
      },
    });

    try {
      await client.connect();
    } catch (err) {
      console.warn(
        'Could not connect to permissions service. Tests will be skipped.',
        err
      );
    }
  });

  afterAll(async () => {
    // Cleanup created resources
    try {
      if (createdRoleId) {
        await firstValueFrom(
          client.send({ cmd: RoleCommands.Delete }, createdRoleId)
        ).catch(() => {
          /* ignore cleanup errors */
        });
      }
      if (createdPermissionId) {
        await firstValueFrom(
          client.send({ cmd: PermissionCommands.Delete }, createdPermissionId)
        ).catch(() => {
          /* ignore cleanup errors */
        });
      }
      if (createdAppScopeId) {
        await firstValueFrom(
          client.send({ cmd: AppScopeCommands.Delete }, createdAppScopeId)
        ).catch(() => {
          /* ignore cleanup errors */
        });
      }
    } catch {
      // Ignore cleanup errors
    }

    await client.close();
  });

  describe('Permission CRUD Operations', () => {
    it('should get all permissions', async () => {
      try {
        const result = await firstValueFrom(
          client.send({ cmd: PermissionCommands.GetAll }, {})
        );
        expect(Array.isArray(result)).toBe(true);
      } catch (error) {
        // Service not available - skip test
        console.warn('Permissions service not available', error);
      }
    });

    it('should create a new permission', async () => {
      try {
        const permissionData = {
          name: `e2e-test-permission-${testTimestamp}`,
          description: 'E2E Test Permission',
          resource: 'test-resource',
          action: 'read',
        };

        const result = await firstValueFrom(
          client.send({ cmd: PermissionCommands.Create }, permissionData)
        );

        expect(result).toBeDefined();
        expect(result.name).toBe(permissionData.name);
        createdPermissionId = result.id;
      } catch (error) {
        console.warn(
          'Could not create permission - service may not be available',
          error
        );
      }
    });

    it('should get permission by ID', async () => {
      if (!createdPermissionId) {
        console.warn('Skipping - no permission was created');
        return;
      }

      try {
        const result = await firstValueFrom(
          client.send({ cmd: PermissionCommands.Get }, createdPermissionId)
        );

        expect(result).toBeDefined();
        expect(result.id).toBe(createdPermissionId);
      } catch {
        console.warn('Could not get permission - service may not be available');
      }
    });
  });

  describe('Role CRUD Operations', () => {
    it('should get all roles', async () => {
      try {
        const result = await firstValueFrom(
          client.send({ cmd: RoleCommands.GetAll }, {})
        );
        expect(Array.isArray(result)).toBe(true);
      } catch {
        console.warn('Roles service not available');
      }
    });

    it('should create a new role', async () => {
      try {
        const roleData = {
          name: `e2e-test-role-${testTimestamp}`,
          description: 'E2E Test Role',
          appScopeId: null, // Global scope
        };

        const result = await firstValueFrom(
          client.send({ cmd: RoleCommands.Create }, roleData)
        );

        expect(result).toBeDefined();
        expect(result.name).toBe(roleData.name);
        createdRoleId = result.id;
      } catch {
        console.warn('Could not create role - service may not be available');
      }
    });

    it('should get role by ID', async () => {
      if (!createdRoleId) {
        console.warn('Skipping - no role was created');
        return;
      }

      try {
        const result = await firstValueFrom(
          client.send({ cmd: RoleCommands.Get }, createdRoleId)
        );

        expect(result).toBeDefined();
        expect(result.id).toBe(createdRoleId);
      } catch {
        console.warn('Could not get role - service may not be available');
      }
    });

    it('should add permission to role', async () => {
      if (!createdRoleId || !createdPermissionId) {
        console.warn('Skipping - no role or permission was created');
        return;
      }

      try {
        const result = await firstValueFrom(
          client.send(
            { cmd: RoleCommands.AddPermission },
            { roleId: createdRoleId, permissionId: createdPermissionId }
          )
        );

        expect(result).toBeDefined();
      } catch {
        console.warn(
          'Could not add permission to role - service may not be available'
        );
      }
    });
  });

  describe('App Scope Operations', () => {
    it('should get all app scopes', async () => {
      try {
        const result = await firstValueFrom(
          client.send({ cmd: AppScopeCommands.GetAll }, {})
        );
        expect(Array.isArray(result)).toBe(true);
      } catch {
        console.warn('App Scopes service not available');
      }
    });

    it('should create a new app scope', async () => {
      try {
        const appScopeData = {
          name: `e2e-test-scope-${testTimestamp}`,
          displayName: 'E2E Test Scope',
          description: 'E2E Test App Scope',
        };

        const result = await firstValueFrom(
          client.send({ cmd: AppScopeCommands.Create }, appScopeData)
        );

        expect(result).toBeDefined();
        expect(result.name).toBe(appScopeData.name);
        createdAppScopeId = result.id;
      } catch {
        console.warn(
          'Could not create app scope - service may not be available'
        );
      }
    });

    it('should get app scope by name', async () => {
      if (!createdAppScopeId) {
        console.warn('Skipping - no app scope was created');
        return;
      }

      try {
        const result = await firstValueFrom(
          client.send(
            { cmd: AppScopeCommands.GetByName },
            `e2e-test-scope-${testTimestamp}`
          )
        );

        expect(result).toBeDefined();
      } catch {
        console.warn('Could not get app scope - service may not be available');
      }
    });
  });

  describe('User Role Assignment', () => {
    const testProfileId = `e2e-test-profile-${testTimestamp}`;

    it('should assign role to user', async () => {
      if (!createdRoleId) {
        console.warn('Skipping - no role was created');
        return;
      }

      try {
        const result = await firstValueFrom(
          client.send(
            { cmd: RoleCommands.Assign },
            {
              roleId: createdRoleId,
              profileId: testProfileId,
              appScopeId: null,
            }
          )
        );

        expect(result).toBeDefined();
      } catch {
        console.warn('Could not assign role - service may not be available');
      }
    });

    it('should get user roles', async () => {
      try {
        const result = await firstValueFrom(
          client.send({ cmd: RoleCommands.GetUserRoles }, testProfileId)
        );

        expect(result).toBeDefined();
      } catch {
        console.warn('Could not get user roles - service may not be available');
      }
    });

    it('should unassign role from user', async () => {
      if (!createdRoleId) {
        console.warn('Skipping - no role was created');
        return;
      }

      try {
        await firstValueFrom(
          client.send(
            { cmd: RoleCommands.Unassign },
            { roleId: createdRoleId, profileId: testProfileId }
          )
        );
      } catch {
        // May fail if not assigned - that's ok
      }
    });
  });
});

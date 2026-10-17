import { Logger } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { RoleInitService } from './role-init.service';
import { RoleInitBuilder } from './permission-builder';
import {
  AppScopeCommands,
  PermissionCommands,
  RoleCommands,
} from '@optimistic-tanuki/constants';

describe('RoleInitService', () => {
  it('attaches an existing permission by exact name and app scope', async () => {
    const permissionsClient = {
      send: jest
        .fn()
        .mockImplementation((pattern: { cmd: string }, payload: any) => {
          if (pattern.cmd === AppScopeCommands.GetByName) {
            return of({ id: 'scope-local-hub', name: payload.name });
          }
          if (pattern.cmd === PermissionCommands.Create) {
            return throwError(() => new Error('permission already exists'));
          }
          if (pattern.cmd === PermissionCommands.GetAll) {
            return of(
              payload.where.name === 'asset.create'
                ? [
                    {
                      id: 'permission-localhub-asset-create',
                      name: 'asset.create',
                      resource: 'asset',
                      action: 'create',
                      appScopeId: 'scope-local-hub',
                      targetId: null,
                    },
                  ]
                : []
            );
          }
          if (pattern.cmd === RoleCommands.Create) {
            return of({ id: 'role-local-hub-member', name: payload.name });
          }
          return of({ ok: true });
        }),
    };
    const service = new RoleInitService(permissionsClient as any);
    (service as any).logger = {
      log: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
    } as unknown as Logger;
    const options = new RoleInitBuilder()
      .setScopeName('local-hub')
      .setProfile('profile-1')
      .addAppScopeDefaults()
      .build();

    await service.processNow(options);

    expect(permissionsClient.send).toHaveBeenCalledWith(
      { cmd: PermissionCommands.Create },
      expect.objectContaining({
        name: 'asset.create',
        appScopeId: 'scope-local-hub',
      })
    );
    expect(permissionsClient.send).toHaveBeenCalledWith(
      { cmd: PermissionCommands.GetAll },
      {
        where: {
          name: 'asset.create',
          appScopeId: 'scope-local-hub',
        },
      }
    );
    expect(permissionsClient.send).toHaveBeenCalledWith(
      { cmd: RoleCommands.AddPermission },
      {
        roleId: 'role-local-hub-member',
        permissionId: 'permission-localhub-asset-create',
      }
    );
    expect(permissionsClient.send).not.toHaveBeenCalledWith(
      { cmd: RoleCommands.AddPermission },
      expect.objectContaining({ permissionName: expect.any(String) })
    );
  });

  it('does not initialize the configurable-client owner role in the app scope', () => {
    const options = new RoleInitBuilder()
      .setScopeName('configurable-client')
      .setProfile('profile-1')
      .addOwnerScopeDefaults()
      .build();

    expect(options.assignments).not.toContainEqual(
      expect.objectContaining({
        roleName: 'configurable_client_owner',
        profileId: 'profile-1',
      })
    );
  });

  it('creates a missing app scope before initializing permissions', async () => {
    const permissionsClient = {
      send: jest
        .fn()
        .mockImplementation((pattern: { cmd: string }, payload: any) => {
          if (pattern.cmd === AppScopeCommands.GetByName) {
            return throwError(
              () => new Error(`App scope missing: ${payload.name}`)
            );
          }

          if (pattern.cmd === AppScopeCommands.Create) {
            return of({ id: 'scope-leads', name: payload.name });
          }

          if (pattern.cmd === PermissionCommands.Create) {
            return of({ id: 'perm-1' });
          }

          return of(null);
        }),
    };

    const service = new RoleInitService(permissionsClient as any);
    (service as any).logger = {
      log: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
    } as unknown as Logger;

    await expect(
      service.processNow({
        scopeName: 'leads-app',
        scopeResourceId: 'profile-1',
        permissions: [
          {
            name: 'lead.read',
            resource: 'lead',
            action: 'read',
          },
        ],
        roles: [],
        assignments: [],
      })
    ).resolves.toBeUndefined();

    expect(permissionsClient.send).toHaveBeenCalledWith(
      { cmd: AppScopeCommands.Create },
      expect.objectContaining({
        name: 'leads-app',
      })
    );
    expect(permissionsClient.send).toHaveBeenCalledWith(
      { cmd: PermissionCommands.Create },
      expect.objectContaining({ name: 'lead.read', targetId: undefined })
    );
  });

  it('mirrors cross-scope assignments through the policy registry', async () => {
    const permissionsClient = {
      send: jest
        .fn()
        .mockImplementation((pattern: { cmd: string }, payload: any) => {
          if (pattern.cmd === AppScopeCommands.GetByName) {
            if (payload.name === 'client-interface') {
              return of({ id: 'scope-client' });
            }

            if (payload.name === 'social') {
              return of({ id: 'scope-social' });
            }
          }

          if (pattern.cmd === RoleCommands.GetByName) {
            return of({ id: 'role-community-owner', name: payload.name });
          }

          if (pattern.cmd === RoleCommands.Assign) {
            return of({ ok: true });
          }

          return of(null);
        }),
    };

    const service = new RoleInitService(permissionsClient as any);
    (service as any).logger = {
      log: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
    } as unknown as Logger;

    await service.processNow({
      scopeName: 'client-interface',
      assignments: [{ roleName: 'community_owner', profileId: 'profile-1' }],
    });

    expect(permissionsClient.send).toHaveBeenCalledWith(
      { cmd: RoleCommands.Assign },
      expect.objectContaining({
        roleId: 'role-community-owner',
        appScopeId: 'scope-social',
        profileId: 'profile-1',
      })
    );
  });
});

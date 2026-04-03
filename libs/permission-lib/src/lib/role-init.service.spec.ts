import { Logger } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { RoleInitService } from './role-init.service';
import { AppScopeCommands, PermissionCommands } from '@optimistic-tanuki/constants';

describe('RoleInitService', () => {
  it('creates a missing app scope before initializing permissions', async () => {
    const permissionsClient = {
      send: jest.fn().mockImplementation((pattern: { cmd: string }, payload: any) => {
        if (pattern.cmd === AppScopeCommands.GetByName) {
          return throwError(() => new Error(`App scope missing: ${payload.name}`));
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
    (service as any).logger = { log: jest.fn(), debug: jest.fn(), error: jest.fn() } as Logger;

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
  });
});

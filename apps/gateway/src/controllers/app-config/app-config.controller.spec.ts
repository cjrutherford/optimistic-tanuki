import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AuthGuard } from '../../auth/auth.guard';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { PERMISSIONS_KEY } from '../../decorators/permissions.decorator';
import { AppConfigCommands } from '@optimistic-tanuki/constants';
import { of } from 'rxjs';
import { AppConfigController } from './app-config.controller';

describe('Gateway AppConfigController metadata', () => {
  const controller = AppConfigController.prototype;

  function expectMutationGuarded(
    methodName: keyof AppConfigController,
    permission: string
  ) {
    const handler = controller[methodName] as unknown as Function;
    const guards = Reflect.getMetadata(GUARDS_METADATA, handler) ?? [];
    const requirement = Reflect.getMetadata(PERMISSIONS_KEY, handler);

    expect(guards).toEqual(
      expect.arrayContaining([AuthGuard, PermissionsGuard])
    );
    expect(requirement).toEqual({ permissions: [permission] });
  }

  it('protects app configuration mutations with explicit permissions', () => {
    expectMutationGuarded('createConfiguration', 'app-config.create');
    expectMutationGuarded('updateConfiguration', 'app-config.update');
    expectMutationGuarded('publishConfiguration', 'app-config.update');
    expectMutationGuarded('rollbackConfiguration', 'app-config.update');
    expectMutationGuarded('deleteConfiguration', 'app-config.delete');
  });

  it('forwards a manifest unchanged when updating a configuration', async () => {
    const client = {
      send: jest.fn().mockReturnValue(of({ id: 'config-1' })),
    };
    const appConfigController = new AppConfigController(
      { log: jest.fn() } as any,
      client as any
    );
    const manifest = {
      schemaVersion: 1 as const,
      surfaceType: 'business-site' as const,
      capabilities: { blogging: { enabled: true } },
    };

    await appConfigController.updateConfiguration(
      'config-1',
      { manifest },
      { userId: 'user-owner-a', profileId: 'profile-owner-a' } as any,
      'owner-console'
    );

    expect(client.send).toHaveBeenCalledWith(
      { cmd: AppConfigCommands.Update },
      {
        id: 'config-1',
        dto: { manifest },
        context: {
          ownerUserId: 'user-owner-a',
          ownerProfileId: 'profile-owner-a',
          appScope: 'owner-console',
        },
      }
    );
  });
});

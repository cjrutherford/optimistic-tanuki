import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AuthGuard } from '../../auth/auth.guard';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { PERMISSIONS_KEY } from '../../decorators/permissions.decorator';
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

    expect(guards).toEqual(expect.arrayContaining([AuthGuard, PermissionsGuard]));
    expect(requirement).toEqual({ permissions: [permission] });
  }

  it('protects app configuration mutations with explicit permissions', () => {
    expectMutationGuarded('createConfiguration', 'app-config.create');
    expectMutationGuarded('updateConfiguration', 'app-config.update');
    expectMutationGuarded('deleteConfiguration', 'app-config.delete');
  });
});

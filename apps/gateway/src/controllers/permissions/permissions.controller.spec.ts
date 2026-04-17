import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AuthGuard } from '../../auth/auth.guard';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { PERMISSIONS_KEY } from '../../decorators/permissions.decorator';
import { PermissionsController } from './permissions.controller';

describe('Gateway PermissionsController metadata', () => {
  const controller = PermissionsController.prototype;

  function expectMutationGuarded(
    methodName: keyof PermissionsController,
    permission: string
  ) {
    const handler = controller[methodName] as unknown as Function;
    const guards = Reflect.getMetadata(GUARDS_METADATA, handler) ?? [];
    const requirement = Reflect.getMetadata(PERMISSIONS_KEY, handler);

    expect(guards).toEqual(expect.arrayContaining([AuthGuard, PermissionsGuard]));
    expect(requirement).toEqual({ permissions: [permission] });
  }

  it('protects governance mutations with explicit permissions', () => {
    expectMutationGuarded('createAppScope', 'appscopes.create');
    expectMutationGuarded('updateAppScope', 'appscopes.update');
    expectMutationGuarded('deleteAppScope', 'appscopes.delete');
    expectMutationGuarded('createPermission', 'permissions.create');
    expectMutationGuarded('updatePermission', 'permissions.update');
    expectMutationGuarded('deletePermission', 'permissions.delete');
    expectMutationGuarded('createRole', 'roles.create');
    expectMutationGuarded('updateRole', 'roles.update');
    expectMutationGuarded('deleteRole', 'roles.delete');
    expectMutationGuarded('addPermissionToRole', 'roles.update');
    expectMutationGuarded('removePermissionFromRole', 'roles.update');
    expectMutationGuarded('assignRole', 'users.update');
    expectMutationGuarded('unassignRole', 'users.update');
  });
});

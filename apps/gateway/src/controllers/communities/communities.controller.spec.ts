import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AuthGuard } from '../../auth/auth.guard';
import { PermissionsGuard } from '../../guards/permissions.guard';
import {
  PERMISSIONS_KEY,
  PERMISSION_TARGET_KEY,
} from '../../decorators/permissions.decorator';
import { CommunitiesController } from './communities.controller';

describe('Gateway CommunitiesController metadata', () => {
  const controller = CommunitiesController.prototype;

  function expectMutationGuarded(
    methodName: keyof CommunitiesController,
    permission: string,
    targetRequirement?: { source: string; path: string }
  ) {
    const handler = controller[methodName] as unknown as Function;
    const guards = Reflect.getMetadata(GUARDS_METADATA, handler) ?? [];
    const requirement = Reflect.getMetadata(PERMISSIONS_KEY, handler);
    const target = Reflect.getMetadata(PERMISSION_TARGET_KEY, handler);

    expect(guards).toEqual(
      expect.arrayContaining([AuthGuard, PermissionsGuard])
    );
    expect(requirement).toEqual({ permissions: [permission] });

    if (targetRequirement) {
      expect(target).toEqual(targetRequirement);
    }
  }

  it('leaves shared community mutations on auth-only guards', () => {
    const sharedHandlers: Array<keyof CommunitiesController> = [
      'createCommunity',
      'updateCommunity',
      'deleteCommunity',
      'inviteMember',
      'updateMemberRole',
      'removeMember',
    ];

    for (const methodName of sharedHandlers) {
      const handler = controller[methodName] as unknown as Function;
      const guards = Reflect.getMetadata(GUARDS_METADATA, handler) ?? [];
      const requirement = Reflect.getMetadata(PERMISSIONS_KEY, handler);

      expect(guards).toEqual(expect.arrayContaining([AuthGuard]));
      expect(guards).not.toEqual(expect.arrayContaining([PermissionsGuard]));
      expect(requirement).toBeUndefined();
    }
  });

  it('protects manager appointment with explicit governance permissions', () => {
    expectMutationGuarded('appointManager', 'community.manage');
  });
});

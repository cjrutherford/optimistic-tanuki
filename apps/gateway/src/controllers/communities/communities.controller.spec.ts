import { GUARDS_METADATA } from '@nestjs/common/constants';
import { of } from 'rxjs';
import { ClientProxy } from '@nestjs/microservices';
import { CommunityCommands } from '@optimistic-tanuki/constants';
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

  it('protects shared community mutations with explicit permissions', () => {
    expectMutationGuarded('createCommunity', 'community.create');
    expectMutationGuarded('updateCommunity', 'community.update');
    expectMutationGuarded('deleteCommunity', 'community.delete');
    expectMutationGuarded('inviteMember', 'community.invite');
    expectMutationGuarded('updateMemberRole', 'community.manage');
    expectMutationGuarded('removeMember', 'community.member.remove');
  });

  it('protects manager appointment with explicit governance permissions', () => {
    expectMutationGuarded('appointManager', 'community.manage');
  });
});

describe('CommunitiesController#getMyCommunities', () => {
  let socialClient: jest.Mocked<ClientProxy>;
  let controller: CommunitiesController;

  beforeEach(() => {
    socialClient = {
      send: jest.fn().mockReturnValue(of([])),
    } as unknown as jest.Mocked<ClientProxy>;
    const permissionsClient = {} as ClientProxy;
    controller = new CommunitiesController(socialClient, permissionsClient);
  });

  it('forwards the guard-verified userId when a valid token is present', async () => {
    const req = { user: { userId: 'user-9' } };

    await controller.getMyCommunities(req);

    expect(socialClient.send).toHaveBeenCalledWith(
      { cmd: CommunityCommands.GET_USER_COMMUNITIES },
      { userId: 'user-9' }
    );
  });

  it('returns no communities and never calls the service for an anonymous or forged-token request', async () => {
    const result = await controller.getMyCommunities({});

    expect(result).toEqual([]);
    expect(socialClient.send).not.toHaveBeenCalled();
  });
});

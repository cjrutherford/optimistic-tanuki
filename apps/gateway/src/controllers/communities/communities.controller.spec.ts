import { GUARDS_METADATA } from '@nestjs/common/constants';
import { of } from 'rxjs';
import { ClientProxy } from '@nestjs/microservices';
import {
  AppScopeCommands,
  CommunityCommands,
  RoleCommands,
  WorkspaceCommands,
} from '@optimistic-tanuki/constants';
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
    controller = new CommunitiesController(
      socialClient,
      permissionsClient,
      {} as ClientProxy
    );
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

describe('CommunitiesController manager authority', () => {
  let socialClient: jest.Mocked<ClientProxy>;
  let permissionsClient: jest.Mocked<ClientProxy>;
  let controller: CommunitiesController;

  beforeEach(() => {
    socialClient = {
      send: jest.fn((pattern: any) => {
        if (pattern?.cmd === CommunityCommands.GET_MEMBERS) {
          return of([
            {
              userId: 'manager-user-1',
              profileId: 'manager-profile-1',
            },
          ]);
        }

        return of({ id: 'community-1' });
      }),
    } as unknown as jest.Mocked<ClientProxy>;
    permissionsClient = {
      send: jest.fn((pattern: any) => {
        if (pattern?.cmd === AppScopeCommands.GetByName) {
          return of({ id: 'community-workspace-scope' });
        }
        if (pattern?.cmd === RoleCommands.GetByName) {
          return of({ id: 'manager-role' });
        }

        return of(undefined);
      }),
    } as unknown as jest.Mocked<ClientProxy>;
    controller = new CommunitiesController(socialClient, permissionsClient, {
      send: jest
        .fn()
        .mockReturnValue(
          of({ workspaceId: '00000000-0000-4000-8000-000000000001' })
        ),
    } as unknown as ClientProxy);
  });

  it('keeps Owner Console manager appointment aligned across role and Social authority', async () => {
    await (controller.appointManager as any)(
      'community-1',
      { userId: 'forged-user', profileId: 'manager-profile-1' },
      { userId: 'owner-user-1', profileId: 'owner-profile-1' } as any,
      'owner-console'
    );

    expect(permissionsClient.send).toHaveBeenCalledWith(
      { cmd: RoleCommands.GetByName },
      { name: 'community_manager', appScope: 'community' }
    );

    expect(permissionsClient.send).toHaveBeenCalledWith(
      { cmd: RoleCommands.Assign },
      expect.objectContaining({
        roleId: 'manager-role',
        profileId: 'manager-profile-1',
        appScopeId: 'community-workspace-scope',
        targetId: 'community-1',
      })
    );
    expect(socialClient.send).toHaveBeenLastCalledWith(
      { cmd: CommunityCommands.APPOINT_MANAGER },
      {
        communityId: 'community-1',
        userId: 'manager-user-1',
        profileId: 'manager-profile-1',
      }
    );
  });

  it('keeps Owner Console manager revocation aligned across role and Social authority', async () => {
    socialClient.send.mockImplementation((pattern: any) => {
      if (pattern?.cmd === CommunityCommands.GET_MANAGER) {
        return of({
          userId: 'manager-user-1',
          profileId: 'manager-profile-1',
        }) as any;
      }

      return of({ id: 'community-1', managerProfileId: null }) as any;
    });

    await (controller.revokeManager as any)('community-1', 'owner-console');

    expect(permissionsClient.send).toHaveBeenCalledWith(
      { cmd: 'Unassign:Role:ByTarget' },
      expect.objectContaining({
        roleId: 'manager-role',
        profileId: 'manager-profile-1',
        targetId: 'community-1',
      })
    );
    expect(socialClient.send).toHaveBeenLastCalledWith(
      { cmd: CommunityCommands.REVOKE_MANAGER },
      { communityId: 'community-1' }
    );
  });
});

describe('CommunitiesController workspace ownership', () => {
  it('assigns the community owner role from the community product scope into its child workspace scope', async () => {
    const socialClient = {} as ClientProxy;
    const workspaceClient = {
      send: jest.fn((command: string) => {
        if (command === WorkspaceCommands.REGISTER) {
          return of({ workspaceId: '00000000-0000-4000-8000-000000000001' });
        }
        return of({
          workspaceId: '00000000-0000-4000-8000-000000000001',
          status: 'active',
        });
      }),
    } as unknown as jest.Mocked<ClientProxy>;
    const permissionsClient = {
      send: jest.fn((pattern: { cmd: string }) => {
        if (pattern.cmd === AppScopeCommands.GetByName) {
          return of({ id: 'child-scope-1' });
        }
        if (pattern.cmd === RoleCommands.GetByName) {
          return of({ id: 'community-owner-role' });
        }
        return of({ id: 'assignment-1' });
      }),
    } as unknown as jest.Mocked<ClientProxy>;
    const controller = new CommunitiesController(
      socialClient,
      permissionsClient,
      workspaceClient
    );

    await (controller as any).provisionCommunityWorkspace(
      { id: 'community-1', slug: 'north-star', name: 'North Star' },
      { userId: 'user-1', profileId: 'profile-1' },
      'client-interface'
    );

    expect(permissionsClient.send).toHaveBeenCalledWith(
      { cmd: RoleCommands.GetByName },
      { name: 'community_owner', appScope: 'community' }
    );
  });
});

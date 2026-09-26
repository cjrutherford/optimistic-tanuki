import { of, throwError } from 'rxjs';
import { ClientProxy } from '@nestjs/microservices';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { WorkspaceContextGuard } from '../../../guards/workspace-context.guard';
import { AuthGuard } from '../../../auth/auth.guard';
import { PermissionsGuard } from '../../../guards/permissions.guard';
import { PERMISSIONS_KEY } from '../../../decorators/permissions.decorator';
import { WORKSPACE_CONTEXT_KEY } from '../../../decorators/workspace-context.decorator';
import {
  AppScopeCommands,
  CommunityCommands,
  RoleCommands,
} from '@optimistic-tanuki/constants';
import { CommunityController } from './community.controller';

describe('Social CommunityController membership lifecycle', () => {
  let socialClient: jest.Mocked<ClientProxy>;
  let permissionsClient: jest.Mocked<ClientProxy>;
  let authClient: jest.Mocked<ClientProxy>;
  let profileClient: jest.Mocked<ClientProxy>;
  let inviteMailer: { send: jest.Mock };
  let controller: CommunityController;

  beforeEach(() => {
    socialClient = {
      send: jest.fn().mockReturnValue(of([])),
    } as unknown as jest.Mocked<ClientProxy>;
    permissionsClient = {
      send: jest.fn((pattern: any) =>
        of(
          pattern?.cmd === AppScopeCommands.GetByName
            ? { id: 'community-workspace-scope' }
            : { id: 'manager-role' }
        )
      ),
    } as unknown as jest.Mocked<ClientProxy>;
    authClient = {
      send: jest.fn(),
    } as unknown as jest.Mocked<ClientProxy>;
    profileClient = {
      send: jest.fn().mockReturnValue(of(null)),
    } as unknown as jest.Mocked<ClientProxy>;
    inviteMailer = { send: jest.fn().mockResolvedValue(undefined) };
    controller = new CommunityController(
      socialClient,
      permissionsClient,
      {} as ClientProxy,
      {
        send: jest
          .fn()
          .mockReturnValue(
            of({ workspaceId: '00000000-0000-4000-8000-000000000001' })
          ),
      } as unknown as ClientProxy,
      authClient,
      profileClient,
      { provision: jest.fn().mockResolvedValue(undefined) } as any,
      inviteMailer as never
    );
  });

  it('synchronizes an appointed manager with Social after granting the scoped role', async () => {
    socialClient.send.mockImplementation((pattern: any) => {
      if (pattern?.cmd === CommunityCommands.GET_MEMBERS) {
        return of([
          {
            userId: 'manager-user-1',
            profileId: 'manager-profile-1',
          },
        ]) as any;
      }

      return of({
        id: 'community-1',
        managerProfileId: 'manager-profile-1',
      }) as any;
    });

    await controller.appointManager(
      'community-1',
      { profileId: 'manager-profile-1' },
      { userId: 'owner-user-1', profileId: 'owner-profile-1' } as any,
      'client-interface'
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

  it('rolls back the scoped role when Social cannot persist the appointment', async () => {
    socialClient.send.mockImplementation((pattern: any) => {
      if (pattern?.cmd === CommunityCommands.GET_MEMBERS) {
        return of([
          {
            userId: 'manager-user-1',
            profileId: 'manager-profile-1',
          },
        ]) as any;
      }

      return throwError(() => new Error('Social is unavailable')) as any;
    });

    await expect(
      controller.appointManager(
        'community-1',
        { profileId: 'manager-profile-1' },
        { userId: 'owner-user-1', profileId: 'owner-profile-1' } as any,
        'client-interface'
      )
    ).rejects.toThrow('Social is unavailable');

    expect(permissionsClient.send).toHaveBeenCalledWith(
      { cmd: 'Unassign:Role:ByTarget' },
      expect.objectContaining({
        profileId: 'manager-profile-1',
        roleId: 'manager-role',
        targetId: 'community-1',
      })
    );
  });

  it('clears Social manager authority when the scoped manager role is revoked', async () => {
    await controller.revokeManager(
      'community-1',
      'manager-profile-1',
      { userId: 'owner-user-1', profileId: 'owner-profile-1' } as any,
      'client-interface'
    );

    expect(socialClient.send).toHaveBeenCalledWith(
      { cmd: CommunityCommands.REVOKE_MANAGER },
      { communityId: 'community-1' }
    );
  });

  it('restores the scoped manager role when Social cannot persist revocation', async () => {
    socialClient.send.mockImplementation((pattern: any) => {
      if (pattern?.cmd === CommunityCommands.REVOKE_MANAGER) {
        return throwError(() => new Error('Social is unavailable')) as any;
      }

      return of([]) as any;
    });

    await expect(
      controller.revokeManager(
        'community-1',
        'manager-profile-1',
        { userId: 'owner-user-1', profileId: 'owner-profile-1' } as any,
        'client-interface'
      )
    ).rejects.toThrow('Social is unavailable');

    expect(permissionsClient.send).toHaveBeenCalledWith(
      { cmd: RoleCommands.Assign },
      expect.objectContaining({
        roleId: 'manager-role',
        profileId: 'manager-profile-1',
        targetId: 'community-1',
      })
    );
  });

  it('exposes owner-visible membership audit through the Social command boundary', async () => {
    const audit = [{ workspaceId: 'community-1', action: 'revoke' }];
    socialClient.send.mockReturnValueOnce(of(audit) as any);
    const request = {
      workspaceContext: {
        workspace: { workspaceId: 'community-1', appScope: 'client-interface' },
      },
    };

    await expect(
      controller.getMembershipAudit(
        'member-1',
        { userId: 'owner-1' } as any,
        request
      )
    ).resolves.toEqual(audit);
    expect(socialClient.send).toHaveBeenCalledWith(
      { cmd: 'GET_COMMUNITY_MEMBERSHIP_AUDIT' },
      {
        memberId: 'member-1',
        requesterId: 'owner-1',
        workspaceContext: request.workspaceContext,
      }
    );
  });

  it('forwards moderator suspension and reactivation commands', async () => {
    await controller.suspendMember(
      'member-1',
      { userId: 'moderator-1' } as any,
      { workspaceContext: { workspace: { workspaceId: 'community-1' } } }
    );
    await controller.reactivateMember(
      'member-1',
      { userId: 'moderator-1' } as any,
      { workspaceContext: { workspace: { workspaceId: 'community-1' } } }
    );

    expect(socialClient.send).toHaveBeenNthCalledWith(
      1,
      { cmd: 'SUSPEND_COMMUNITY_MEMBER' },
      {
        memberId: 'member-1',
        suspenderId: 'moderator-1',
        workspaceContext: { workspace: { workspaceId: 'community-1' } },
      }
    );
    expect(socialClient.send).toHaveBeenNthCalledWith(
      2,
      { cmd: 'REACTIVATE_COMMUNITY_MEMBER' },
      {
        memberId: 'member-1',
        reactivatorId: 'moderator-1',
        workspaceContext: { workspace: { workspaceId: 'community-1' } },
      }
    );
  });

  it.each(['getMembershipAudit', 'suspendMember', 'reactivateMember'])(
    'protects %s with workspace and community.manage enforcement',
    (methodName) => {
      const method = (CommunityController.prototype as any)[methodName];
      const guards = Reflect.getMetadata(GUARDS_METADATA, method) ?? [];

      expect(guards).toEqual(
        expect.arrayContaining([
          AuthGuard,
          WorkspaceContextGuard,
          PermissionsGuard,
        ])
      );
      expect(Reflect.getMetadata(PERMISSIONS_KEY, method)).toEqual({
        permissions: ['community.manage'],
      });
      expect(Reflect.getMetadata(WORKSPACE_CONTEXT_KEY, method)).toEqual({
        kind: 'community',
        source: 'params',
        path: 'memberId',
        sourceService: 'social',
        resource: 'member',
        strict: true,
      });
    }
  );

  describe('email invitations', () => {
    const user = {
      userId: 'admin-1',
      profileId: 'profile-admin-1',
    } as any;

    beforeEach(() => {
      authClient.send.mockReturnValue(
        throwError(() => new Error('User not found'))
      );
      socialClient.send.mockImplementation((pattern: any) => {
        if (pattern?.cmd === CommunityCommands.INVITE_BY_EMAIL) {
          return of({
            id: 'invite-1',
            communityId: 'community-1',
            inviterId: 'admin-1',
            inviteeId: null,
            inviteeEmail: 'guest@example.com',
            status: 'pending',
            token: 'secret-token',
          });
        }
        if (pattern?.cmd === CommunityCommands.FIND) {
          return of({
            id: 'community-1',
            name: 'Savannah Gardeners',
            appScope: 'social',
          });
        }
        return of(null);
      });
    });

    it('creates a token invite, sends the courtesy mail, and strips the token', async () => {
      const result = await controller.inviteByEmail(
        'community-1',
        user,
        { communityId: 'community-1', email: ' Guest@Example.com ' } as any,
        'social'
      );

      expect(socialClient.send).toHaveBeenCalledWith(
        { cmd: CommunityCommands.INVITE_BY_EMAIL },
        {
          dto: {
            communityId: 'community-1',
            email: 'guest@example.com',
            inviteeUserId: undefined,
          },
          inviterId: 'admin-1',
        }
      );
      expect(inviteMailer.send).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'guest@example.com',
          token: 'secret-token',
          communityName: 'Savannah Gardeners',
        })
      );
      expect(result).not.toHaveProperty('token');
      expect(result).toEqual(
        expect.objectContaining({ inviteeEmail: 'guest@example.com' })
      );
    });

    it('attaches a known user id when the email resolves', async () => {
      authClient.send.mockReturnValue(of('user-2'));

      await controller.inviteByEmail(
        'community-1',
        user,
        { communityId: 'community-1', email: 'member@example.com' } as any,
        'social'
      );

      expect(socialClient.send).toHaveBeenCalledWith(
        { cmd: CommunityCommands.INVITE_BY_EMAIL },
        expect.objectContaining({
          dto: expect.objectContaining({ inviteeUserId: 'user-2' }),
        })
      );
    });

    it('relies on the mailer never-throwing contract for the courtesy send', async () => {
      // CommunityInviteMailer.send never rejects (covered by its own spec);
      // the controller awaits it directly, exactly like ProjectInviteMailer.
      inviteMailer.send.mockResolvedValueOnce(undefined);

      const result = await controller.inviteByEmail(
        'community-1',
        user,
        { communityId: 'community-1', email: 'guest@example.com' } as any,
        'social'
      );

      expect(inviteMailer.send).toHaveBeenCalled();
      expect(result).not.toHaveProperty('token');
    });

    it('returns a preview or 404 for invitation tokens', async () => {
      socialClient.send.mockReturnValue(
        of({ communityId: 'community-1', communityName: 'Savannah' })
      );
      await expect(controller.previewInviteByToken('tok')).resolves.toEqual(
        expect.objectContaining({ communityId: 'community-1' })
      );

      socialClient.send.mockReturnValue(of(null));
      await expect(controller.previewInviteByToken('bad')).rejects.toThrow(
        'Invitation not found or expired'
      );
    });

    it('claims an invitation into a community', async () => {
      socialClient.send.mockReturnValue(
        of({
          invite: { id: 'invite-1' },
          community: { id: 'community-1', slug: 'savannah' },
        })
      );

      await expect(
        controller.claimInviteByToken(user, { token: 'tok' })
      ).resolves.toEqual({ id: 'community-1', slug: 'savannah' });
      expect(socialClient.send).toHaveBeenCalledWith(
        { cmd: CommunityCommands.ACCEPT_INVITE_BY_TOKEN },
        { token: 'tok', userId: 'admin-1', profileId: 'profile-admin-1' }
      );
    });
  });
});

import { of, throwError } from 'rxjs';
import { ClientProxy } from '@nestjs/microservices';
import {
  AppScopeCommands,
  CommunityCommands,
  RoleCommands,
} from '@optimistic-tanuki/constants';
import { CommunityMembershipStatus } from '@optimistic-tanuki/models';
import { CommunitiesController } from './communities.controller';

/**
 * The spec beside this one asserts the guard/permission metadata. These invoke
 * the handlers: what each sends to the social service, and which failures are
 * swallowed into an empty result versus rethrown.
 */
describe('Gateway CommunitiesController handlers', () => {
  let controller: CommunitiesController;
  let social: { send: jest.Mock };
  let permissions: { send: jest.Mock };
  let workspace: { send: jest.Mock };

  const user = { userId: 'user-1', profileId: 'profile-1' } as never;

  const sendResolves = (value: unknown) =>
    social.send.mockReturnValue(of(value));
  const sendRejects = () =>
    social.send.mockReturnValue(throwError(() => new Error('downstream')));

  const lastPayload = () => social.send.mock.calls.at(-1)?.[1];
  const lastPattern = () => social.send.mock.calls.at(-1)?.[0];

  beforeEach(() => {
    social = { send: jest.fn().mockReturnValue(of(null)) };
    permissions = {
      send: jest.fn((pattern: { cmd: string }) => {
        if (pattern.cmd === AppScopeCommands.GetByName) {
          return of({ id: 'workspace-scope-1' });
        }
        if (pattern.cmd === RoleCommands.GetByName) {
          return of({ id: 'community-owner-role-1' });
        }
        return of({ id: 'assignment-1' });
      }),
    };
    workspace = {
      send: jest.fn().mockReturnValue(
        of({
          workspaceId: '00000000-0000-4000-8000-000000000001',
          status: 'active',
        })
      ),
    };

    controller = new CommunitiesController(
      social as unknown as ClientProxy,
      permissions as unknown as ClientProxy,
      workspace as unknown as ClientProxy
    );

    // Silence the per-instance logger rather than the console.
    (
      controller as unknown as {
        logger: { debug: jest.Mock; error: jest.Mock; warn: jest.Mock };
      }
    ).logger = {
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    } as never;
  });

  afterEach(() => jest.restoreAllMocks());

  describe('listCommunities', () => {
    it('passes the caller app scope through', async () => {
      sendResolves([{ id: 'c-1' }]);

      const result = await controller.listCommunities('local-hub', 'city');

      expect(lastPattern()).toEqual({ cmd: CommunityCommands.LIST_LOCALITY });
      expect(lastPayload()).toEqual({
        appScope: 'local-hub',
        localityType: 'city',
      });
      expect(result).toEqual([{ id: 'c-1' }]);
    });

    it('drops the scope for the owner console so it sees every community', async () => {
      sendResolves([]);

      await controller.listCommunities('owner-console');

      expect(lastPayload()).toEqual({
        appScope: undefined,
        localityType: undefined,
      });
    });

    it('returns an empty list when the service fails', async () => {
      sendRejects();

      await expect(controller.listCommunities('local-hub')).resolves.toEqual(
        []
      );
    });
  });

  describe('getMyCommunities', () => {
    it('returns nothing for an anonymous caller without calling the service', async () => {
      const result = await controller.getMyCommunities({});

      expect(result).toEqual([]);
      expect(social.send).not.toHaveBeenCalled();
    });

    it('reads the user id from the guard-verified request', async () => {
      sendResolves([{ id: 'c-1' }]);

      const result = await controller.getMyCommunities({
        user: { userId: 'user-1' },
      });

      expect(lastPattern()).toEqual({
        cmd: CommunityCommands.GET_USER_COMMUNITIES,
      });
      expect(lastPayload()).toEqual({ userId: 'user-1' });
      expect(result).toEqual([{ id: 'c-1' }]);
    });

    it('returns an empty list when the service fails', async () => {
      sendRejects();

      await expect(
        controller.getMyCommunities({ user: { userId: 'user-1' } })
      ).resolves.toEqual([]);
    });
  });

  describe('reads that degrade to empty', () => {
    it('getSubCommunities returns an empty list on failure', async () => {
      sendResolves([{ id: 'sub-1' }]);
      await expect(controller.getSubCommunities('c-1')).resolves.toEqual([
        { id: 'sub-1' },
      ]);

      sendRejects();
      await expect(controller.getSubCommunities('c-1')).resolves.toEqual([]);
    });
  });

  describe('reads that degrade to null', () => {
    it('getCommunityManager falls back to null', async () => {
      sendResolves({ id: 'mgr-1' });
      await expect(controller.getCommunityManager('c-1')).resolves.toEqual({
        id: 'mgr-1',
      });

      sendRejects();
      await expect(controller.getCommunityManager('c-1')).resolves.toBeNull();
    });

    it('getCommunityElection falls back to null', async () => {
      sendResolves({ id: 'el-1' });
      await expect(controller.getCommunityElection('c-1')).resolves.toEqual({
        id: 'el-1',
      });

      sendRejects();
      await expect(controller.getCommunityElection('c-1')).resolves.toBeNull();
    });
  });

  describe('leaveCommunity', () => {
    it('sends the leave for the caller', async () => {
      sendResolves(undefined);

      await controller.leaveCommunity('c-1', user, 'local-hub');

      const leaveCall = social.send.mock.calls.find(
        (call) => call[0]?.cmd === CommunityCommands.LEAVE
      );
      expect(leaveCall?.[1]).toEqual({
        communityId: 'c-1',
        userId: 'user-1',
      });
    });
  });
});

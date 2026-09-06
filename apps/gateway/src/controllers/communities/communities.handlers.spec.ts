import { of, throwError } from 'rxjs';
import { ClientProxy } from '@nestjs/microservices';
import { CommunityCommands, RoleCommands } from '@optimistic-tanuki/constants';
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

  const user = { userId: 'user-1', profileId: 'profile-1' } as never;

  const sendResolves = (value: unknown) =>
    social.send.mockReturnValue(of(value));
  const sendRejects = () =>
    social.send.mockReturnValue(throwError(() => new Error('downstream')));

  const lastPayload = () => social.send.mock.calls.at(-1)?.[1];
  const lastPattern = () => social.send.mock.calls.at(-1)?.[0];

  beforeEach(() => {
    social = { send: jest.fn().mockReturnValue(of(null)) };
    permissions = { send: jest.fn().mockReturnValue(of(null)) };

    controller = new CommunitiesController(
      social as unknown as ClientProxy,
      permissions as unknown as ClientProxy
    );

    // Silence the per-instance logger rather than the console.
    (controller as unknown as { logger: { error: jest.Mock } }).logger = {
      error: jest.fn(),
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

  describe('createCommunity', () => {
    it('stamps the scope and owner onto the dto', async () => {
      sendResolves({ id: 'c-1' });

      await controller.createCommunity(
        { name: 'Savannah' } as never,
        user,
        'local-hub'
      );

      expect(lastPattern()).toEqual({ cmd: CommunityCommands.CREATE });
      expect(lastPayload()).toEqual({
        dto: {
          name: 'Savannah',
          appScope: 'local-hub',
          ownerId: 'user-1',
          ownerProfileId: 'profile-1',
        },
        userId: 'user-1',
      });
    });

    it('rethrows a failure rather than swallowing it', async () => {
      sendRejects();

      await expect(
        controller.createCommunity({ name: 'x' } as never, user, 'local-hub')
      ).rejects.toThrow('downstream');
    });
  });

  describe('reads by slug and id', () => {
    it('finds by slug', async () => {
      sendResolves({ id: 'c-1' });

      await controller.findCommunity('savannah-ga');

      expect(lastPattern()).toEqual({ cmd: CommunityCommands.FIND_BY_SLUG });
    });

    it('finds by id', async () => {
      sendResolves({ id: 'c-1' });

      await controller.getCommunity('c-1');

      expect(lastPattern()).toEqual({ cmd: CommunityCommands.FIND });
      expect(lastPayload()).toEqual({ id: 'c-1' });
    });
  });

  describe('mutations rethrow', () => {
    it('update sends the patch and rethrows on failure', async () => {
      sendResolves({ id: 'c-1' });
      await controller.updateCommunity('c-1', { name: 'New' } as never, user);
      expect(lastPattern()).toEqual({ cmd: CommunityCommands.UPDATE });

      sendRejects();
      await expect(
        controller.updateCommunity('c-1', {} as never, user)
      ).rejects.toThrow('downstream');
    });

    it('delete sends the id and rethrows on failure', async () => {
      sendResolves(undefined);
      await controller.deleteCommunity('c-1', user);
      expect(lastPattern()).toEqual({ cmd: CommunityCommands.DELETE });

      sendRejects();
      await expect(controller.deleteCommunity('c-1', user)).rejects.toThrow(
        'downstream'
      );
    });

    it('removeMember carries the community, member and actor', async () => {
      sendResolves(undefined);

      await controller.removeMember('c-1', 'member-1', user);

      expect(lastPattern()).toEqual({ cmd: CommunityCommands.REMOVE_MEMBER });
      expect(lastPayload()).toEqual({
        communityId: 'c-1',
        memberId: 'member-1',
        userId: 'user-1',
      });

      sendRejects();
      await expect(
        controller.removeMember('c-1', 'member-1', user)
      ).rejects.toThrow('downstream');
    });

    it('updateMemberRole carries the requested role', async () => {
      sendResolves(undefined);

      await controller.updateMemberRole(
        'c-1',
        'member-1',
        { role: 'moderator' } as never,
        user
      );

      expect(lastPayload()).toEqual({
        communityId: 'c-1',
        memberId: 'member-1',
        role: 'moderator',
        userId: 'user-1',
      });
    });

    it('inviteMember builds the invite dto', async () => {
      sendResolves({ id: 'invite-1' });

      await controller.inviteMember('c-1', { inviteeUserId: 'user-2' }, user);

      expect(lastPattern()).toEqual({ cmd: CommunityCommands.INVITE });
      expect(lastPayload()).toEqual({
        dto: { communityId: 'c-1', inviteeUserId: 'user-2' },
        userId: 'user-1',
      });

      sendRejects();
      await expect(
        controller.inviteMember('c-1', { inviteeUserId: 'user-2' }, user)
      ).rejects.toThrow('downstream');
    });
  });

  describe('reads that degrade to empty', () => {
    it('getMembers returns an empty list on failure', async () => {
      sendResolves([{ id: 'm-1' }]);
      await expect(controller.getMembers('c-1')).resolves.toEqual([
        { id: 'm-1' },
      ]);

      sendRejects();
      await expect(controller.getMembers('c-1')).resolves.toEqual([]);
    });

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

  describe('joinCommunity', () => {
    it('sends the join and returns the membership', async () => {
      sendResolves({ status: CommunityMembershipStatus.PENDING });

      const result = await controller.joinCommunity('c-1', user, 'local-hub');

      expect(lastPattern()).toEqual({ cmd: CommunityCommands.JOIN });
      expect(lastPayload()).toEqual({
        dto: { communityId: 'c-1' },
        userId: 'user-1',
        profileId: 'profile-1',
      });
      expect(result).toEqual({
        status: CommunityMembershipStatus.PENDING,
      });
    });

    it('grants the posting role once membership is approved', async () => {
      sendResolves({ status: CommunityMembershipStatus.APPROVED });
      permissions.send.mockReturnValue(of({ id: 'role-1', name: 'poster' }));

      await controller.joinCommunity('c-1', user, 'local-hub');

      expect(permissions.send).toHaveBeenCalled();
      const patterns = permissions.send.mock.calls.map((call) => call[0]);
      expect(patterns).toEqual(
        expect.arrayContaining([{ cmd: RoleCommands.GetByName }])
      );
    });

    it('does not grant the posting role while membership is pending', async () => {
      sendResolves({ status: CommunityMembershipStatus.PENDING });

      await controller.joinCommunity('c-1', user, 'local-hub');

      expect(permissions.send).not.toHaveBeenCalled();
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

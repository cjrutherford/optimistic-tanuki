import { of } from 'rxjs';
import { CommunityCommands } from '@optimistic-tanuki/constants';
import { CommunityController } from './community.controller';

describe('CommunityController locality-compat reads (O14)', () => {
  const socialClient = {
    send: jest.fn(),
  } as any;
  let controller: CommunityController;

  beforeEach(() => {
    socialClient.send.mockReset();
    controller = new CommunityController(
      socialClient,
      {} as any,
      {} as any,
      {} as any,
      { provision: jest.fn() } as any
    );
  });

  it('reads sub-communities by parent', async () => {
    socialClient.send.mockReturnValue(of([{ id: 'sub-1' }]));

    await expect(controller.getSubCommunities('c-1')).resolves.toEqual([
      { id: 'sub-1' },
    ]);
    expect(socialClient.send).toHaveBeenCalledWith(
      { cmd: CommunityCommands.GET_SUB_COMMUNITIES },
      { parentId: 'c-1' }
    );
  });

  it('checks membership for the caller', async () => {
    socialClient.send.mockReturnValue(of(true));

    await expect(
      controller.checkMembership('c-1', { userId: 'user-1' } as any)
    ).resolves.toBe(true);
    expect(socialClient.send).toHaveBeenCalledWith(
      { cmd: 'IS_COMMUNITY_MEMBER' },
      { communityId: 'c-1', userId: 'user-1' }
    );
  });

  it('reads manager and election with null fallbacks', async () => {
    socialClient.send.mockReturnValue(of({ id: 'mgr-1' }));
    await expect(controller.getCommunityManager('c-1')).resolves.toEqual({
      id: 'mgr-1',
    });

    socialClient.send.mockReturnValue(of(null));
    await expect(controller.getCommunityElection('c-1')).resolves.toBeNull();
  });

  it('nominates with the caller identity', async () => {
    socialClient.send.mockReturnValue(of({ id: 'cand-1' }));

    await controller.nominateForElection('c-1', {
      userId: 'user-1',
      profileId: 'profile-1',
    } as any);

    expect(socialClient.send).toHaveBeenCalledWith(
      { cmd: CommunityCommands.NOMINATE },
      { communityId: 'c-1', userId: 'user-1', profileId: 'profile-1' }
    );
  });

  it('accepts both candidate id spellings on vote', async () => {
    socialClient.send.mockReturnValue(of({ id: 'vote-1' }));
    const user = { userId: 'user-1', profileId: 'profile-1' } as any;

    await controller.voteInElection(
      'c-1',
      { candidateUserId: 'cand-9' } as any,
      user
    );
    expect(socialClient.send).toHaveBeenCalledWith(
      { cmd: CommunityCommands.VOTE },
      {
        communityId: 'c-1',
        voterId: 'user-1',
        voterProfileId: 'profile-1',
        candidateId: 'cand-9',
      }
    );

    await controller.voteInElection(
      'c-1',
      { candidateId: 'cand-9' } as any,
      user
    );
    expect(socialClient.send).toHaveBeenLastCalledWith(
      { cmd: CommunityCommands.VOTE },
      expect.objectContaining({ candidateId: 'cand-9' })
    );
  });
});

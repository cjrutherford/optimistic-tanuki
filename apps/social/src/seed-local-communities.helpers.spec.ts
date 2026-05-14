import {
  ensureCommunityChatRoom,
  SeededCommunityChatRecord,
} from './seed-local-communities.helpers';

describe('ensureCommunityChatRoom', () => {
  it('creates and links a chat room for seeded communities missing one', async () => {
    const community: SeededCommunityChatRecord = {
      id: 'community-1',
      name: 'Savannah',
      chatRoomId: null,
      ownerId: 'system',
      ownerProfileId: 'system',
    };
    const createCommunityChat = jest.fn().mockResolvedValue({ id: 'chat-1' });
    const setCommunityChatRoom = jest.fn().mockResolvedValue(undefined);

    await expect(
      ensureCommunityChatRoom(community, {
        createCommunityChat,
        setCommunityChatRoom,
      })
    ).resolves.toBe('chat-1');

    expect(createCommunityChat).toHaveBeenCalledWith({
      communityId: 'community-1',
      ownerId: 'system',
      name: 'Savannah',
    });
    expect(setCommunityChatRoom).toHaveBeenCalledWith('community-1', 'chat-1');
    expect(community.chatRoomId).toBe('chat-1');
  });

  it('preserves an existing linked chat room', async () => {
    const community: SeededCommunityChatRecord = {
      id: 'community-1',
      name: 'Savannah',
      chatRoomId: 'chat-existing',
      ownerId: 'system',
      ownerProfileId: 'system',
    };
    const createCommunityChat = jest.fn();
    const setCommunityChatRoom = jest.fn();

    await expect(
      ensureCommunityChatRoom(community, {
        createCommunityChat,
        setCommunityChatRoom,
      })
    ).resolves.toBe('chat-existing');

    expect(createCommunityChat).not.toHaveBeenCalled();
    expect(setCommunityChatRoom).not.toHaveBeenCalled();
  });
});

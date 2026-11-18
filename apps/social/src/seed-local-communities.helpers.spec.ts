import {
  changedSeedFields,
  ensureCommunityChatRoom,
  SeededCommunityChatRecord,
  withFormerSlug,
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

describe('changedSeedFields', () => {
  const existing = {
    name: 'Adel',
    lat: '31.1371000',
    lng: -83.4241,
    population: '5300',
    parentId: null,
    highlights: [{ b: 2, a: 1 }],
    tags: [{ id: 'x-1', name: 'Town' }],
  };

  it('reports nothing when only the representation differs', () => {
    expect(
      changedSeedFields(existing, {
        name: 'Adel',
        lat: 31.1371,
        lng: '-83.4241',
        population: 5300,
        parentId: undefined,
        highlights: [{ a: 1, b: 2 }],
        tags: [{ id: 'x-1', name: 'Town' }],
      })
    ).toEqual([]);
  });

  it('ignores the rounding of a decimal(9,6) coordinate', () => {
    expect(
      changedSeedFields(
        { lat: '32.744892', lng: '-81.360462' },
        { lat: 32.74489185380347, lng: -81.36046207147486 }
      )
    ).toEqual([]);
    expect(changedSeedFields({ lat: '32.744892' }, { lat: 32.7449 })).toEqual([
      'lat',
    ]);
  });

  it('names the fields that really changed', () => {
    expect(
      changedSeedFields(existing, {
        name: 'Adel GA',
        lat: 31.2,
        tags: [{ id: 'x-1', name: 'City' }],
        population: 5300,
      })
    ).toEqual(['name', 'lat', 'tags']);
  });

  it('treats a new value over null as a change', () => {
    expect(changedSeedFields(existing, { parentId: 'p-1' })).toEqual([
      'parentId',
    ]);
  });
});

describe('withFormerSlug', () => {
  it('records the old slug once', () => {
    expect(withFormerSlug([], 'old', 'new')).toEqual(['old']);
    expect(withFormerSlug(['old'], 'old', 'new')).toEqual(['old']);
    expect(withFormerSlug(null, null, 'new')).toEqual([]);
    expect(withFormerSlug(['a'], 'new', 'new')).toEqual(['a']);
  });
});

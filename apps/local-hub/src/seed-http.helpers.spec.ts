import { AxiosInstance } from 'axios';
import { ensureSeededCommunityChatRoom } from './seed-http.helpers';

describe('ensureSeededCommunityChatRoom', () => {
  it('repairs or creates a chat room using the seeded profile id', async () => {
    const post = jest.fn().mockResolvedValue({ data: { id: 'chat-room-1' } });
    const http = { post } as unknown as AxiosInstance;

    await expect(
      ensureSeededCommunityChatRoom(http, {
        communityId: 'community-1',
        communityName: 'Savannah Local',
        user: {
          userId: 'user-1',
          profileId: 'profile-1',
        },
      })
    ).resolves.toEqual({ id: 'chat-room-1' });

    expect(post).toHaveBeenCalledWith('/communities/community-1/chat-room', {
      ownerId: 'profile-1',
      name: 'Savannah Local',
    });
  });

  it('falls back to the user id when the seeded profile id is unavailable', async () => {
    const post = jest.fn().mockResolvedValue({ data: { id: 'chat-room-2' } });
    const http = { post } as unknown as AxiosInstance;

    await ensureSeededCommunityChatRoom(http, {
      communityId: 'community-2',
      communityName: 'Client Interface Community',
      user: {
        userId: 'user-2',
        profileId: '',
      },
    });

    expect(post).toHaveBeenCalledWith('/communities/community-2/chat-room', {
      ownerId: 'user-2',
      name: 'Client Interface Community',
    });
  });
});

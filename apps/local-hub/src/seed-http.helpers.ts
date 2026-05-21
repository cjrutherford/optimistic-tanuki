import { AxiosInstance } from 'axios';

export type SeedChatOwner = {
  userId: string;
  profileId?: string;
};

export async function ensureSeededCommunityChatRoom(
  http: AxiosInstance,
  input: {
    communityId: string;
    communityName: string;
    user: SeedChatOwner;
  }
): Promise<{ id: string }> {
  const ownerId = input.user.profileId?.trim() || input.user.userId;
  const response = await http.post<{ id: string }>(
    `/communities/${input.communityId}/chat-room`,
    {
      ownerId,
      name: input.communityName,
    }
  );

  return response.data;
}

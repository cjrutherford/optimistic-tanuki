export type SeededCommunityChatRecord = {
  id: string;
  name: string;
  chatRoomId?: string | null;
  ownerId?: string | null;
  ownerProfileId?: string | null;
};

export type SeededCommunityChatDependencies = {
  createCommunityChat: (input: {
    communityId: string;
    ownerId: string;
    name?: string;
  }) => Promise<{ id: string } | null | undefined>;
  setCommunityChatRoom: (
    communityId: string,
    chatRoomId: string
  ) => Promise<void>;
};

export async function ensureCommunityChatRoom(
  community: SeededCommunityChatRecord,
  deps: SeededCommunityChatDependencies
): Promise<string | null> {
  if (community.chatRoomId) {
    return community.chatRoomId;
  }

  const ownerId = community.ownerProfileId || community.ownerId || 'system';
  const chatRoom = await deps.createCommunityChat({
    communityId: community.id,
    ownerId,
    name: community.name,
  });

  if (!chatRoom?.id) {
    return null;
  }

  await deps.setCommunityChatRoom(community.id, chatRoom.id);
  community.chatRoomId = chatRoom.id;

  return chatRoom.id;
}

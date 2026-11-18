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

function normaliseSeedValue(value: unknown): unknown {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number' || typeof value === 'bigint')
    return Number(value);
  if (typeof value === 'string' && value.trim() !== '' && !isNaN(Number(value)))
    return Number(value);
  if (Array.isArray(value)) return value.map(normaliseSeedValue);
  if (typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, entry]) => [key, normaliseSeedValue(entry)])
    );
  return value;
}

/**
 * The names of the fields in `updates` whose persisted value differs from `existing`. Values are normalised first:
 * numbers and numeric strings (Postgres returns decimals as strings), null versus undefined, and JSON fields whose
 * keys come back in a different order all compare equal.
 */
export function changedSeedFields(
  existing: object,
  updates: Record<string, unknown>
): string[] {
  const current = existing as Record<string, unknown>;
  return Object.keys(updates).filter(
    (field) =>
      JSON.stringify(normaliseSeedValue(current[field])) !==
      JSON.stringify(normaliseSeedValue(updates[field]))
  );
}

/** The former slugs a renamed community should carry: what it has, plus the slug it was renamed away from. */
export function withFormerSlug(
  existing: readonly string[] | null | undefined,
  formerSlug: string | null | undefined,
  currentSlug: string
): string[] {
  const slugs = [...(existing ?? [])];
  if (formerSlug && formerSlug !== currentSlug && !slugs.includes(formerSlug))
    slugs.push(formerSlug);
  return slugs;
}

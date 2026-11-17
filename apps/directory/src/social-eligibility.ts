import { TownGeometryService } from './town-geometry';

/** Minimal Social snapshot; callers must obtain it from the authoritative service. */
export interface SocialCommunitySnapshot {
  id: string;
  name: string;
  slug: string | null;
  adminArea: string | null;
  appScope: string;
  isPrivate: boolean;
  localityType: string | null;
}

export function isEligibleCommunity(community: SocialCommunitySnapshot): boolean {
  return community.adminArea !== 'Development fixture' && community.appScope === 'local-hub' && community.isPrivate === false &&
    (community.localityType === 'city' || community.localityType === 'town');
}

/** No transport or reconciliation is implied by this adapter. */
export async function applySocialCommunity(service: TownGeometryService, community: SocialCommunitySnapshot): Promise<void> {
  if (isEligibleCommunity(community)) {
    await service.upsertTown({ communityId: community.id, name: community.name, slug: community.slug,
      administrativeArea: community.adminArea, eligible: true });
  } else {
    await service.withdrawTown(community.id);
  }
}

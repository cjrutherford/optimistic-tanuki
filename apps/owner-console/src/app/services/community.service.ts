import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  CommunityDto,
  CreateCommunityDto,
  UpdateCommunityDto,
  CommunityMemberDto,
  CommunityMemberRole,
  LocalityType,
  InviteToCommunityDto,
} from '@optimistic-tanuki/ui-models';
import { OptomisitcTanukiAPIService } from '@optimistic-tanuki/social-data-access';

export interface CommunityManagerRecord {
  userId: string;
  profileId: string;
}

export interface CommunityMembershipAuditRecord {
  workspaceId: string;
  subjectId: string;
  actorId: string;
  actor: 'owner' | 'moderator' | 'system';
  action: 'activate' | 'suspend' | 'revoke';
  from: 'pending' | 'active' | 'suspended' | 'revoked';
  to: 'pending' | 'active' | 'suspended' | 'revoked';
}

@Injectable({
  providedIn: 'root',
})
export class CommunityService {
  private readonly social = inject(OptomisitcTanukiAPIService);

  getCommunities(): Observable<CommunityDto[]> {
    return this.social.communitiesControllerListCommunities<CommunityDto[]>({});
  }

  // Canonical read: GET /api/communities/:id never existed (404). Same
  // backend via /api/social/community/:id.
  getCommunity(id: string): Observable<CommunityDto> {
    return this.social.communityControllerGetCommunity<CommunityDto>(id);
  }

  getMyCommunities(): Observable<CommunityDto[]> {
    return this.social.communitiesControllerGetMyCommunities<CommunityDto[]>();
  }

  // Canonical write: POST /api/communities never existed (404). Same
  // backend via /api/social/community.
  createCommunity(community: CreateCommunityDto): Observable<CommunityDto> {
    const { parentId, ...rest } = community;
    return this.social.communityControllerCreateCommunity<CommunityDto>({
      ...rest,
      parentId: parentId ?? undefined,
      createChatRoom: true,
    } as Parameters<typeof this.social.communityControllerCreateCommunity>[0]);
  }

  updateCommunity(
    id: string,
    community: UpdateCommunityDto
  ): Observable<CommunityDto> {
    return this.social.communityControllerUpdateCommunity<CommunityDto>(
      id,
      community as Parameters<
        typeof this.social.communityControllerUpdateCommunity
      >[1]
    );
  }

  deleteCommunity(id: string): Observable<void> {
    return this.social.communityControllerDeleteCommunity<void>(id);
  }

  // Canonical read: no members list under /api/communities (404). Same
  // backend via /api/social/community/:id/members.
  getCommunityMembers(communityId: string): Observable<CommunityMemberDto[]> {
    return this.social.communityControllerGetMembers<CommunityMemberDto[]>(
      communityId
    );
  }

  updateMemberRole(
    communityId: string,
    memberId: string,
    role: CommunityMemberRole
  ): Observable<CommunityMemberDto> {
    return this.social.communitiesControllerUpdateMemberRole<CommunityMemberDto>(
      communityId,
      memberId,
      { role }
    );
  }

  removeMember(communityId: string, memberId: string): Observable<void> {
    return this.social.communitiesControllerRemoveMember<void>(
      communityId,
      memberId
    );
  }

  getMembershipAudit(
    communityId: string,
    memberId: string
  ): Observable<CommunityMembershipAuditRecord[]> {
    return this.social.communityControllerGetMembershipAudit<
      CommunityMembershipAuditRecord[]
    >(memberId);
  }

  suspendMember(
    communityId: string,
    memberId: string
  ): Observable<CommunityMemberDto> {
    return this.social.communityControllerSuspendMember<CommunityMemberDto>(
      memberId
    );
  }

  reactivateMember(
    communityId: string,
    memberId: string
  ): Observable<CommunityMemberDto> {
    return this.social.communityControllerReactivateMember<CommunityMemberDto>(
      memberId
    );
  }

  inviteMember(invite: InviteToCommunityDto): Observable<CommunityMemberDto> {
    return this.social.communitiesControllerInviteMember<CommunityMemberDto>(
      invite.communityId,
      { inviteeUserId: invite.inviteeUserId }
    );
  }

  getCommunityManager(
    communityId: string
  ): Observable<CommunityManagerRecord | null> {
    return this.social.communitiesControllerGetCommunityManager<CommunityManagerRecord | null>(
      communityId
    );
  }

  appointManager(
    communityId: string,
    manager: { userId: string; profileId: string }
  ): Observable<CommunityManagerRecord> {
    return this.social.communitiesControllerAppointManager<CommunityManagerRecord>(
      communityId,
      manager
    );
  }

  revokeManager(communityId: string): Observable<void> {
    return this.social.communitiesControllerRevokeManager<void>(communityId);
  }

  getCities(): Observable<CommunityDto[]> {
    return this.social.communitiesControllerListCommunities<CommunityDto[]>({
      localityType: 'city',
    });
  }

  getCity(id: string): Observable<CommunityDto> {
    return this.getCommunity(id);
  }

  createCity(city: CreateCommunityDto): Observable<CommunityDto> {
    return this.createCommunity({
      ...city,
      localityType: LocalityType.CITY,
    });
  }

  updateCity(id: string, city: UpdateCommunityDto): Observable<CommunityDto> {
    return this.updateCommunity(id, city);
  }

  deleteCity(id: string): Observable<void> {
    return this.deleteCommunity(id);
  }
}

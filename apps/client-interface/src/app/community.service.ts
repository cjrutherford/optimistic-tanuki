import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  CommunityDto,
  CreateCommunityDto,
  UpdateCommunityDto,
  SearchCommunityDto,
  CommunityMemberDto,
  CommunityInviteDto,
} from '@optimistic-tanuki/ui-models';
import { OptomisitcTanukiAPIService } from '@optimistic-tanuki/social-data-access';

@Injectable({
  providedIn: 'root',
})
export class CommunityService {
  private readonly social = inject(OptomisitcTanukiAPIService);

  createCommunity(dto: CreateCommunityDto): Observable<CommunityDto> {
    return this.social.communityControllerCreateCommunity<CommunityDto>(
      dto as Parameters<
        typeof this.social.communityControllerCreateCommunity
      >[0]
    );
  }

  getCommunity(id: string): Observable<CommunityDto> {
    return this.social.communityControllerGetCommunity<CommunityDto>(id);
  }

  searchCommunities(criteria: SearchCommunityDto): Observable<CommunityDto[]> {
    return this.social.communityControllerSearchCommunities<CommunityDto[]>(
      criteria as Parameters<
        typeof this.social.communityControllerSearchCommunities
      >[0]
    );
  }

  listCommunities(name?: string): Observable<CommunityDto[]> {
    return this.social.communityControllerListCommunities<CommunityDto[]>(
      name === undefined ? {} : { name }
    );
  }

  updateCommunity(
    id: string,
    dto: UpdateCommunityDto
  ): Observable<CommunityDto> {
    return this.social.communityControllerUpdateCommunity<CommunityDto>(
      id,
      dto as Parameters<
        typeof this.social.communityControllerUpdateCommunity
      >[1]
    );
  }

  deleteCommunity(id: string): Observable<void> {
    return this.social.communityControllerDeleteCommunity<void>(id);
  }

  joinCommunity(id: string): Observable<CommunityMemberDto> {
    return this.social.communityControllerJoinCommunity<CommunityMemberDto>(id);
  }

  leaveCommunity(id: string): Observable<void> {
    return this.social.communityControllerLeaveCommunity<void>(id);
  }

  getMembers(id: string): Observable<CommunityMemberDto[]> {
    return this.social.communityControllerGetMembers<CommunityMemberDto[]>(id);
  }

  getUserCommunities(): Observable<CommunityDto[]> {
    return this.social.communityControllerGetUserCommunities<CommunityDto[]>();
  }

  inviteUser(
    communityId: string,
    inviteeUserId: string
  ): Observable<CommunityInviteDto> {
    return this.social.communityControllerInviteUser<CommunityInviteDto>(
      communityId,
      { inviteeUserId }
    );
  }

  getPendingInvites(communityId: string): Observable<CommunityInviteDto[]> {
    return this.social.communityControllerGetPendingInvites<
      CommunityInviteDto[]
    >(communityId);
  }

  getPendingJoinRequests(
    communityId: string
  ): Observable<CommunityMemberDto[]> {
    return this.social.communityControllerGetPendingJoinRequests<
      CommunityMemberDto[]
    >(communityId);
  }

  approveMember(memberId: string): Observable<CommunityMemberDto> {
    return this.social.communityControllerApproveMember<CommunityMemberDto>(
      memberId
    );
  }

  rejectMember(memberId: string): Observable<void> {
    return this.social.communityControllerRejectMember<void>(memberId);
  }

  removeMember(memberId: string): Observable<void> {
    return this.social.communityControllerRemoveMember<void>(memberId);
  }

  cancelInvite(inviteId: string): Observable<void> {
    return this.social.communityControllerCancelInvite<void>(inviteId);
  }

  getUserCommunitiesByProfileId(profileId: string): Observable<CommunityDto[]> {
    return this.social.communityControllerGetCommunitiesByProfileId<
      CommunityDto[]
    >(profileId);
  }
}

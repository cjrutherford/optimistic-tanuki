import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  CommunityDto,
  CreateCommunityDto,
  UpdateCommunityDto,
  SearchCommunityDto,
  CommunityMemberDto,
  JoinCommunityDto,
  InviteToCommunityDto,
  CommunityInviteDto,
} from '../models/index';

@Injectable({
  providedIn: 'root',
})
export class CommunityService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/social/community';

  create(dto: CreateCommunityDto): Promise<CommunityDto> {
    return this.http
      .post<CommunityDto>(`${this.baseUrl}`, { ...dto, createChatRoom: true })
      .toPromise() as Promise<CommunityDto>;
  }

  findOne(id: string): Promise<CommunityDto | null> {
    return this.http
      .get<CommunityDto | null>(`${this.baseUrl}/${id}`)
      .toPromise() as Promise<CommunityDto | null>;
  }

  findBySlug(slug: string): Promise<CommunityDto | null> {
    return this.http
      .get<CommunityDto | null>(`${this.baseUrl}/slug/${slug}`)
      .toPromise() as Promise<CommunityDto | null>;
  }

  findAll(searchDto: SearchCommunityDto): Promise<CommunityDto[]> {
    return this.http
      .post<CommunityDto[]>(`${this.baseUrl}/search`, {
        ...searchDto,
      })
      .toPromise() as Promise<CommunityDto[]>;
  }

  update(id: string, dto: UpdateCommunityDto): Promise<CommunityDto> {
    return this.http
      .put<CommunityDto>(`${this.baseUrl}/${id}`, dto)
      .toPromise() as Promise<CommunityDto>;
  }

  delete(id: string): Promise<void> {
    return this.http
      .delete<void>(`${this.baseUrl}/${id}`)
      .toPromise() as Promise<void>;
  }

  join(
    communityId: string,
    dto: JoinCommunityDto
  ): Promise<CommunityMemberDto> {
    return this.http
      .post<CommunityMemberDto>(`${this.baseUrl}/${communityId}/join`, dto)
      .toPromise() as Promise<CommunityMemberDto>;
  }

  leave(communityId: string): Promise<void> {
    return this.http
      .delete<void>(`${this.baseUrl}/${communityId}/leave`)
      .toPromise() as Promise<void>;
  }

  getMembers(communityId: string): Promise<CommunityMemberDto[]> {
    return this.http
      .get<CommunityMemberDto[]>(`${this.baseUrl}/${communityId}/members`)
      .toPromise() as Promise<CommunityMemberDto[]>;
  }

  getUserCommunities(): Promise<CommunityDto[]> {
    return this.http
      .get<CommunityDto[]>(`${this.baseUrl}/user/communities`)
      .toPromise() as Promise<CommunityDto[]>;
  }

  getMember(
    communityId: string,
    userId: string
  ): Promise<CommunityMemberDto | null> {
    return this.http
      .get<CommunityMemberDto | null>(
        `${this.baseUrl}/${communityId}/member/${userId}`
      )
      .toPromise() as Promise<CommunityMemberDto | null>;
  }

  isMember(communityId: string, userId: string): Promise<boolean> {
    return this.http
      .get<boolean>(`${this.baseUrl}/${communityId}/is-member/${userId}`)
      .toPromise() as Promise<boolean>;
  }

  invite(dto: InviteToCommunityDto): Promise<CommunityInviteDto> {
    return this.http
      .post<CommunityInviteDto>(`${this.baseUrl}/invite`, dto)
      .toPromise() as Promise<CommunityInviteDto>;
  }

  cancelInvite(inviteId: string): Promise<void> {
    return this.http
      .delete<void>(`${this.baseUrl}/invite/${inviteId}`)
      .toPromise() as Promise<void>;
  }

  getPendingInvites(communityId: string): Promise<CommunityInviteDto[]> {
    return this.http
      .get<CommunityInviteDto[]>(`${this.baseUrl}/${communityId}/invites`)
      .toPromise() as Promise<CommunityInviteDto[]>;
  }

  getPendingJoinRequests(communityId: string): Promise<CommunityMemberDto[]> {
    return this.http
      .get<CommunityMemberDto[]>(`${this.baseUrl}/${communityId}/join-requests`)
      .toPromise() as Promise<CommunityMemberDto[]>;
  }

  approveMember(memberId: string): Promise<CommunityMemberDto> {
    return this.http
      .post<CommunityMemberDto>(
        `${this.baseUrl}/members/${memberId}/approve`,
        {}
      )
      .toPromise() as Promise<CommunityMemberDto>;
  }

  rejectMember(memberId: string): Promise<void> {
    return this.http
      .post<void>(`${this.baseUrl}/members/${memberId}/reject`, {})
      .toPromise() as Promise<void>;
  }

  removeMember(
    memberId: string,
    payload?: { profileId?: string; communityId?: string }
  ): Promise<void> {
    return this.http
      .delete<void>(`${this.baseUrl}/members/${memberId}`, {
        body: payload,
      })
      .toPromise() as Promise<void>;
  }

  getUserInvites(userId: string): Promise<CommunityInviteDto[]> {
    return this.http
      .get<CommunityInviteDto[]>(`${this.baseUrl}/user/${userId}/invites`)
      .toPromise() as Promise<CommunityInviteDto[]>;
  }

  getTopActive(limit = 10, appScope = 'social'): Promise<CommunityDto[]> {
    return this.http
      .get<CommunityDto[]>(
        `${this.baseUrl}/top-active?limit=${limit}&appScope=${appScope}`
      )
      .toPromise() as Promise<CommunityDto[]>;
  }

  getProfile(profileId: string): Promise<any> {
    return this.http
      .get<any>(`/api/profile/${profileId}`)
      .toPromise() as Promise<any>;
  }

  getProfilesByIds(profileIds: string[]): Promise<any[]> {
    return this.http
      .post<any[]>(`/api/profile/by-ids`, { ids: profileIds })
      .toPromise() as Promise<any[]>;
  }

  getCommunityPosts(communityId: string): Promise<any[]> {
    return this.http
      .post<any[]>(`/api/social/post/find`, {
        criteria: { communityId },
        opts: { orderBy: 'createdAt', orderDirection: 'desc', limit: 50 },
      })
      .toPromise() as Promise<any[]>;
  }

  getCommunityChatRoom(communityId: string): Promise<{ id: string } | null> {
    return this.http
      .get<{ id: string } | null>(`${this.baseUrl}/${communityId}/chat-room`)
      .toPromise() as Promise<{ id: string } | null>;
  }

  getCommunityById(communityId: string): Promise<any> {
    return this.http
      .get<any>(`${this.baseUrl}/${communityId}`)
      .toPromise() as Promise<any>;
  }

  createCommunityChatChannel(
    communityId: string,
    name: string
  ): Promise<{ id: string }> {
    return this.http
      .post<{ id: string }>(`${this.baseUrl}/${communityId}/chat-channels`, {
        name,
      })
      .toPromise() as Promise<{ id: string }>;
  }

  createPost(postData: {
    title: string;
    content: string;
    profileId: string;
    communityId: string;
    attachmentIds?: string[];
  }): Promise<any> {
    return this.http
      .post<any>(`/api/social/post`, postData)
      .toPromise() as Promise<any>;
  }

  getCurrentUserProfile(): Promise<any> {
    return this.http.get<any>(`/api/profile/me`).toPromise() as Promise<any>;
  }

  appointManager(communityId: string, profileId: string): Promise<void> {
    return this.http
      .post<void>(`${this.baseUrl}/${communityId}/managers`, { profileId })
      .toPromise() as Promise<void>;
  }

  revokeManager(communityId: string, profileId: string): Promise<void> {
    return this.http
      .delete<void>(`${this.baseUrl}/${communityId}/managers/${profileId}`)
      .toPromise() as Promise<void>;
  }
}

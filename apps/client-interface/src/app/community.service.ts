import { Injectable, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  API_BASE_URL,
  CommunityDto,
  CreateCommunityDto,
  UpdateCommunityDto,
  SearchCommunityDto,
  CommunityMemberDto,
  CommunityInviteDto,
} from '@optimistic-tanuki/ui-models';

@Injectable({
  providedIn: 'root',
})
export class CommunityService {
  private baseUrl: string;

  constructor(
    @Inject(API_BASE_URL) private apiBaseUrl: string,
    private http: HttpClient
  ) {
    this.baseUrl = `${this.apiBaseUrl}/social/community`;
  }

  createCommunity(dto: CreateCommunityDto): Observable<CommunityDto> {
    return this.http.post<CommunityDto>(this.baseUrl, dto);
  }

  getCommunity(id: string): Observable<CommunityDto> {
    return this.http.get<CommunityDto>(`${this.baseUrl}/${id}`);
  }

  searchCommunities(criteria: SearchCommunityDto): Observable<CommunityDto[]> {
    return this.http.post<CommunityDto[]>(`${this.baseUrl}/search`, criteria);
  }

  listCommunities(name?: string): Observable<CommunityDto[]> {
    const url = name
      ? `${this.baseUrl}?name=${encodeURIComponent(name)}`
      : this.baseUrl;
    return this.http.get<CommunityDto[]>(url);
  }

  updateCommunity(
    id: string,
    dto: UpdateCommunityDto
  ): Observable<CommunityDto> {
    return this.http.put<CommunityDto>(`${this.baseUrl}/${id}`, dto);
  }

  deleteCommunity(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  joinCommunity(id: string): Observable<CommunityMemberDto> {
    return this.http.post<CommunityMemberDto>(`${this.baseUrl}/${id}/join`, {});
  }

  leaveCommunity(id: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${id}/leave`, {});
  }

  getMembers(id: string): Observable<CommunityMemberDto[]> {
    return this.http.get<CommunityMemberDto[]>(`${this.baseUrl}/${id}/members`);
  }

  getUserCommunities(): Observable<CommunityDto[]> {
    return this.http.get<CommunityDto[]>(`${this.baseUrl}/user/communities`);
  }

  inviteUser(
    communityId: string,
    inviteeUserId: string
  ): Observable<CommunityInviteDto> {
    return this.http.post<CommunityInviteDto>(
      `${this.baseUrl}/${communityId}/invite`,
      { inviteeUserId }
    );
  }

  getPendingInvites(communityId: string): Observable<CommunityInviteDto[]> {
    return this.http.get<CommunityInviteDto[]>(
      `${this.baseUrl}/${communityId}/invites`
    );
  }

  getPendingJoinRequests(
    communityId: string
  ): Observable<CommunityMemberDto[]> {
    return this.http.get<CommunityMemberDto[]>(
      `${this.baseUrl}/${communityId}/join-requests`
    );
  }

  approveMember(memberId: string): Observable<CommunityMemberDto> {
    return this.http.post<CommunityMemberDto>(
      `${this.baseUrl}/members/${memberId}/approve`,
      {}
    );
  }

  rejectMember(memberId: string): Observable<void> {
    return this.http.post<void>(
      `${this.baseUrl}/members/${memberId}/reject`,
      {}
    );
  }

  removeMember(memberId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/members/${memberId}`);
  }

  cancelInvite(inviteId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/invites/${inviteId}`);
  }
}

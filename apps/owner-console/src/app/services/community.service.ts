import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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

@Injectable({
  providedIn: 'root',
})
export class CommunityService {
  private readonly API_URL = '/api/communities';

  constructor(private http: HttpClient) {}

  getCommunities(): Observable<CommunityDto[]> {
    return this.http.get<CommunityDto[]>(`${this.API_URL}`);
  }

  getCommunity(id: string): Observable<CommunityDto> {
    return this.http.get<CommunityDto>(`${this.API_URL}/${id}`);
  }

  getMyCommunities(): Observable<CommunityDto[]> {
    return this.http.get<CommunityDto[]>(`${this.API_URL}/my`);
  }

  createCommunity(community: CreateCommunityDto): Observable<CommunityDto> {
    return this.http.post<CommunityDto>(`${this.API_URL}`, community);
  }

  updateCommunity(
    id: string,
    community: UpdateCommunityDto
  ): Observable<CommunityDto> {
    return this.http.put<CommunityDto>(`${this.API_URL}/${id}`, community);
  }

  deleteCommunity(id: string): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/${id}`);
  }

  getCommunityMembers(communityId: string): Observable<CommunityMemberDto[]> {
    return this.http.get<CommunityMemberDto[]>(
      `${this.API_URL}/${communityId}/members`
    );
  }

  updateMemberRole(
    communityId: string,
    memberId: string,
    role: CommunityMemberRole
  ): Observable<CommunityMemberDto> {
    return this.http.put<CommunityMemberDto>(
      `${this.API_URL}/${communityId}/members/${memberId}/role`,
      { role }
    );
  }

  removeMember(communityId: string, memberId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.API_URL}/${communityId}/members/${memberId}`
    );
  }

  inviteMember(invite: InviteToCommunityDto): Observable<CommunityMemberDto> {
    return this.http.post<CommunityMemberDto>(
      `${this.API_URL}/${invite.communityId}/members/invite`,
      { inviteeUserId: invite.inviteeUserId }
    );
  }

  getCities(): Observable<CommunityDto[]> {
    return this.http.get<CommunityDto[]>(`${this.API_URL}?localityType=city`);
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

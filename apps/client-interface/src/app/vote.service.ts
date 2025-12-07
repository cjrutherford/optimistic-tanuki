import { Injectable, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { VoteDto, CreateVoteDto } from '@optimistic-tanuki/social-ui';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';


@Injectable({
  providedIn: 'root'
})
export class VoteService {
  private baseUrl: string;

  constructor(
    @Inject(API_BASE_URL) private apiBaseUrl: string,
    private http: HttpClient
  ) {
    this.baseUrl = `${this.apiBaseUrl}/social/vote`;
  }

  createVote(voteDto: CreateVoteDto): Observable<VoteDto> {
    return this.http.post<VoteDto>(this.baseUrl, voteDto);
  }

  getVote(id: string): Observable<VoteDto> {
    return this.http.get<VoteDto>(`${this.baseUrl}/${id}`);
  }

  deleteVote(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}

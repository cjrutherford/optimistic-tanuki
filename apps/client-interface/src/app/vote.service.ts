import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { VoteDto, CreateVoteDto } from '@optimistic-tanuki/social-ui';


@Injectable({
  providedIn: 'root'
})
export class VoteService {
  private baseUrl = '/api/social/vote';

  constructor(private http: HttpClient) { }

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

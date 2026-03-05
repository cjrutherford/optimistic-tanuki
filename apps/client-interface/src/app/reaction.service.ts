import { Injectable, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CreateReactionDto, ReactionDto } from '@optimistic-tanuki/models';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';

export interface ReactionCounts {
  [value: number]: number;
}

@Injectable({
  providedIn: 'root',
})
export class ReactionService {
  private baseUrl: string;

  constructor(
    @Inject(API_BASE_URL) private apiBaseUrl: string,
    private http: HttpClient
  ) {
    this.baseUrl = `${this.apiBaseUrl}/social`;
  }

  addReaction(reactionDto: CreateReactionDto): Observable<ReactionDto | null> {
    return this.http.post<ReactionDto | null>(
      `${this.baseUrl}/reaction`,
      reactionDto
    );
  }

  getReactionsByPost(postId: string): Observable<ReactionDto[]> {
    return this.http.get<ReactionDto[]>(
      `${this.baseUrl}/reactions/post/${postId}`
    );
  }

  getReactionCounts(postId: string): Observable<ReactionCounts> {
    return this.http.get<ReactionCounts>(
      `${this.baseUrl}/reactions/post/${postId}/counts`
    );
  }

  getUserReaction(postId: string): Observable<ReactionDto | null> {
    return this.http.get<ReactionDto | null>(
      `${this.baseUrl}/reaction/post/${postId}/user`
    );
  }
}

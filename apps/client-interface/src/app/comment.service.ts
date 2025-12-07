import { Injectable, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CommentDto, UpdateCommentDto, CreateCommentDto, SearchCommentDto } from '@optimistic-tanuki/social-ui';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';


@Injectable({
  providedIn: 'root'
})
export class CommentService {
  private baseUrl: string;

  constructor(
    @Inject(API_BASE_URL) private apiBaseUrl: string,
    private http: HttpClient
  ) {
    this.baseUrl = `${this.apiBaseUrl}/social/comment`;
  }

  createComment(commentDto: CreateCommentDto): Observable<CommentDto> {
    return this.http.post<CommentDto>(this.baseUrl, commentDto);
  }

  getComment(id: string): Observable<CommentDto> {
    return this.http.get<CommentDto>(`${this.baseUrl}/${id}`);
  }

  updateComment(id: string, updateCommentDto: UpdateCommentDto): Observable<CommentDto> {
    return this.http.put<CommentDto>(`${this.baseUrl}/update/${id}`, updateCommentDto);
  }

  deleteComment(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  searchComments(searchCriteria: SearchCommentDto): Observable<CommentDto[]> {
    return this.http.post<CommentDto[]>(`${this.baseUrl}/find`, searchCriteria);
  }
}

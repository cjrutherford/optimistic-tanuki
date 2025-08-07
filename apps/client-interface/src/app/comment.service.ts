import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CommentDto, UpdateCommentDto, CreateCommentDto, SearchCommentDto } from '@optimistic-tanuki/social-ui';


/**
 * Service for managing comments.
 */
@Injectable({
  providedIn: 'root'
})
export class CommentService {
  private baseUrl = '/api/social/comment';

  /**
   * Creates an instance of CommentService.
   * @param http The HttpClient instance.
   */
  constructor(private http: HttpClient) { }

  /**
   * Creates a new comment.
   * @param commentDto The data for creating the comment.
   * @returns An Observable of the created CommentDto.
   */
  createComment(commentDto: CreateCommentDto): Observable<CommentDto> {
    return this.http.post<CommentDto>(this.baseUrl, commentDto);
  }

  /**
   * Retrieves a comment by its ID.
   * @param id The ID of the comment to retrieve.
   * @returns An Observable of the retrieved CommentDto.
   */
  getComment(id: string): Observable<CommentDto> {
    return this.http.get<CommentDto>(`${this.baseUrl}/${id}`);
  }

  /**
   * Updates an existing comment.
   * @param id The ID of the comment to update.
   * @param updateCommentDto The data for updating the comment.
   * @returns An Observable of the updated CommentDto.
   */
  updateComment(id: string, updateCommentDto: UpdateCommentDto): Observable<CommentDto> {
    return this.http.put<CommentDto>(`${this.baseUrl}/update/${id}`, updateCommentDto);
  }

  /**
   * Deletes a comment by its ID.
   * @param id The ID of the comment to delete.
   * @returns An Observable that completes when the comment is deleted.
   */
  deleteComment(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  /**
   * Searches for comments based on criteria.
   * @param searchCriteria The criteria for searching comments.
   * @returns An Observable of an array of CommentDto.
   */
  searchComments(searchCriteria: SearchCommentDto): Observable<CommentDto[]> {
    return this.http.post<CommentDto[]>(`${this.baseUrl}/find`, searchCriteria);
  }
}

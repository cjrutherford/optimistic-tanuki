import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CreatePostDto, PostDto, UpdatePostDto, SearchPostDto, SearchPostOptions } from '@optimistic-tanuki/social-ui';



/**
 * Service for managing posts.
 */
@Injectable({
  providedIn: 'root'
})
export class PostService {
  private baseUrl = '/api/social/post';

  /**
   * Creates an instance of PostService.
   * @param http The HttpClient instance.
   */
  constructor(private http: HttpClient) { }

  /**
   * Creates a new post.
   * @param postDto The data for creating the post.
   * @returns An Observable of the created PostDto.
   */
  createPost(postDto: CreatePostDto): Observable<PostDto> {
    return this.http.post<PostDto>(this.baseUrl, postDto);
  }

  /**
   * Retrieves a post by its ID.
   * @param id The ID of the post to retrieve.
   * @returns An Observable of the retrieved PostDto.
   */
  getPost(id: string): Observable<PostDto> {
    return this.http.get<PostDto>(`${this.baseUrl}/${id}`);
  }

  /**
   * Updates an existing post.
   * @param id The ID of the post to update.
   * @param updatePostDto The data for updating the post.
   * @returns An Observable of the updated PostDto.
   */
  updatePost(id: string, updatePostDto: UpdatePostDto): Observable<PostDto> {
    return this.http.put<PostDto>(`${this.baseUrl}/update/${id}`, updatePostDto);
  }

  /**
   * Deletes a post by its ID.
   * @param id The ID of the post to delete.
   * @returns An Observable that completes when the post is deleted.
   */
  deletePost(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  /**
   * Searches for posts based on criteria.
   * @param searchCriteria The criteria for searching posts.
   * @param opts Optional search options.
   * @returns An Observable of an array of PostDto.
   */
  searchPosts(searchCriteria: SearchPostDto, opts?: SearchPostOptions): Observable<PostDto[]> {
    return this.http.post<PostDto[]>(`${this.baseUrl}/find`, { criteria: searchCriteria, opts });
  }
}

import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface BlogPost {
  id?: string;
  title: string;
  content: string;
  authorId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateBlogPost {
  title: string;
  content: string;
  authorId: string;
}

export interface UpdateBlogPost {
  id: string;
  title?: string;
  content?: string;
  authorId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class BlogService {

  constructor(private readonly http: HttpClient) { }

  createPost(data: CreateBlogPost): Observable<BlogPost> {
    return this.http.post<BlogPost>('/api/post', data);
  }

  getAllPosts(query?: any): Observable<BlogPost[]> {
    return this.http.post<BlogPost[]>('/api/post/find', query || {});
  }

  getPost(id: string): Observable<BlogPost> {
    return this.http.get<BlogPost>(`/api/post/${id}`);
  }

  updatePost(id: string, data: Partial<CreateBlogPost>): Observable<BlogPost> {
    return this.http.patch<BlogPost>(`/api/post/${id}`, data);
  }

  deletePost(id: string): Observable<void> {
    return this.http.delete<void>(`/api/post/${id}`);
  }
}

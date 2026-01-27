import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { 
  TopicDto, 
  ThreadDto, 
  ForumPostDto, 
  CreateTopicDto, 
  CreateThreadDto, 
  CreateForumPostDto 
} from '../models';

@Injectable({
  providedIn: 'root'
})
export class ForumService {
  private readonly baseUrl = '/api/forum';

  constructor(private http: HttpClient) {}

  // Topic management
  getTopics(): Promise<TopicDto[]> {
    return this.http.get<TopicDto[]>(`${this.baseUrl}/topics`).toPromise() as Promise<TopicDto[]>;
  }

  getTopic(id: string): Promise<TopicDto> {
    return this.http.get<TopicDto>(`${this.baseUrl}/topics/${id}`).toPromise() as Promise<TopicDto>;
  }

  createTopic(topic: CreateTopicDto): Promise<TopicDto> {
    return this.http.post<TopicDto>(`${this.baseUrl}/topics`, topic).toPromise() as Promise<TopicDto>;
  }

  updateTopic(id: string, updates: Partial<TopicDto>): Promise<TopicDto> {
    return this.http.put<TopicDto>(`${this.baseUrl}/topics/${id}`, updates).toPromise() as Promise<TopicDto>;
  }

  deleteTopic(id: string): Promise<void> {
    return this.http.delete<void>(`${this.baseUrl}/topics/${id}`).toPromise() as Promise<void>;
  }

  // Thread management
  getThreadsByTopic(topicId: string): Promise<ThreadDto[]> {
    return this.http.get<ThreadDto[]>(`${this.baseUrl}/topics/${topicId}/threads`).toPromise() as Promise<ThreadDto[]>;
  }

  getThread(id: string): Promise<ThreadDto> {
    return this.http.get<ThreadDto>(`${this.baseUrl}/threads/${id}`).toPromise() as Promise<ThreadDto>;
  }

  createThread(thread: CreateThreadDto): Promise<ThreadDto> {
    return this.http.post<ThreadDto>(`${this.baseUrl}/threads`, thread).toPromise() as Promise<ThreadDto>;
  }

  updateThread(id: string, updates: Partial<ThreadDto>): Promise<ThreadDto> {
    return this.http.put<ThreadDto>(`${this.baseUrl}/threads/${id}`, updates).toPromise() as Promise<ThreadDto>;
  }

  deleteThread(id: string): Promise<void> {
    return this.http.delete<void>(`${this.baseUrl}/threads/${id}`).toPromise() as Promise<void>;
  }

  // Post management
  getPostsByThread(threadId: string): Promise<ForumPostDto[]> {
    return this.http.get<ForumPostDto[]>(`${this.baseUrl}/threads/${threadId}/posts`).toPromise() as Promise<ForumPostDto[]>;
  }

  getPost(id: string): Promise<ForumPostDto> {
    return this.http.get<ForumPostDto>(`${this.baseUrl}/posts/${id}`).toPromise() as Promise<ForumPostDto>;
  }

  createPost(post: CreateForumPostDto): Promise<ForumPostDto> {
    return this.http.post<ForumPostDto>(`${this.baseUrl}/posts`, post).toPromise() as Promise<ForumPostDto>;
  }

  updatePost(id: string, updates: Partial<ForumPostDto>): Promise<ForumPostDto> {
    return this.http.put<ForumPostDto>(`${this.baseUrl}/posts/${id}`, updates).toPromise() as Promise<ForumPostDto>;
  }

  deletePost(id: string): Promise<void> {
    return this.http.delete<void>(`${this.baseUrl}/posts/${id}`).toPromise() as Promise<void>;
  }

  // Search and filtering
  searchTopics(query: string): Promise<TopicDto[]> {
    return this.http.get<TopicDto[]>(`${this.baseUrl}/topics/search?q=${encodeURIComponent(query)}`).toPromise() as Promise<TopicDto[]>;
  }

  searchThreads(query: string): Promise<ThreadDto[]> {
    return this.http.get<ThreadDto[]>(`${this.baseUrl}/threads/search?q=${encodeURIComponent(query)}`).toPromise() as Promise<ThreadDto[]>;
  }

  searchPosts(query: string): Promise<ForumPostDto[]> {
    return this.http.get<ForumPostDto[]>(`${this.baseUrl}/posts/search?q=${encodeURIComponent(query)}`).toPromise() as Promise<ForumPostDto[]>;
  }
}
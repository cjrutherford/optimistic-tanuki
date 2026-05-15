import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  TopicDto,
  ThreadDto,
  UpdateTopicDto,
  UpdateThreadDto,
  ForumPostDto,
} from '@optimistic-tanuki/models';

export interface ForumModerationReport {
  id: string;
  reporterId: string;
  contentType: 'thread' | 'post';
  contentId: string;
  reason: string;
  description?: string;
  status: 'pending' | 'reviewed' | 'actioned' | 'dismissed';
  adminNotes?: string;
  createdAt: Date;
}

@Injectable({
  providedIn: 'root',
})
export class ForumService {
  private readonly API_URL = '/api/forum';

  constructor(private http: HttpClient) {}

  getTopics(): Observable<TopicDto[]> {
    return this.http.get<TopicDto[]>(`${this.API_URL}/topics`);
  }

  getThreads(): Observable<ThreadDto[]> {
    return this.http.get<ThreadDto[]>(`${this.API_URL}/threads`);
  }

  getPosts(): Observable<ForumPostDto[]> {
    return this.http.get<ForumPostDto[]>(`${this.API_URL}/posts`);
  }

  getReports(): Observable<ForumModerationReport[]> {
    return this.http.get<ForumModerationReport[]>(
      `${this.API_URL}/admin/reports`
    );
  }

  updateTopic(id: string, dto: UpdateTopicDto): Observable<TopicDto> {
    return this.http.put<TopicDto>(`${this.API_URL}/topic/${id}`, dto);
  }

  updateThread(id: string, dto: UpdateThreadDto): Observable<ThreadDto> {
    return this.http.put<ThreadDto>(`${this.API_URL}/thread/${id}`, dto);
  }

  updateReport(
    id: string,
    dto: {
      status: 'pending' | 'reviewed' | 'actioned' | 'dismissed';
      adminNotes?: string;
    }
  ): Observable<ForumModerationReport> {
    return this.http.put<ForumModerationReport>(
      `${this.API_URL}/admin/reports/${id}`,
      dto
    );
  }

  moderateThread(
    id: string,
    dto: {
      moderationStatus: 'visible' | 'hidden';
      adminNotes?: string;
    }
  ): Observable<ThreadDto> {
    return this.http.put<ThreadDto>(
      `${this.API_URL}/admin/thread/${id}/moderation`,
      dto
    );
  }

  moderatePost(
    id: string,
    dto: {
      moderationStatus: 'visible' | 'hidden';
      adminNotes?: string;
    }
  ): Observable<ForumPostDto> {
    return this.http.put<ForumPostDto>(
      `${this.API_URL}/admin/post/${id}/moderation`,
      dto
    );
  }
}

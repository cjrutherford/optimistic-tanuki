import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  CreateTopicDto,
  Topic,
  TopicDiscoveryResult,
  UpdateTopicDto,
} from '@optimistic-tanuki/leads-contracts';

@Injectable({ providedIn: 'root' })
export class LeadTopicsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/leads';

  getTopics(): Observable<Topic[]> {
    return this.http.get<Topic[]>(`${this.baseUrl}/topics`);
  }

  getTopicDiscoveryStatus(topicId: string): Observable<TopicDiscoveryResult> {
    return this.http.get<TopicDiscoveryResult>(
      `${this.baseUrl}/topics/${topicId}/discovery-status`,
    );
  }

  createTopic(dto: CreateTopicDto): Observable<Topic> {
    return this.http.post<Topic>(`${this.baseUrl}/topics`, dto);
  }

  updateTopic(topicId: string, dto: UpdateTopicDto): Observable<Topic> {
    return this.http.patch<Topic>(`${this.baseUrl}/topics/${topicId}`, dto);
  }

  deleteTopic(topicId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/topics/${topicId}`);
  }

  toggleTopic(topic: Topic): Observable<Topic> {
    return this.updateTopic(topic.id, { enabled: !topic.enabled });
  }

  runTopicDiscovery(topicId: string): Observable<TopicDiscoveryResult> {
    return this.http.post<TopicDiscoveryResult>(
      `${this.baseUrl}/topics/${topicId}/discover`,
      {},
    );
  }
}

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ActivityItem {
  id: string;
  profileId: string;
  type: 'post' | 'comment' | 'like' | 'share' | 'follow' | 'mention';
  description: string;
  resourceId?: string;
  resourceType?: string;
  createdAt: Date;
}

export interface SavedItem {
  id: string;
  profileId: string;
  itemType: 'post' | 'comment';
  itemId: string;
  itemTitle?: string;
  savedAt: Date;
}

@Injectable({ providedIn: 'root' })
export class ActivityService {
  private baseUrl = '/api/activity';

  constructor(private http: HttpClient) {}

  getUserActivity(
    profileId: string,
    options?: {
      type?: string;
      limit?: number;
      offset?: number;
    }
  ): Observable<ActivityItem[]> {
    const params: string[] = [];
    if (options?.type) params.push(`type=${options.type}`);
    if (options?.limit) params.push(`limit=${options.limit}`);
    if (options?.offset) params.push(`offset=${options.offset}`);
    const query = params.length > 0 ? `?${params.join('&')}` : '';
    return this.http.get<ActivityItem[]>(
      `${this.baseUrl}/${profileId}${query}`
    );
  }

  getSavedItems(profileId: string): Observable<SavedItem[]> {
    return this.http.get<SavedItem[]>(`${this.baseUrl}/${profileId}/saved`);
  }

  saveItem(
    profileId: string,
    itemType: 'post' | 'comment',
    itemId: string,
    itemTitle?: string
  ): Observable<SavedItem> {
    return this.http.post<SavedItem>(`${this.baseUrl}/${profileId}/saved`, {
      itemType,
      itemId,
      itemTitle,
    });
  }

  unsaveItem(
    profileId: string,
    itemId: string
  ): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(
      `${this.baseUrl}/${profileId}/saved/${itemId}`
    );
  }

  isSaved(profileId: string, itemId: string): Observable<{ saved: boolean }> {
    return this.http.get<{ saved: boolean }>(
      `${this.baseUrl}/${profileId}/saved/${itemId}`
    );
  }
}

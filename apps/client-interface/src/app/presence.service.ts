import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';

export type PresenceStatus = 'online' | 'offline' | 'away' | 'busy';

export interface UserPresence {
  userId: string;
  status: PresenceStatus;
  lastSeen: Date;
  isExplicit: boolean;
}

@Injectable({ providedIn: 'root' })
export class PresenceService {
  private baseUrl = '/api/presence';
  private presences = new BehaviorSubject<Map<string, UserPresence>>(new Map());

  constructor(private http: HttpClient) {}

  setPresence(status: PresenceStatus): Observable<UserPresence> {
    const currentUser = this.getCurrentUserId();
    if (!currentUser) {
      return new Observable();
    }
    return this.http.post<UserPresence>(`${this.baseUrl}`, {
      userId: currentUser,
      status,
    });
  }

  getPresence(userId: string): Observable<UserPresence | null> {
    return this.http.get<UserPresence | null>(`${this.baseUrl}/${userId}`);
  }

  getPresenceBatch(userIds: string[]): Observable<UserPresence[]> {
    return this.http.post<UserPresence[]>(`${this.baseUrl}/batch`, {
      userIds,
    });
  }

  getOnlineUsers(): Observable<UserPresence[]> {
    return this.http.get<UserPresence[]>(`${this.baseUrl}/online/users`);
  }

  updateLastSeen(userId: string): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/${userId}/last-seen`, {});
  }

  setOffline(userId: string): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/${userId}/offline`, {});
  }

  get allPresences$(): Observable<Map<string, UserPresence>> {
    return this.presences.asObservable();
  }

  updatePresence(presence: UserPresence): void {
    const current = this.presences.value;
    current.set(presence.userId, presence);
    this.presences.next(new Map(current));
  }

  private getCurrentUserId(): string | null {
    const userJson = localStorage.getItem('user');
    if (userJson) {
      try {
        const user = JSON.parse(userJson);
        return user.id || user.profileId || null;
      } catch {
        return null;
      }
    }
    return null;
  }
}

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface BlockedUser {
  id: string;
  blockedId: string;
  blockedName: string;
  blockedAvatar?: string;
  createdAt: Date;
}

export interface MutedUser {
  id: string;
  mutedId: string;
  mutedName: string;
  expiresAt?: Date;
  createdAt: Date;
}

export interface ContentReport {
  id: string;
  contentType: string;
  contentId: string;
  reason: string;
  description?: string;
  status: 'pending' | 'reviewed' | 'actioned' | 'dismissed';
  createdAt: Date;
}

export interface BlockUserDto {
  blockedId: string;
  reason?: string;
}

export interface MuteUserDto {
  mutedId: string;
  duration?: number;
}

export interface ReportContentDto {
  contentType: 'post' | 'comment' | 'profile' | 'community' | 'message';
  contentId: string;
  reason: string;
  description?: string;
}

@Injectable({
  providedIn: 'root',
})
export class PrivacyService {
  private http = inject(HttpClient);
  private baseUrl = '/api/privacy';

  // Block functionality
  blockUser(dto: BlockUserDto): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/block`, dto);
  }

  unblockUser(blockedId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/block/${blockedId}`);
  }

  getBlockedUsers(): Observable<BlockedUser[]> {
    return this.http.get<BlockedUser[]>(`${this.baseUrl}/blocked`);
  }

  isUserBlocked(userId: string): Observable<{ blocked: boolean }> {
    return this.http.get<{ blocked: boolean }>(
      `${this.baseUrl}/blocked/${userId}`
    );
  }

  // Mute functionality
  muteUser(dto: MuteUserDto): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/mute`, dto);
  }

  unmuteUser(mutedId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/mute/${mutedId}`);
  }

  getMutedUsers(): Observable<MutedUser[]> {
    return this.http.get<MutedUser[]>(`${this.baseUrl}/muted`);
  }

  // Report functionality
  reportContent(dto: ReportContentDto): Observable<ContentReport> {
    return this.http.post<ContentReport>(`${this.baseUrl}/report`, dto);
  }

  getMyReports(): Observable<ContentReport[]> {
    return this.http.get<ContentReport[]>(`${this.baseUrl}/reports`);
  }
}

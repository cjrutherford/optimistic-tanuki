import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ModerationReport {
  id: string;
  reporterId: string;
  contentType: string;
  contentId: string;
  reason: string;
  description?: string;
  status: 'pending' | 'reviewed' | 'actioned' | 'dismissed';
  adminNotes?: string;
  createdAt: Date;
}

export interface ModerateSocialContentDto {
  contentType: 'post' | 'comment';
  contentId: string;
  moderationStatus: 'visible' | 'hidden';
  adminNotes?: string;
}

@Injectable({
  providedIn: 'root',
})
export class SocialGovernanceService {
  private readonly API_URL = '/api/privacy/admin/reports';
  private readonly MODERATION_URL = '/api/privacy/admin/moderation';

  constructor(private http: HttpClient) {}

  getReports(): Observable<ModerationReport[]> {
    return this.http.get<ModerationReport[]>(this.API_URL);
  }

  updateReport(
    id: string,
    dto: {
      status: 'pending' | 'reviewed' | 'actioned' | 'dismissed';
      adminNotes?: string;
    }
  ): Observable<ModerationReport> {
    return this.http.put<ModerationReport>(`${this.API_URL}/${id}`, dto);
  }

  moderateContent(
    dto: ModerateSocialContentDto
  ): Observable<{ success: boolean }> {
    return this.http.put<{ success: boolean }>(this.MODERATION_URL, dto);
  }
}

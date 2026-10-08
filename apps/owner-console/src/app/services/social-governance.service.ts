import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
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

  getLocalHubOperatorReports(): Observable<ModerationReport[]> {
    return this.getOperatorReports('local-hub');
  }

  getClientInterfaceOperatorReports(): Observable<ModerationReport[]> {
    return this.getOperatorReports('client-interface');
  }

  private getOperatorReports(appScope: string): Observable<ModerationReport[]> {
    return this.http.get<ModerationReport[]>('/api/privacy/operator/reports', {
      headers: new HttpHeaders({ 'x-ot-appscope': appScope }),
    });
  }

  updateLocalHubOperatorReport(
    id: string,
    dto: { status: ModerationReport['status']; adminNotes?: string }
  ): Observable<ModerationReport> {
    return this.updateOperatorReport('local-hub', id, dto);
  }

  updateClientInterfaceOperatorReport(
    id: string,
    dto: { status: ModerationReport['status']; adminNotes?: string }
  ): Observable<ModerationReport> {
    return this.updateOperatorReport('client-interface', id, dto);
  }

  private updateOperatorReport(
    appScope: string,
    id: string,
    dto: { status: ModerationReport['status']; adminNotes?: string }
  ): Observable<ModerationReport> {
    return this.http.put<ModerationReport>(
      `/api/privacy/operator/reports/${id}`,
      dto,
      { headers: new HttpHeaders({ 'x-ot-appscope': appScope }) }
    );
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

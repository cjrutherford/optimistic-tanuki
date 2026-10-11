import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ReportContentDto {
  contentType: 'post' | 'comment' | 'profile' | 'community' | 'message';
  contentId: string;
  reason: string;
  description?: string;
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

/** Shared report contract used by OT and Towne Square consumers. */
@Injectable({ providedIn: 'root' })
export class PrivacyReportService {
  private readonly http = inject(HttpClient);

  reportContent(dto: ReportContentDto): Observable<ContentReport> {
    return this.http.post<ContentReport>('/api/privacy/report', dto);
  }
}

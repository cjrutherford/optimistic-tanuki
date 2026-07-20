import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export type VideoProcessingStatus =
  | 'pending'
  | 'processing'
  | 'ready'
  | 'failed';

export interface VideoProcessingJob {
  id: string;
  title: string;
  processingStatus: VideoProcessingStatus;
  processingError: string | null;
  updatedAt: string;
}

export interface VideoProcessingOverview {
  totals: Record<VideoProcessingStatus, number>;
  jobs: VideoProcessingJob[];
  queue?: {
    activeJobs: number;
    queuedJobs: number;
    maxConcurrentJobs: number;
  };
}

@Injectable({ providedIn: 'root' })
export class VideoProcessingService {
  private readonly apiUrl = '/api/videos';

  constructor(private readonly http: HttpClient) {}

  getOverview(): Observable<VideoProcessingOverview> {
    return this.http.get<VideoProcessingOverview>(
      `${this.apiUrl}/processing/overview`
    );
  }

  retry(id: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${id}/retry-processing`, {});
  }

  retryFailed(): Observable<{ queued: number }> {
    return this.http.post<{ queued: number }>(
      `${this.apiUrl}/processing/retry-failed`,
      {}
    );
  }
}

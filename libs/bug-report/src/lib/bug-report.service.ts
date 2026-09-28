import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  BUG_REPORT_LIMITS,
  BugReportNonceResponse,
  BugReportSubmitResult,
} from './bug-report.models';
import { LogBufferService } from './log-buffer.service';
import { ScreenshotService } from './screenshot.service';

/**
 * Unauthenticated submit client: GET nonce → gather context → POST report.
 * Sends no auth headers; security comes from the single-use nonce.
 */
@Injectable({ providedIn: 'root' })
export class BugReportService {
  constructor(
    private readonly http: HttpClient,
    private readonly logs: LogBufferService,
    private readonly screenshots: ScreenshotService
  ) {}

  async report(
    description: string,
    baseUrl = ''
  ): Promise<BugReportSubmitResult> {
    const clean = (description || '').slice(
      0,
      BUG_REPORT_LIMITS.descriptionMax
    );
    if (!clean.trim()) throw new Error('description is required');
    const nonce = await firstValueFrom(
      this.http.get<BugReportNonceResponse>(`${baseUrl}/api/bug-reports/nonce`)
    );
    const screenshotDataUrl = await this.screenshots.capture();
    const payload = {
      nonce: nonce.nonce,
      description: clean,
      pageUrl: (typeof location !== 'undefined' ? location.href : '').slice(
        0,
        BUG_REPORT_LIMITS.pageUrlMax
      ),
      userAgent: (typeof navigator !== 'undefined'
        ? navigator.userAgent
        : 'unknown'
      ).slice(0, BUG_REPORT_LIMITS.userAgentMax),
      browserLogs: this.logs.getSnapshot(),
      backendTraceIds: this.logs.getTraceIds(),
      screenshotDataUrl,
      occurredAt: new Date().toISOString(),
    };
    return firstValueFrom(
      this.http.post<BugReportSubmitResult>(
        `${baseUrl}/api/bug-reports`,
        payload
      )
    );
  }
}

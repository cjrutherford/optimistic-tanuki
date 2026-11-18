import { CommonModule } from '@angular/common';
import {
  HttpClient,
  HttpErrorResponse,
  HttpResponse,
} from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import type {
  DirectoryExportJob,
  DirectoryExportStatus,
} from '@optimistic-tanuki/social-contracts/directory';
import {
  BadgeComponent,
  ButtonComponent,
  CardComponent,
  EmptyStateComponent,
  IconComponent,
  LoadingStateComponent,
} from '@optimistic-tanuki/common-ui';
import { TextInputComponent } from '@optimistic-tanuki/form-ui';

export const POLL_MS = 3000;
export const DEFAULT_RELEASE_ID = '2026-10-21.0';

const ERROR_TEXT: Record<string, string> = {
  export_not_granted:
    'No export grant for this release. Public display approval does not allow export.',
  no_eligible_rows: 'No rows were eligible to export.',
};

/**
 * Operator export. A request is recorded at once and a Directory worker
 * writes the artifact in the background; the list refreshes itself while any
 * job is in flight. Only a completed, unexpired job can be downloaded.
 */
@Component({
  selector: 'app-directory-exports-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    BadgeComponent,
    ButtonComponent,
    CardComponent,
    EmptyStateComponent,
    IconComponent,
    LoadingStateComponent,
    TextInputComponent,
  ],
  templateUrl: './directory-exports-page.component.html',
  styleUrls: ['./directory-exports-page.component.scss'],
})
export class DirectoryExportsPageComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL).replace(/\/$/, '');

  releaseId = DEFAULT_RELEASE_ID;
  communityId = '';
  jobs: DirectoryExportJob[] = [];
  loading = false;
  submitting = false;
  message = '';
  downloading: string | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private stopped = false;
  // One id per submission: a retry after a network error replays instead of duplicating.
  private requestId: string | null = null;
  private requestKey = '';

  ngOnInit(): void {
    this.load(true);
  }

  ngOnDestroy(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
  }

  inFlight(): boolean {
    return this.jobs.some(
      (j) => j.status === 'queued' || j.status === 'running'
    );
  }

  private load(initial = false): void {
    if (initial) this.loading = true;
    this.http
      .get<{ items: DirectoryExportJob[]; total: number }>(
        `${this.api}/directory/exports?limit=50`
      )
      .subscribe({
        next: (result) => {
          this.loading = false;
          this.jobs = result.items ?? [];
          this.schedule();
        },
        error: () => {
          this.loading = false;
          this.message = 'Exports are unavailable. Retrying.';
          this.schedule(true);
        },
      });
  }

  refresh(): void {
    this.message = '';
    this.load(this.jobs.length === 0);
  }

  private schedule(force = false): void {
    if (this.timer) clearTimeout(this.timer);
    if (this.stopped || !(force || this.inFlight())) return;
    this.timer = setTimeout(() => this.load(), POLL_MS);
  }

  submit(): void {
    if (this.submitting) return;
    const releaseId = this.releaseId.trim();
    const communityId = this.communityId.trim();
    if (!/^[A-Za-z0-9._-]{1,100}$/.test(releaseId)) {
      this.message =
        'A release id is required: letters, digits, dot, dash or underscore.';
      return;
    }
    this.submitting = true;
    this.message = '';
    // A changed request is a different request, so it gets its own id.
    const key = `${releaseId}|${communityId}`;
    if (key !== this.requestKey) this.requestId = null;
    this.requestKey = key;
    this.requestId ??= crypto.randomUUID();
    this.http
      .post<DirectoryExportJob>(`${this.api}/directory/exports`, {
        id: this.requestId,
        releaseId,
        ...(communityId ? { communityId } : {}),
      })
      .subscribe({
        next: () => {
          this.submitting = false;
          this.requestId = null;
          this.message = 'Export requested. It is prepared in the background.';
          this.load();
        },
        error: (error: HttpErrorResponse) => {
          this.submitting = false;
          if (error?.status === 409 || error?.status === 400)
            this.requestId = null;
          this.message =
            error?.status === 400
              ? 'The export was refused. Check the release id and the community id.'
              : error?.status === 409
              ? 'That export request conflicts with an earlier one. Submit again.'
              : 'The export could not be requested. Try again.';
        },
      });
  }

  retry(job: DirectoryExportJob): void {
    this.http
      .post<DirectoryExportJob>(
        `${this.api}/directory/exports/${job.id}/retry`,
        {}
      )
      .subscribe({
        next: () => {
          this.message = 'Export queued again.';
          this.load();
        },
        error: (error: HttpErrorResponse) => {
          this.message =
            error?.status === 409
              ? 'Only a failed export can be retried.'
              : 'The export could not be retried. Try again.';
          this.load();
        },
      });
  }

  canDownload(job: DirectoryExportJob): boolean {
    return job.status === 'complete';
  }

  download(job: DirectoryExportJob): void {
    if (!this.canDownload(job) || this.downloading) return;
    this.downloading = job.id;
    this.http
      .get(`${this.api}/directory/exports/${job.id}/artifact`, {
        responseType: 'blob',
        observe: 'response',
      })
      .subscribe({
        next: (response: HttpResponse<Blob>) => {
          this.downloading = null;
          if (!response.body) {
            this.message = 'The export file was empty. Try again.';
            return;
          }
          this.save(response.body, this.filename(response, job));
          this.message = `Downloaded. SHA-256 ${
            response.headers.get('x-content-sha256') ?? job.sha256 ?? 'unknown'
          }`;
        },
        error: (error: HttpErrorResponse) => {
          this.downloading = null;
          this.message =
            error?.status === 410
              ? 'This export has expired or was withdrawn and can no longer be downloaded.'
              : error?.status === 409
              ? 'This export is not ready yet.'
              : 'The download failed. Try again.';
          this.load();
        },
      });
  }

  private filename(response: HttpResponse<Blob>, job: DirectoryExportJob) {
    const match = /filename="?([A-Za-z0-9._-]{1,200})"?/.exec(
      response.headers.get('content-disposition') ?? ''
    );
    return match?.[1] ?? `directory-export-${job.id}.jsonl`;
  }

  private save(blob: Blob, name: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  badgeTone(
    status: DirectoryExportStatus
  ): 'success' | 'warning' | 'danger' | 'neutral' {
    if (status === 'complete') return 'success';
    if (status === 'failed') return 'danger';
    if (status === 'queued' || status === 'running') return 'warning';
    return 'neutral';
  }

  errorText(code: string | null): string {
    if (!code) return '';
    return (
      ERROR_TEXT[code] ??
      `The export failed (${code}). Retry, or ask an engineer.`
    );
  }

  shortSha(sha: string | null): string {
    return sha ? `${sha.slice(0, 12)}…` : '';
  }

  size(bytes: number | null): string {
    if (bytes === null || bytes === undefined) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}

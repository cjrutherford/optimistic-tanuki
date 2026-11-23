import { CommonModule } from '@angular/common';
import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  OwnerConfirmService,
  OwnerPageHeaderComponent,
  OwnerStateComponent,
} from '@optimistic-tanuki/owner-page-ui';
import { DirectoryAdminService } from '../services/directory-admin.service';

export const RENORMALIZE_CONFIRMATION = 'RENORMALIZE';
export const JOB_POLL_START_MS = 1000;
export const JOB_POLL_MAX_MS = 10000;
export const JOB_POLL_MAX_ERRORS = 3;

export interface DirectoryJob {
  id: string;
  kind: 'renormalize';
  status: 'running' | 'succeeded' | 'failed';
  dryRun: boolean;
  townId: string | null;
  startedAt: string;
  finishedAt: string | null;
  counts: {
    scansTotal: number;
    scansDone: number;
    scanned: number;
    updated: number;
    skipped: number;
  };
  error: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Directory → Directory jobs. Starts a re-normalize job and follows it. A dry
 * run is the default and writes nothing; a real run changes stored listings, so
 * it needs a reason and the typed phrase. Status is polled with a growing
 * delay and polling stops once the job is no longer running.
 */
@Component({
  selector: 'app-directory-jobs-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    OwnerPageHeaderComponent,
    OwnerStateComponent,
  ],
  templateUrl: './directory-jobs-page.component.html',
  styleUrls: ['./directory-jobs-page.component.scss'],
})
export class DirectoryJobsPageComponent implements OnDestroy {
  private readonly admin = inject(DirectoryAdminService);
  private readonly confirm = inject(OwnerConfirmService);

  readonly job = signal<DirectoryJob | null>(null);
  readonly starting = signal(false);
  readonly actionError = signal('');
  readonly pollError = signal('');
  readonly polling = signal(false);
  readonly phrase = RENORMALIZE_CONFIRMATION;
  townId = '';
  dryRun = true;
  reason = '';

  private timer: ReturnType<typeof setTimeout> | undefined;
  private delay = JOB_POLL_START_MS;
  private errors = 0;
  private destroyed = false;

  ngOnDestroy(): void {
    this.destroyed = true;
    this.stopPolling();
  }

  async start(): Promise<void> {
    if (this.starting()) return;
    const town = this.townId.trim();
    if (town && !UUID.test(town)) {
      this.actionError.set('A town id looks like 8-4-4-4-12 hexadecimal.');
      return;
    }
    const reason = this.reason.trim();
    if (!this.dryRun) {
      if (!reason) {
        this.actionError.set('A real run needs a reason.');
        return;
      }
      const { confirmed } = await this.confirm.confirm({
        level: 'typed',
        title: 'Re-normalize stored listings',
        body: `This rewrites normalized listings${
          town ? ' for the chosen town' : ' for every town'
        }. Type the phrase to continue.`,
        confirmLabel: 'Start re-normalize',
        typedPhrase: RENORMALIZE_CONFIRMATION,
        destructive: true,
      });
      if (!confirmed) return;
    }
    this.starting.set(true);
    this.actionError.set('');
    this.pollError.set('');
    this.admin
      .startRenormalizeJob<DirectoryJob>({
        dryRun: this.dryRun,
        ...(town ? { townId: town } : {}),
        ...(!this.dryRun ? { reason } : {}),
      })
      .subscribe({
        next: (job) => {
          this.starting.set(false);
          this.job.set(job);
          this.beginPolling(job);
        },
        error: (err: { status?: number }) => {
          this.starting.set(false);
          this.actionError.set(
            err?.status === 409
              ? 'A job is already running. Wait for it to finish.'
              : 'The job could not be started.'
          );
        },
      });
  }

  retryPolling(): void {
    const job = this.job();
    if (job) this.beginPolling(job);
  }

  private beginPolling(job: DirectoryJob): void {
    this.stopPolling();
    this.delay = JOB_POLL_START_MS;
    this.errors = 0;
    this.pollError.set('');
    if (job.status === 'running') this.schedule(job.id);
  }

  private stopPolling(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    this.polling.set(false);
  }

  private schedule(id: string): void {
    if (this.destroyed) return;
    this.polling.set(true);
    this.timer = setTimeout(() => this.poll(id), this.delay);
    this.delay = Math.min(Math.round(this.delay * 1.5), JOB_POLL_MAX_MS);
  }

  private poll(id: string): void {
    this.timer = undefined;
    this.admin.getJob<DirectoryJob>(id).subscribe({
      next: (job) => {
        this.errors = 0;
        this.job.set(job);
        if (job.status === 'running') this.schedule(id);
        else this.stopPolling();
      },
      error: (err: { status?: number }) => {
        this.errors += 1;
        // A restart drops the job registry; that is final, not transient.
        if (err?.status === 404) {
          this.stopPolling();
          this.pollError.set(
            'The job is no longer known. Directory may have restarted.'
          );
        } else if (this.errors >= JOB_POLL_MAX_ERRORS) {
          this.stopPolling();
          this.pollError.set('Job status is unavailable.');
        } else this.schedule(id);
      },
    });
  }
}

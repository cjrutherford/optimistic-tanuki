import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import type {
  DirectoryOperatingControl,
  DirectoryOperatingControlKey,
  DirectoryOpsMetrics,
} from '@optimistic-tanuki/social-contracts/directory';
import {
  BadgeComponent,
  ButtonComponent,
  CardComponent,
  IconComponent,
  LoadingStateComponent,
} from '@optimistic-tanuki/common-ui';

export const CONTROL_LABELS: Record<DirectoryOperatingControlKey, string> = {
  provider_acquisition: 'Provider acquisition',
  export_worker: 'Export worker',
  taxonomy_worker: 'Taxonomy worker',
};

/**
 * Operator operations page: restricted health numbers plus the pause and
 * resume controls. Directory owns every number; a section it could not
 * collect is shown as unavailable rather than as zero.
 */
@Component({
  selector: 'app-directory-operations-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    BadgeComponent,
    ButtonComponent,
    CardComponent,
    IconComponent,
    LoadingStateComponent,
  ],
  templateUrl: './directory-operations-page.component.html',
  styleUrls: ['./directory-operations-page.component.scss'],
})
export class DirectoryOperationsPageComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL).replace(/\/$/, '');

  metrics: DirectoryOpsMetrics | null = null;
  controls: DirectoryOperatingControl[] = [];
  loading = false;
  failed = false;
  message = '';
  busy: string | null = null;
  reasons: Record<string, string> = {};
  reasonErrors: Record<string, boolean> = {};
  readonly queueNames = ['export', 'taxonomy', 'withdrawal'] as const;

  ngOnInit(): void {
    this.load(true);
  }

  refresh(): void {
    this.message = '';
    this.load(!this.metrics);
  }

  private load(initial = false): void {
    if (initial) this.loading = true;
    this.failed = false;
    let pending = 2;
    const done = () => {
      if (--pending === 0) this.loading = false;
    };
    this.http
      .get<DirectoryOpsMetrics>(`${this.api}/directory/operations/metrics`)
      .subscribe({
        next: (m) => {
          this.metrics = m;
          done();
        },
        error: () => {
          this.failed = true;
          done();
        },
      });
    this.loadControls(done);
  }

  private loadControls(done?: () => void): void {
    this.http
      .get<{ controls: DirectoryOperatingControl[] }>(
        `${this.api}/directory/operations/controls`
      )
      .subscribe({
        next: (r) => {
          this.controls = r.controls ?? [];
          done?.();
        },
        error: () => {
          this.failed = true;
          done?.();
        },
      });
  }

  label(key: string): string {
    return CONTROL_LABELS[key as DirectoryOperatingControlKey] ?? key;
  }

  pause(control: DirectoryOperatingControl): void {
    const reason = (this.reasons[control.key] ?? '').trim();
    if (!reason || reason.length > 500) {
      this.reasonErrors[control.key] = true;
      this.message = `Give a reason (up to 500 characters) before pausing ${this.label(
        control.key
      ).toLowerCase()}.`;
      return;
    }
    this.reasonErrors[control.key] = false;
    this.submit(control, true, reason);
  }

  resume(control: DirectoryOperatingControl): void {
    this.submit(control, false, null);
  }

  private submit(
    control: DirectoryOperatingControl,
    paused: boolean,
    reason: string | null
  ): void {
    if (this.busy) return;
    this.busy = control.key;
    this.message = '';
    this.http
      .post<DirectoryOperatingControl>(
        `${this.api}/directory/operations/controls/${control.key}`,
        {
          paused,
          ...(reason ? { reason } : {}),
          expectedVersion: control.version,
        }
      )
      .subscribe({
        next: (updated) => {
          this.busy = null;
          this.reasons[control.key] = '';
          this.controls = this.controls.map((c) =>
            c.key === updated.key ? updated : c
          );
          this.message = `${this.label(control.key)} ${
            paused ? 'paused' : 'resumed'
          }.`;
          this.load();
        },
        error: (error: HttpErrorResponse) => {
          this.busy = null;
          if (
            error?.status === 409 &&
            (error.error?.code ?? error.error?.response?.code) ===
              'stale_version'
          ) {
            this.message = `${this.label(
              control.key
            )} was changed by someone else. The latest state is shown; check it and try again.`;
            this.load();
            return;
          }
          this.message =
            error?.status === 400
              ? 'The change was refused. Check the reason.'
              : 'The change could not be saved. Try again.';
        },
      });
  }

  unavailable(section: unknown): boolean {
    return section === null || section === undefined;
  }

  money(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
  }

  statuses(byStatus: Record<string, number>): [string, number][] {
    return Object.entries(byStatus);
  }

  when(value: string | null): string {
    return value ?? 'never';
  }
}

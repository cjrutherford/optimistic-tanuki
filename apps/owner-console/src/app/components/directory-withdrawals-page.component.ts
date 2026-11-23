import { DirectoryAdminService } from '../services/directory-admin.service';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import {
  WITHDRAWAL_CONFIRMATION,
  type WithdrawalKind,
  type WithdrawalRecord,
} from '@optimistic-tanuki/social-contracts/directory';
import {
  BadgeComponent,
  ButtonComponent,
  CardComponent,
  IconComponent,
} from '@optimistic-tanuki/common-ui';
import { TextInputComponent } from '@optimistic-tanuki/form-ui';
import {
  OwnerPageHeaderComponent,
  OwnerStateComponent,
} from '@optimistic-tanuki/owner-page-ui';

export const POLL_MS = 3000;

/**
 * Authenticated withdrawal. A request is recorded at once and a worker removes
 * the data in the background; the list refreshes itself while any request is
 * still in flight. Withdrawal is permanent: nothing here restores it.
 */
@Component({
  selector: 'app-directory-withdrawals-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    BadgeComponent,
    ButtonComponent,
    CardComponent,
    IconComponent,
    OwnerPageHeaderComponent,
    OwnerStateComponent,
    TextInputComponent,
  ],
  templateUrl: './directory-withdrawals-page.component.html',
  styleUrls: ['./directory-withdrawals-page.component.scss'],
})
export class DirectoryWithdrawalsPageComponent implements OnInit, OnDestroy {
  private readonly admin = inject(DirectoryAdminService);

  readonly confirmation = WITHDRAWAL_CONFIRMATION;
  readonly kinds: Array<{
    value: WithdrawalKind;
    label: string;
    hint: string;
  }> = [
    { value: 'row', label: 'One row', hint: '<scan id>:<row number>' },
    { value: 'scan', label: 'A whole scan', hint: '<scan id>' },
    { value: 'policy', label: 'A policy', hint: '<policy id>' },
  ];
  kind: WithdrawalKind = 'row';
  requests: WithdrawalRecord[] = [];
  loading = false;
  loadFailed = false;
  submitting = false;
  message = '';
  typed = '';
  private timer: ReturnType<typeof setTimeout> | undefined;
  private stopped = false;
  // One id per attempt: a retry after a network error replays instead of duplicating.
  private requestId: string | null = null;

  ngOnInit(): void {
    this.load(true);
  }

  ngOnDestroy(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
  }

  hint(): string {
    return this.kinds.find((k) => k.value === this.kind)?.hint ?? '';
  }

  setKind(kind: WithdrawalKind): void {
    this.kind = kind;
    this.requestId = null;
  }

  inFlight(): boolean {
    return this.requests.some(
      (r) => r.status === 'pending' || r.status === 'running'
    );
  }

  confirmed(): boolean {
    return this.typed === this.confirmation;
  }

  setTyped(value: string): void {
    this.typed = value;
  }

  load(initial = false): void {
    if (initial) this.loading = true;
    this.admin.listWithdrawals<{ requests: WithdrawalRecord[] }>(50).subscribe({
      next: (result) => {
        this.loading = false;
        this.loadFailed = false;
        this.requests = result.requests ?? [];
        this.schedule();
      },
      error: () => {
        this.loading = false;
        this.loadFailed = true;
        this.message = 'Withdrawals are unavailable. Retrying.';
        this.schedule();
      },
    });
  }

  private schedule(): void {
    if (this.timer) clearTimeout(this.timer);
    if (this.stopped || !this.inFlight()) return;
    this.timer = setTimeout(() => this.load(), POLL_MS);
  }

  submit(target: string, reason: string, rightsCaseId: string): void {
    if (this.submitting) return;
    if (!this.confirmed()) {
      this.message = `Type ${this.confirmation} to confirm.`;
      return;
    }
    if (!target.trim() || !reason.trim()) {
      this.message = 'A target and a reason are required.';
      return;
    }
    this.submitting = true;
    this.message = '';
    this.requestId ??= crypto.randomUUID();
    const linked = rightsCaseId.trim();
    this.admin
      .requestWithdrawal<{ replayed: boolean; request: WithdrawalRecord }>({
        id: this.requestId,
        kind: this.kind,
        target: target.trim(),
        reason: reason.trim(),
        confirm: this.typed,
        ...(linked ? { rightsCaseId: linked } : {}),
      })
      .subscribe({
        next: () => {
          this.submitting = false;
          this.requestId = null;
          this.typed = '';
          this.message =
            'Withdrawal requested. It is permanent and runs in the background.';
          this.load();
        },
        error: (error: HttpErrorResponse) => {
          this.submitting = false;
          if (error?.status === 409) this.requestId = null;
          this.message =
            error?.status === 400
              ? 'The withdrawal was refused. Check the target and the typed confirmation.'
              : 'The withdrawal could not be recorded. Try again.';
        },
      });
  }

  badgeTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
    if (status === 'complete') return 'success';
    if (status === 'failed') return 'danger';
    if (status === 'pending' || status === 'running') return 'warning';
    return 'neutral';
  }

  progressText(r: WithdrawalRecord): string {
    const rows = r.progress['rowsRemaining'];
    if (r.status === 'complete') return 'All data removed.';
    // A failed request is not working; the card's alert carries the reason.
    if (r.status === 'failed') return 'Stopped';
    if (typeof rows === 'number') return `${rows} rows remaining`;
    return r.status === 'pending' ? 'Waiting to start' : 'Working';
  }
}

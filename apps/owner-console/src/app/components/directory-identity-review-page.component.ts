import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import {
  BadgeComponent,
  ButtonComponent,
  CardComponent,
  EmptyStateComponent,
  IconComponent,
  LoadingStateComponent,
} from '@optimistic-tanuki/common-ui';

type IdentityAction = 'confirm' | 'retire' | 'merge' | 'split';

interface IdentityHealth {
  unresolved: number;
  absent: number;
  awaitingOwner: number;
  carryIncomplete: number;
  carriedUnbound: number;
}
interface IdentityRow {
  businessId: string;
  scanId: string;
  sourceFileRowNumber: string;
}
interface UnresolvedRow extends IdentityRow {
  cause: string;
}
interface AwaitingOwner {
  carryId: string;
  requestId: string;
  businessId: string;
}
interface IdentityQueue {
  health: IdentityHealth;
  queue: {
    carriedUnbound: IdentityRow[];
    unresolved: UnresolvedRow[];
    awaitingOwner: AwaitingOwner[];
  };
}
interface ActionForm {
  businessId: string;
  action: IdentityAction;
  decisionId: string;
  reason: string;
  attested: boolean;
  otherBusinessId: string;
  selected: Set<string>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const REFUSED_MESSAGE =
  'Refused — an owner link may be attached or the business is no longer active.';

@Component({
  selector: 'app-directory-identity-review-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    BadgeComponent,
    ButtonComponent,
    CardComponent,
    EmptyStateComponent,
    IconComponent,
    LoadingStateComponent,
  ],
  templateUrl: './directory-identity-review-page.component.html',
  styleUrls: ['./directory-identity-review-page.component.scss'],
})
export class DirectoryIdentityReviewPageComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(API_BASE_URL).replace(/\/$/, '');

  readonly actions: IdentityAction[] = ['confirm', 'retire', 'merge', 'split'];
  town = '';
  data: IdentityQueue | null = null;
  loading = false;
  submitting = false;
  message = '';
  form: ActionForm | null = null;

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      this.town = params.get('communityId') ?? '';
      this.form = null;
      this.load();
    });
  }

  private get url(): string {
    return `${this.api}/directory/towns/${this.town}/business-identity-review`;
  }

  load(): void {
    if (!UUID.test(this.town)) {
      this.message = 'This town is unavailable.';
      return;
    }
    const town = this.town;
    this.loading = true;
    this.http.get<IdentityQueue>(this.url).subscribe({
      next: (result) => {
        if (this.town !== town) return;
        this.loading = false;
        this.data = result;
      },
      error: () => {
        if (this.town !== town) return;
        this.loading = false;
        this.message =
          'The business identity queue is unavailable. Please try again.';
      },
    });
  }

  /** Distinct businesses a reviewer can act on (carried-unbound and unresolved). */
  businesses(): string[] {
    const queue = this.data?.queue;
    if (!queue) return [];
    return [
      ...new Set([
        ...queue.carriedUnbound.map((r) => r.businessId),
        ...queue.unresolved.map((r) => r.businessId),
      ]),
    ];
  }

  rowsFor(businessId: string): IdentityRow[] {
    const queue = this.data?.queue;
    if (!queue) return [];
    return [...queue.carriedUnbound, ...queue.unresolved].filter(
      (r) => r.businessId === businessId
    );
  }

  rowKey(row: IdentityRow): string {
    return `${row.scanId}:${row.sourceFileRowNumber}`;
  }

  otherCandidates(businessId: string): string[] {
    return this.businesses().filter((id) => id !== businessId);
  }

  isOpen(businessId: string, action: IdentityAction): boolean {
    return this.form?.businessId === businessId && this.form.action === action;
  }

  /** One decisionId per opened form: a retry after a network error replays instead of duplicating. */
  open(businessId: string, action: IdentityAction): void {
    this.message = '';
    this.form = {
      businessId,
      action,
      decisionId: crypto.randomUUID(),
      reason: '',
      attested: false,
      otherBusinessId: '',
      selected: new Set<string>(),
    };
  }

  cancel(): void {
    this.form = null;
  }

  setReason(value: string): void {
    if (this.form) this.form.reason = value;
  }

  setAttested(value: boolean): void {
    if (this.form) this.form.attested = value;
  }

  setOther(value: string): void {
    if (this.form) this.form.otherBusinessId = value.trim();
  }

  toggleRow(row: IdentityRow, checked: boolean): void {
    if (!this.form) return;
    if (checked) this.form.selected.add(this.rowKey(row));
    else this.form.selected.delete(this.rowKey(row));
  }

  private body(form: ActionForm): Record<string, unknown> | string {
    const reason = form.reason.trim();
    if (!reason || reason.length > 1024) {
      return 'Enter a reason of up to 1024 characters.';
    }
    if (!form.attested) {
      return 'Confirm that you reviewed the business and its source rows.';
    }
    const body: Record<string, unknown> = {
      decisionId: form.decisionId,
      action: form.action,
      businessId: form.businessId,
      reason,
      attested: true,
    };
    if (form.action === 'merge') {
      if (
        !UUID.test(form.otherBusinessId) ||
        form.otherBusinessId === form.businessId
      ) {
        return 'Choose a different business to merge with.';
      }
      body['otherBusinessId'] = form.otherBusinessId;
    }
    if (form.action === 'split') {
      const rows = this.rowsFor(form.businessId)
        .filter((r) => form.selected.has(this.rowKey(r)))
        .map((r) => ({
          scanId: r.scanId,
          sourceFileRowNumber: r.sourceFileRowNumber,
        }));
      if (!rows.length) return 'Tick at least one row to split out.';
      body['rows'] = rows;
    }
    return body;
  }

  submit(): void {
    const form = this.form;
    if (!form || this.submitting) return;
    const body = this.body(form);
    if (typeof body === 'string') {
      this.message = body;
      return;
    }
    const town = this.town;
    this.message = '';
    this.submitting = true;
    this.http
      .post<{
        recorded: boolean;
        replayed: boolean;
        businesses: number;
        restoredLinks: number;
      }>(`${this.url}/decisions`, body)
      .subscribe({
        next: (result) => {
          if (this.town !== town) return;
          this.submitting = false;
          this.form = null;
          this.message = `Recorded ${form.action}${
            result.replayed ? ' (already recorded)' : ''
          }; ${result.restoredLinks} owner link(s) restored.`;
          this.load();
        },
        error: (error: HttpErrorResponse) => {
          if (this.town !== town) return;
          this.submitting = false;
          // The form, and its decisionId, stay open so a retry replays.
          this.message =
            error?.status === 409
              ? REFUSED_MESSAGE
              : 'Business identity review is unavailable. Try again.';
        },
      });
  }
}

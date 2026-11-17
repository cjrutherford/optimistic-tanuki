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

export const SUPPRESSION_REASONS = [
  'rights-request',
  'incorrect-details',
  'closed-business',
  'safety',
  'duplicate',
  'other',
] as const;
export const LIFT_REASONS = [
  'resolved',
  'mistaken-suppression',
  'other',
] as const;
export type SuppressionReason = (typeof SUPPRESSION_REASONS)[number];
export type LiftReason = (typeof LIFT_REASONS)[number];

export interface Suppression {
  suppressionId: string;
  listingId: string;
  listingName: string | null;
  reasonCode: SuppressionReason;
  note: string | null;
  actorId: string | null;
  createdAt: string;
  liftedAt: string | null;
  liftReasonCode: LiftReason | null;
  liftedById: string | null;
}
interface SearchHit {
  id?: string;
  name: string;
  category: string;
}
interface SuppressForm {
  suppressionId: string;
  listingId: string;
  reasonCode: SuppressionReason;
  note: string;
  attested: boolean;
}
interface LiftForm {
  suppressionId: string;
  reasonCode: LiftReason;
  attested: boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const REFUSED_MESSAGE =
  'Refused: this listing already has an open suppression, or the request conflicts with one already recorded.';

@Component({
  selector: 'app-directory-listing-suppression-page',
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
  templateUrl: './directory-listing-suppression-page.component.html',
  styleUrls: ['./directory-listing-suppression-page.component.scss'],
})
export class DirectoryListingSuppressionPageComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(API_BASE_URL).replace(/\/$/, '');

  readonly reasons = SUPPRESSION_REASONS;
  readonly liftReasons = LIFT_REASONS;
  town = '';
  suppressions: Suppression[] | null = null;
  hits: SearchHit[] = [];
  searched = false;
  loading = false;
  submitting = false;
  message = '';
  form: SuppressForm | null = null;
  liftForm: LiftForm | null = null;

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      this.town = params.get('communityId') ?? '';
      this.form = null;
      this.liftForm = null;
      this.hits = [];
      this.searched = false;
      this.load();
    });
  }

  private get url(): string {
    return `${this.api}/directory/towns/${this.town}/listing-suppressions`;
  }

  load(): void {
    if (!UUID.test(this.town)) {
      this.message = 'This town is unavailable.';
      return;
    }
    const town = this.town;
    this.loading = true;
    this.http.get<{ suppressions: Suppression[] }>(this.url).subscribe({
      next: (result) => {
        if (this.town !== town) return;
        this.loading = false;
        this.suppressions = result.suppressions;
      },
      error: () => {
        if (this.town !== town) return;
        this.loading = false;
        this.message = 'The suppression list is unavailable. Please try again.';
      },
    });
  }

  isOpen(item: Suppression): boolean {
    return item.liftedAt === null;
  }

  /** A search uses the existing public listing route; picking a hit only fills in the id. */
  search(term: string): void {
    const q = term.trim();
    if (!q || q.length > 100 || !UUID.test(this.town)) return;
    const town = this.town;
    this.searched = false;
    this.http
      .get<{ listings: SearchHit[] }>(
        `${this.api}/directory/towns/${town}/local-evaluation-listings`,
        { params: { q, identities: '1' } }
      )
      .subscribe({
        next: (result) => {
          if (this.town !== town) return;
          this.hits = (result.listings ?? []).filter(
            (h) => typeof h.id === 'string' && UUID.test(h.id)
          );
          this.searched = true;
        },
        error: () => {
          if (this.town !== town) return;
          this.hits = [];
          this.searched = true;
          this.message = 'Listing search is unavailable. Paste a listing id.';
        },
      });
  }

  /** One suppressionId per opened form: a retry after a network error replays instead of duplicating. */
  openSuppress(listingId = ''): void {
    this.message = '';
    this.liftForm = null;
    this.form = {
      suppressionId: crypto.randomUUID(),
      listingId,
      reasonCode: 'incorrect-details',
      note: '',
      attested: false,
    };
  }

  openLift(item: Suppression): void {
    this.message = '';
    this.form = null;
    this.liftForm = {
      suppressionId: item.suppressionId,
      reasonCode: 'resolved',
      attested: false,
    };
  }

  cancel(): void {
    this.form = null;
    this.liftForm = null;
  }

  setListing(value: string): void {
    if (this.form) this.form.listingId = value.trim();
  }
  setReason(value: string): void {
    if (this.form) this.form.reasonCode = value as SuppressionReason;
  }
  setNote(value: string): void {
    if (this.form) this.form.note = value;
  }
  setAttested(value: boolean): void {
    if (this.form) this.form.attested = value;
    if (this.liftForm) this.liftForm.attested = value;
  }
  setLiftReason(value: string): void {
    if (this.liftForm) this.liftForm.reasonCode = value as LiftReason;
  }

  submit(): void {
    const form = this.form;
    if (!form || this.submitting) return;
    const note = form.note.trim();
    if (!UUID.test(form.listingId)) {
      this.message = 'Enter or pick a valid listing id.';
      return;
    }
    if (note.length > 1024) {
      this.message = 'Keep the note under 1024 characters.';
      return;
    }
    if (!form.attested) {
      this.message =
        'Confirm that you reviewed this listing and want it hidden from every public view.';
      return;
    }
    const town = this.town;
    this.message = '';
    this.submitting = true;
    this.http
      .post<{ replayed: boolean; sentToReview: boolean }>(this.url, {
        suppressionId: form.suppressionId,
        listingId: form.listingId,
        reasonCode: form.reasonCode,
        ...(note ? { note } : {}),
        attested: true,
      })
      .subscribe({
        next: (result) => {
          if (this.town !== town) return;
          this.submitting = false;
          this.form = null;
          this.message = `Listing suppressed${
            result.replayed ? ' (already recorded)' : ''
          }${result.sentToReview ? '; sent back to address review' : ''}.`;
          this.load();
        },
        error: (error: HttpErrorResponse) => {
          if (this.town !== town) return;
          this.submitting = false;
          // The form, and its suppressionId, stay open so a retry replays.
          this.message = this.failure(error);
        },
      });
  }

  submitLift(): void {
    const form = this.liftForm;
    if (!form || this.submitting) return;
    if (!form.attested) {
      this.message = 'Confirm that you want this listing public again.';
      return;
    }
    const town = this.town;
    this.message = '';
    this.submitting = true;
    this.http
      .post<{ replayed: boolean }>(`${this.url}/${form.suppressionId}/lift`, {
        reasonCode: form.reasonCode,
        attested: true,
      })
      .subscribe({
        next: (result) => {
          if (this.town !== town) return;
          this.submitting = false;
          this.liftForm = null;
          this.message = `Suppression lifted${
            result.replayed ? ' (already recorded)' : ''
          }. The listing is public only if nothing else hides it.`;
          this.load();
        },
        error: (error: HttpErrorResponse) => {
          if (this.town !== town) return;
          this.submitting = false;
          this.message = this.failure(error);
        },
      });
  }

  private failure(error: HttpErrorResponse): string {
    if (error?.status === 409) return REFUSED_MESSAGE;
    if (error?.status === 404) return 'That listing is not available.';
    return 'Listing suppression is unavailable. Try again.';
  }
}

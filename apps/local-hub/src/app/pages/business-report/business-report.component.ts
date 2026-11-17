import { isPlatformBrowser } from '@angular/common';
import {
  Component,
  afterNextRender,
  ElementRef,
  Injector,
  inject,
  OnInit,
  PLATFORM_ID,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type { ListingReportReasonCode } from '@optimistic-tanuki/social-contracts';
import { CommunityService } from '../../services/community.service';
import {
  DirectoryRequestError,
  DirectoryService,
} from '../../services/directory.service';

/** Mirrors the gateway DTO (LISTING_REPORT_NOTE_MAX and the email MaxLength). */
export const REPORT_NOTE_MAX = 1000;
export const REPORT_EMAIL_MAX = 254;

export const REPORT_REASONS: {
  code: ListingReportReasonCode;
  label: string;
}[] = [
  {
    code: 'rights-request',
    label:
      "I'm the owner or have a rights request (remove or limit my information)",
  },
  { code: 'incorrect-details', label: 'Details are wrong' },
  { code: 'closed-business', label: 'This business has closed' },
  { code: 'safety', label: 'Safety concern' },
  { code: 'duplicate', label: 'Duplicate listing' },
  { code: 'other', label: 'Something else' },
];

type PageState = 'loading' | 'form' | 'expired' | 'done';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Public report / correction form. No sign-in, no ownership claim. */
@Component({
  selector: 'app-business-report',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './business-report.component.html',
  styleUrl: './business-report.component.scss',
})
export class BusinessReportComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private platformId = inject(PLATFORM_ID);
  private injector = inject(Injector);
  private communityService = inject(CommunityService);
  private directoryService = inject(DirectoryService);

  readonly reasons = REPORT_REASONS;
  readonly noteMax = REPORT_NOTE_MAX;
  readonly emailMax = REPORT_EMAIL_MAX;

  slug = this.route.snapshot.paramMap.get('slug') ?? '';
  reference = this.route.snapshot.paramMap.get('reference') ?? '';

  state = signal<PageState>('loading');
  townId = signal('');
  listingId = signal('');
  listingName = signal('');

  reason = signal<ListingReportReasonCode | ''>('');
  note = signal('');
  email = signal('');
  /** Honeypot. Always sent, always empty for a person. */
  website = '';

  errors = signal<{ reason?: string; note?: string; email?: string }>({});
  submitted = signal(false);
  sending = signal(false);
  submitError = signal('');
  receipt = signal('');
  copied = signal(false);

  summary = viewChild<ElementRef<HTMLElement>>('summary');
  ackHeading = viewChild<ElementRef<HTMLElement>>('ackHeading');

  get listingLink(): unknown[] {
    return ['/city', this.slug, 'businesses', this.reference];
  }

  ngOnInit(): void {
    void this.resolve();
  }

  private async resolve(): Promise<void> {
    try {
      const city = await this.communityService.getCityBySlug(this.slug);
      if (!city) return this.state.set('expired');
      this.townId.set(city.id);
      // A reference is bound to the adult setting it was issued under, so try the default first, then adult.
      const listing =
        (await this.directoryService.getListing(
          city.id,
          this.reference,
          false
        )) ??
        (await this.directoryService.getListing(city.id, this.reference, true));
      if (!listing?.id) return this.state.set('expired');
      this.listingId.set(listing.id);
      this.listingName.set(listing.name);
      this.state.set('form');
    } catch {
      this.state.set('expired');
    }
  }

  private validate(): boolean {
    const errors: { reason?: string; note?: string; email?: string } = {};
    if (!this.reason()) errors.reason = 'Choose the reason that fits best.';
    if (this.note().length > REPORT_NOTE_MAX) {
      errors.note = `Keep the note to ${REPORT_NOTE_MAX} characters or fewer.`;
    }
    const email = this.email().trim();
    if (
      email &&
      (email.length > REPORT_EMAIL_MAX || !EMAIL_PATTERN.test(email))
    ) {
      errors.email = 'Enter a valid email address, or leave it blank.';
    }
    this.errors.set(errors);
    return Object.keys(errors).length === 0;
  }

  async submit(): Promise<void> {
    if (this.sending()) return;
    this.submitted.set(true);
    this.submitError.set('');
    if (!this.validate()) {
      this.focusAfterRender(() => this.summary());
      return;
    }
    this.sending.set(true);
    try {
      const note = this.note().trim();
      const email = this.email().trim();
      const receipt = await this.directoryService.createReport(this.townId(), {
        listingId: this.listingId(),
        reasonCode: this.reason() as ListingReportReasonCode,
        ...(note ? { note } : {}),
        ...(email ? { email } : {}),
        website: this.website,
      });
      this.receipt.set(receipt);
      this.email.set('');
      this.state.set('done');
      this.focusAfterRender(() => this.ackHeading());
    } catch (error) {
      const status =
        error instanceof DirectoryRequestError ? error.status : null;
      this.submitError.set(
        status === 429
          ? 'Too many reports from this connection. Please try again later.'
          : status === 404
          ? 'This listing is no longer available to report.'
          : "We couldn't send your report. Please try again."
      );
      this.focusAfterRender(() => this.summary());
    } finally {
      this.sending.set(false);
    }
  }

  private focusAfterRender(
    target: () => ElementRef<HTMLElement> | undefined
  ): void {
    afterNextRender(() => target()?.nativeElement.focus(), {
      injector: this.injector,
    });
  }

  revalidate(): void {
    if (this.submitted()) this.validate();
  }

  async copyReceipt(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      await navigator.clipboard.writeText(this.receipt());
      this.copied.set(true);
    } catch {
      this.copied.set(false);
    }
  }

  get errorList(): { id: string; message: string }[] {
    const e = this.errors();
    return [
      ...(e.reason ? [{ id: 'report-reason', message: e.reason }] : []),
      ...(e.note ? [{ id: 'report-note', message: e.note }] : []),
      ...(e.email ? [{ id: 'report-email', message: e.email }] : []),
    ];
  }
}

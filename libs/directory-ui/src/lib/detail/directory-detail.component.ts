import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  input,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { describeCoverage } from '../coverage';
import { DirectoryBadgeComponent } from '../badge/directory-badge.component';
import { DirectorySourceAttributionComponent } from '../source-attribution/directory-source-attribution.component';
import {
  LocalDirectoryCoverage,
  LocalDirectoryListing,
  LocalDirectorySourceFreshness,
} from '../models';
import { humanizeCategory } from '../state';

export type DirectoryDetailStatus = 'loading' | 'ready' | 'expired' | 'failed';

export const DETAIL_EXPIRED_TITLE = 'This listing link has expired';
export const DETAIL_EXPIRED_MESSAGE =
  'Listing links are short-lived. Go back to the list to open it again.';
export const DETAIL_FAILED_TITLE =
  'Listing details are temporarily unavailable';
export const DETAIL_FAILED_MESSAGE = 'Please try again in a moment.';

/**
 * One listing in full: its details, where the data came from, and what the directory cannot promise.
 * It never claims the directory is complete.
 */
@Component({
  selector: 'otd-directory-detail',
  standalone: true,
  imports: [
    RouterLink,
    DirectoryBadgeComponent,
    DirectorySourceAttributionComponent,
  ],
  template: `
    <article
      class="detail"
      [attr.aria-busy]="status() === 'loading' ? 'true' : null"
    >
      @switch (status()) { @case ('loading') {
      <h1 #heading class="detail__title" tabindex="-1">Loading listing…</h1>
      } @case ('expired') {
      <div role="status" data-testid="detail-expired">
        <h1 #heading class="detail__title" tabindex="-1">
          {{ expiredTitle }}
        </h1>
        <p>{{ expiredMessage }}</p>
      </div>
      } @case ('failed') {
      <div role="alert" data-testid="detail-failed">
        <h1 #heading class="detail__title" tabindex="-1">{{ failedTitle }}</h1>
        <p>{{ failedMessage }}</p>
      </div>
      } @default { @if (listing(); as item) {
      <header class="detail__header">
        <h1 #heading class="detail__title" tabindex="-1">{{ item.name }}</h1>
        <otd-directory-badge
          [kind]="businessPage() ? 'business-page' : 'directory-listing'"
        ></otd-directory-badge>
      </header>
      <p class="detail__category">{{ category() }}</p>
      @if (item.address || item.phone || item.website) {
      <ul class="detail__facts">
        @if (item.address) {
        <li>{{ item.address }}</li>
        } @if (item.phone) {
        <li>{{ item.phone }}</li>
        } @if (item.website) {
        <li>
          <a [href]="item.website" target="_blank" rel="noopener noreferrer"
            >Visit website</a
          >
        </li>
        }
      </ul>
      }
      <section class="detail__source" aria-labelledby="otd-detail-source">
        <h2 id="otd-detail-source" class="detail__subtitle">
          About this listing
        </h2>
        <otd-directory-source-attribution
          [attribution]="item.attribution"
          [notices]="item.notices"
          [termsUrls]="item.termsUrls ?? []"
          [freshness]="freshness()"
        ></otd-directory-source-attribution>
        @if (coverageNote(); as note) {
        <p class="detail__coverage" data-testid="detail-coverage">{{ note }}</p>
        } @if (coverage()?.withheldReviewedDetails) {
        <p class="detail__coverage" data-testid="detail-withheld">
          Some business details are hidden until they're re-checked.
        </p>
        }
      </section>
      } } }
      <nav class="detail__nav" aria-label="Listing actions">
        @if (backLink(); as back) {
        <a data-testid="detail-back" [routerLink]="$any(back)">{{
          backLabel()
        }}</a>
        } @if (status() === 'ready' && reportLink(); as report) {
        <a data-testid="detail-report" [routerLink]="$any(report)"
          >Report or correct this listing</a
        >
        }
      </nav>
    </article>
  `,
  styleUrls: ['./directory-detail.component.scss'],
})
export class DirectoryDetailComponent {
  readonly status = input<DirectoryDetailStatus>('ready');
  readonly listing = input<LocalDirectoryListing | null>(null);
  readonly freshness = input<LocalDirectorySourceFreshness | null>(null);
  readonly coverage = input<LocalDirectoryCoverage | null>(null);
  readonly businessPage = input(false);
  readonly backLink = input<readonly unknown[] | null>(null);
  readonly backLabel = input('Back to the directory');
  readonly reportLink = input<readonly unknown[] | null>(null);
  /** Move focus to the heading once rendered; the detail view is a route of its own. */
  readonly autoFocus = input(true);

  readonly expiredTitle = DETAIL_EXPIRED_TITLE;
  readonly expiredMessage = DETAIL_EXPIRED_MESSAGE;
  readonly failedTitle = DETAIL_FAILED_TITLE;
  readonly failedMessage = DETAIL_FAILED_MESSAGE;

  private readonly heading = viewChild<ElementRef<HTMLElement>>('heading');

  readonly category = computed(() => {
    const listing = this.listing();
    return listing ? humanizeCategory(listing.category) : '';
  });

  /** Coverage caveats that matter for one listing. Null when coverage says nothing worth adding. */
  readonly coverageNote = computed(() => {
    const view = describeCoverage(this.coverage(), 1, false);
    return view.kind === 'none' ? null : view.message;
  });

  constructor() {
    afterNextRender(() => {
      if (this.autoFocus()) this.heading()?.nativeElement.focus();
    });
  }

  focus(): void {
    this.heading()?.nativeElement.focus();
  }
}

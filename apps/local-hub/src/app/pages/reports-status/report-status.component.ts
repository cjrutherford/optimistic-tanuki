import { DatePipe } from '@angular/common';
import { Component, inject, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import type {
  ListingReportReceiptStatus,
  ListingReportStatus,
} from '@optimistic-tanuki/social-contracts';
import { DirectoryService } from '../../services/directory.service';

export const REPORT_STATUS_COPY: Record<
  ListingReportStatus,
  { label: string; text: string }
> = {
  received: {
    label: 'Received',
    text: 'Your report is in the queue for a reviewer.',
  },
  under_review: {
    label: 'Under review',
    text: 'A reviewer is looking at your report.',
  },
  resolved: {
    label: 'Resolved',
    text: 'A reviewer has finished with your report and acted on it.',
  },
  declined: {
    label: 'Declined',
    text: 'A reviewer looked at your report and made no change to the listing.',
  },
};

/** Public lookup of a report by its receipt code. The code is a secret, so it never goes in the URL. */
@Component({
  selector: 'app-report-status',
  standalone: true,
  imports: [FormsModule, RouterLink, DatePipe],
  template: `
    <main class="status-page" aria-labelledby="status-title">
      <h1 id="status-title">Check a report status</h1>
      <form (ngSubmit)="lookup()" novalidate>
        <label for="receipt-code">Receipt code</label>
        <input
          id="receipt-code"
          name="receipt"
          type="text"
          autocomplete="off"
          spellcheck="false"
          [ngModel]="code()"
          (ngModelChange)="code.set($event)"
        />
        <button
          type="submit"
          [disabled]="loading()"
          [attr.aria-busy]="loading() ? 'true' : 'false'"
        >
          {{ loading() ? 'Checking…' : 'Check status' }}
        </button>
      </form>
      <div role="status" class="status-page__result">
        @if (message()) {
        <p>{{ message() }}</p>
        } @if (result(); as r) {
        <h2>{{ copy(r.status).label }}</h2>
        <p>{{ copy(r.status).text }}</p>
        <p class="status-page__date">
          Submitted
          <time [attr.datetime]="r.createdAt">{{
            r.createdAt | date : 'mediumDate'
          }}</time>
        </p>
        }
      </div>
      <p><a routerLink="/cities">Browse towns</a></p>
    </main>
  `,
  styles: [
    `
      .status-page {
        max-width: 48rem;
        margin: 0 auto;
        padding: 2rem 1.5rem 5rem;
        color: var(--foreground);
        font-family: var(--font-body, inherit);
        font-size: var(--type-body, 1rem);
        line-height: var(--line-height, 1.5);
      }
      h1 {
        font-family: var(--font-heading, inherit);
        font-size: var(--type-h2, 1.75rem);
        line-height: var(--heading-line-height, 1.2);
      }
      h2 {
        font-size: var(--type-h4, 1.1rem);
      }
      label {
        display: block;
        font-weight: 600;
      }
      input {
        box-sizing: border-box;
        width: 100%;
        margin: 0.25rem 0 1rem;
        padding: 0.5rem 0.75rem;
        border: 1px solid var(--border, currentColor);
        border-radius: var(--personality-input-radius, 0.375rem);
        background: var(--background);
        color: var(--foreground);
        font-family: var(--font-mono, monospace);
        font-size: var(--type-body, 1rem);
      }
      button {
        padding: 0.5rem 1rem;
        border: 1px solid var(--primary);
        border-radius: var(--personality-input-radius, 0.375rem);
        background: var(--primary);
        color: var(--on-primary, var(--background));
        font: inherit;
        cursor: pointer;
      }
      button[disabled] {
        opacity: 0.6;
        cursor: progress;
      }
      input:focus-visible,
      button:focus-visible,
      a:focus-visible {
        outline: 2px solid var(--primary);
        outline-offset: 2px;
      }
      a {
        color: var(--primary-text, var(--primary));
      }
      .status-page__result {
        margin: 1.5rem 0;
      }
      .status-page__date {
        font-size: var(--type-small, 0.875rem);
      }
      @media (prefers-reduced-motion: reduce) {
        * {
          transition: none !important;
          animation: none !important;
        }
      }
    `,
  ],
})
export class ReportStatusComponent {
  private directoryService = inject(DirectoryService);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);

  code = signal(this.initialCode());
  loading = signal(false);
  message = signal('');
  result = signal<ListingReportReceiptStatus | null>(null);

  private initialCode(): string {
    const fromNav = this.router.getCurrentNavigation()?.extras.state?.[
      'receipt'
    ] as unknown;
    if (typeof fromNav === 'string') return fromNav;
    if (isPlatformBrowser(this.platformId)) {
      const fromHistory = (history.state as { receipt?: unknown } | null)
        ?.receipt;
      if (typeof fromHistory === 'string') return fromHistory;
    }
    return '';
  }

  copy(status: ListingReportStatus): { label: string; text: string } {
    return REPORT_STATUS_COPY[status] ?? REPORT_STATUS_COPY.received;
  }

  async lookup(): Promise<void> {
    const receipt = this.code().trim();
    this.result.set(null);
    if (!receipt) {
      this.message.set('Enter the receipt code you were given.');
      return;
    }
    this.loading.set(true);
    this.message.set('');
    try {
      const found = await this.directoryService.getReportStatus(receipt);
      if (found) this.result.set(found);
      else this.message.set("We couldn't find a report with that code.");
    } catch {
      this.message.set("We couldn't check that report. Please try again.");
    } finally {
      this.loading.set(false);
    }
  }
}

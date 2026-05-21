import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import {
  BusinessApiService,
  BusinessLeadIntakeRecord,
} from '@optimistic-tanuki/business-data-access';
import { ButtonComponent, CardComponent } from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'business-owner-requests-page',
  standalone: true,
  imports: [CommonModule, ButtonComponent, CardComponent],
  template: `
    <section class="queue-studio">
      <otui-card class="queue-hero">
        <div class="queue-hero-copy">
          <p class="eyebrow">Owner Queue</p>
          <h1>Review new relationships and move active work forward.</h1>
          <p class="hero-body">
            Prospects need a response first. Bookings need a scheduling decision next. This workspace separates those jobs clearly.
          </p>
        </div>
        <div class="hero-metrics">
          <div class="hero-metric">
            <span>Needs response</span>
            <strong>{{ prospects().length }}</strong>
          </div>
          <div class="hero-metric">
            <span>Scheduling pipeline</span>
            <strong>{{ bookings().length }}</strong>
          </div>
        </div>
      </otui-card>

      <div class="queue-grid">
      <otui-card class="queue-card">
        <div class="section-head">
          <div>
            <p class="eyebrow">Needs response</p>
            <h2>Prospects</h2>
          </div>
          <span class="section-count">{{ prospects().length }}</span>
        </div>
        <div class="rows">
          @for (prospect of prospects(); track prospect.id) {
            <article class="queue-row prospect-row">
              <div class="queue-main">
                <div class="row-topline">
                  <strong>{{ prospect.name }}</strong>
                  <span class="status-pill">{{ prospect.status }}</span>
                </div>
                <p class="meta-line">{{ prospect.email || 'No email' }} · {{ prospect.phone || 'No phone' }}</p>
                <p class="meta-line">{{ prospect.accountStatus }} · {{ prospect.source }}</p>
                <p class="note-block">{{ prospect.notes || 'No intake notes provided.' }}</p>
              </div>
              <div class="actions stack-actions">
                <otui-button variant="primary" (action)="approveProspect(prospect.id)">
                  Accept client
                </otui-button>
                <otui-button variant="outlined" (action)="markProspectContacted(prospect.id)">
                  Mark contacted
                </otui-button>
              </div>
            </article>
          } @empty {
            <p class="empty">No prospects are waiting.</p>
          }
        </div>
      </otui-card>

      <otui-card class="queue-card">
        <div class="section-head">
          <div>
            <p class="eyebrow">Scheduling pipeline</p>
            <h2>Bookings</h2>
          </div>
          <span class="section-count">{{ bookings().length }}</span>
        </div>
        <div class="rows">
          @for (booking of bookings(); track booking.id) {
            <article class="queue-row booking-row">
              <div class="queue-main">
                <div class="row-topline">
                  <strong>{{ booking.title }}</strong>
                  <span class="status-pill">{{ booking.status }}</span>
                </div>
                <p class="meta-line">{{ formatWindow(booking.startTime, booking.endTime) }}</p>
                <p class="meta-line">{{ booking.userId }}</p>
                <p class="note-block">{{ booking.description || 'No client context provided.' }}</p>
                @if (booking.totalCost) {
                  <p class="invoice-line">{{ invoiceTotalLabel(booking.totalCost) }}</p>
                }
              </div>
              <div class="actions stack-actions">
                <otui-button variant="outlined" (action)="approve(booking.id)">Approve</otui-button>
                <otui-button variant="outlined" (action)="complete(booking.id)">Complete</otui-button>
                <otui-button variant="outlined" (action)="invoice(booking.id)">Invoice</otui-button>
              </div>
            </article>
          } @empty {
            <p class="empty">No session requests are waiting.</p>
          }
        </div>
      </otui-card>
      </div>
    </section>
  `,
  styles: [
    `
      .queue-studio,
      .queue-grid,
      .rows {
        display: grid;
        gap: 1rem;
      }
      .queue-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .queue-hero,
      .queue-card {
        display: grid;
        gap: 1rem;
      }
      .queue-hero {
        padding: 1.35rem;
        border-radius: 1.6rem;
        background:
          radial-gradient(circle at top left, color-mix(in srgb, var(--primary, #1f7a63) 14%, transparent), transparent 36%),
          linear-gradient(135deg, color-mix(in srgb, var(--primary, #1f7a63) 8%, white), var(--background, #fff));
      }
      .queue-hero-copy,
      .queue-main {
        display: grid;
        gap: 0.45rem;
      }
      .hero-body,
      .meta-line,
      .note-block,
      .empty {
        color: var(--muted);
      }
      .hero-metrics {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.75rem;
      }
      .hero-metric,
      .queue-row {
        display: grid;
        gap: 1rem;
        padding: 1rem;
        border: 1px solid var(--border);
        border-radius: 1rem;
        background: color-mix(in srgb, var(--background, #fff) 95%, white);
      }
      .hero-metric strong {
        font-size: 2rem;
        font-family: var(--font-heading, 'Baskervville', serif);
      }
      .section-head,
      .row-topline {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
      }
      .section-count,
      .status-pill {
        padding: 0.35rem 0.65rem;
        border-radius: 999px;
        border: 1px solid color-mix(in srgb, var(--primary, #1f7a63) 35%, var(--border));
        background: color-mix(in srgb, var(--primary, #1f7a63) 10%, transparent);
        color: var(--primary, #1f7a63);
        font-size: 0.78rem;
        font-weight: 700;
        text-transform: capitalize;
      }
      .actions {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
      .stack-actions {
        align-content: start;
      }
      .eyebrow {
        margin: 0;
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--primary, #1f7a63);
      }
      h1,
      h2 {
        margin: 0;
        font-family: var(--font-heading, 'Baskervville', serif);
      }
      p {
        margin: 0;
      }
      .invoice-line {
        font-weight: 700;
        color: var(--primary, #1f7a63);
      }
      @media (max-width: 980px) {
        .queue-grid,
        .hero-metrics {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class BusinessOwnerRequestsPageComponent {
  private readonly api = inject(BusinessApiService);
  readonly prospects = signal<BusinessLeadIntakeRecord[]>([]);
  readonly bookings = signal<any[]>([]);

  constructor() {
    this.loadProspects();
    this.loadBookings();
  }

  approve(id: string): void {
    this.api.approveBooking(id).subscribe(() => {
      this.loadBookings();
    });
  }

  complete(id: string): void {
    this.api.completeBooking(id).subscribe(() => {
      this.loadBookings();
    });
  }

  invoice(id: string): void {
    this.api.generateInvoice(id).subscribe(() => {
      this.loadBookings();
    });
  }

  markProspectContacted(id: string): void {
    this.api.markProspectContacted(id).subscribe(() => {
      this.loadProspects();
    });
  }

  approveProspect(id: string): void {
    this.api.approveProspect(id).subscribe(() => {
      this.loadProspects();
    });
  }

  private loadProspects(): void {
    this.api.getOwnerProspects().subscribe((prospects) => {
      this.prospects.set(prospects);
    });
  }

  private loadBookings(): void {
    this.api.getOwnerBookings().subscribe((bookings) => {
      this.bookings.set(bookings);
    });
  }

  formatWindow(startTime: string | Date | undefined, endTime: string | Date | undefined): string {
    if (!startTime || !endTime) {
      return 'Schedule pending';
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return 'Schedule pending';
    }

    return `${start.toLocaleString()} - ${end.toLocaleString()}`;
  }

  invoiceTotalLabel(totalCost: number | undefined): string {
    return `Invoice total: $${totalCost ?? 0}`;
  }
}

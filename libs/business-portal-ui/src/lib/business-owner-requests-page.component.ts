import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  BusinessApiService,
  BusinessOwnerWorkflowRecord,
} from '@optimistic-tanuki/business-data-access';
import { ButtonComponent, CardComponent } from '@optimistic-tanuki/common-ui';

type WorkflowSection = {
  key:
    | 'needs_response'
    | 'ready_to_schedule'
    | 'needs_invoicing'
    | 'active_clients';
  eyebrow: string;
  heading: string;
  items: BusinessOwnerWorkflowRecord[];
};

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
            Intake, scheduling, and billing now share one operating view so the
            next owner action is always visible.
          </p>
        </div>
        <div class="hero-metrics">
          <div class="hero-metric">
            <span>Needs response</span>
            <strong>{{ needsResponse().length }}</strong>
          </div>
          <div class="hero-metric">
            <span>Ready to schedule</span>
            <strong>{{ readyToSchedule().length }}</strong>
          </div>
          <div class="hero-metric">
            <span>Needs invoicing</span>
            <strong>{{ needsInvoicing().length }}</strong>
          </div>
          <div class="hero-metric">
            <span>Active clients</span>
            <strong>{{ activeClients().length }}</strong>
          </div>
        </div>
      </otui-card>

      <div class="queue-grid">
        @for (section of sections(); track section.key) {
        <otui-card class="queue-card">
          <div class="section-head">
            <div>
              <p class="eyebrow">{{ section.eyebrow }}</p>
              <h2>{{ section.heading }}</h2>
            </div>
            <span class="section-count">{{ section.items.length }}</span>
          </div>

          <div class="rows">
            @for (item of section.items; track item.id) {
            <article class="queue-row">
              <div class="queue-main">
                <div class="row-topline">
                  <strong>{{ item.title }}</strong>
                  <span class="status-pill">{{ item.statusLabel }}</span>
                </div>
                @if (item.subtitle) {
                <p class="meta-line">{{ item.subtitle }}</p>
                } @for (detail of item.details; track detail) {
                <p class="meta-line">{{ detail }}</p>
                }
                <p class="note-block">{{ item.nextAction }}</p>
              </div>
              <div class="actions stack-actions">
                @switch (item.primaryAction) { @case ('accept_client') {
                <otui-button
                  variant="primary"
                  (action)="approveProspect(item.leadId ?? '')"
                >
                  Accept client
                </otui-button>
                <otui-button
                  variant="outlined"
                  (action)="markProspectContacted(item.leadId ?? '')"
                >
                  Mark contacted
                </otui-button>
                } @case ('approve_booking') {
                <otui-button
                  variant="outlined"
                  (action)="approve(item.bookingId ?? '')"
                >
                  Approve booking
                </otui-button>
                } @case ('complete_booking') {
                <otui-button
                  variant="outlined"
                  (action)="complete(item.bookingId ?? '')"
                >
                  Mark complete
                </otui-button>
                } @case ('generate_invoice') {
                <otui-button
                  variant="outlined"
                  (action)="invoice(item.bookingId ?? '')"
                >
                  Generate invoice
                </otui-button>
                } }
              </div>
            </article>
            } @empty {
            <p class="empty">No items are waiting in this section.</p>
            }
          </div>
        </otui-card>
        }
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
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
      .queue-hero,
      .queue-card {
        display: grid;
        gap: 1rem;
      }
      .queue-hero {
        padding: 1.35rem;
        border-radius: 1.6rem;
        background: radial-gradient(
            circle at top left,
            color-mix(in srgb, var(--primary) 14%, transparent),
            transparent 36%
          ),
          linear-gradient(
            135deg,
            color-mix(in srgb, var(--primary) 8%, white),
            var(--background)
          );
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
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0.75rem;
      }
      .hero-metric,
      .queue-row {
        display: grid;
        gap: 1rem;
        padding: 1rem;
        border: 1px solid var(--border);
        border-radius: 1rem;
        background: color-mix(in srgb, var(--background) 95%, white);
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
        border: 1px solid color-mix(in srgb, var(--primary) 35%, var(--border));
        background: color-mix(in srgb, var(--primary) 10%, transparent);
        color: var(--primary);
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
        color: var(--primary);
      }
      h1,
      h2 {
        margin: 0;
        font-family: var(--font-heading, 'Baskervville', serif);
      }
      p {
        margin: 0;
      }
      @media (max-width: 1100px) {
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
  private readonly route = inject(ActivatedRoute, { optional: true });
  readonly workflow = signal<BusinessOwnerWorkflowRecord[]>([]);
  readonly needsResponse = computed(() =>
    this.workflow().filter((item) => item.bucket === 'needs_response')
  );
  readonly readyToSchedule = computed(() =>
    this.workflow().filter((item) => item.bucket === 'ready_to_schedule')
  );
  readonly needsInvoicing = computed(() =>
    this.workflow().filter((item) => item.bucket === 'needs_invoicing')
  );
  readonly activeClients = computed(() =>
    this.workflow().filter((item) => item.bucket === 'active_clients')
  );
  readonly sections = computed<WorkflowSection[]>(() => [
    {
      key: 'needs_response',
      eyebrow: 'Needs response',
      heading: 'Needs response',
      items: this.needsResponse(),
    },
    {
      key: 'ready_to_schedule',
      eyebrow: 'Ready to schedule',
      heading: 'Ready to schedule',
      items: this.readyToSchedule(),
    },
    {
      key: 'needs_invoicing',
      eyebrow: 'Needs invoicing',
      heading: 'Needs invoicing',
      items: this.needsInvoicing(),
    },
    {
      key: 'active_clients',
      eyebrow: 'Active clients',
      heading: 'Active clients',
      items: this.activeClients(),
    },
  ]);

  constructor() {
    this.loadWorkflow();
  }

  approve(id: string): void {
    if (!id) {
      return;
    }

    this.api.approveBooking(id).subscribe(() => {
      this.loadWorkflow();
    });
  }

  complete(id: string): void {
    if (!id) {
      return;
    }

    this.api.completeBooking(id).subscribe(() => {
      this.loadWorkflow();
    });
  }

  invoice(id: string): void {
    if (!id) {
      return;
    }

    this.api.generateInvoice(id).subscribe(() => {
      this.loadWorkflow();
    });
  }

  markProspectContacted(id: string): void {
    if (!id) {
      return;
    }

    this.api.markProspectContacted(id).subscribe(() => {
      this.loadWorkflow();
    });
  }

  approveProspect(id: string): void {
    if (!id) {
      return;
    }

    this.api.approveProspect(id).subscribe(() => {
      this.loadWorkflow();
    });
  }

  private loadWorkflow(): void {
    const siteSlug = this.route?.snapshot.paramMap.get('siteSlug') ?? null;
    this.api.getOwnerWorkflow(siteSlug).subscribe((workflow) => {
      this.workflow.set(workflow);
    });
  }
}

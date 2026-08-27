import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { switchMap, of } from 'rxjs';
import {
  BusinessApiService,
  BusinessAuthService,
  BusinessSiteConfigStore,
  injectSiteSlugSignal,
} from '@optimistic-tanuki/business-data-access';
import { CardComponent } from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'business-client-dashboard-page',
  standalone: true,
  imports: [CommonModule, RouterLink, CardComponent],
  template: `
    <section class="dashboard">
      <otui-card class="overview">
        <p class="eyebrow">Current business</p>
        <h2>{{ siteConfig.site().brand.businessName }}</h2>
        <p class="support-copy">{{ siteConfig.site().brand.tagline }}</p>
        <p class="support-copy">
          Start here when you need the next scheduled touchpoint, assigned work,
          or a fast route back into booking.
        </p>
        <div class="actions">
          <a class="cta-primary" [routerLink]="bookingRoute()"
            >Request coaching</a
          >
          <a class="cta-secondary" [routerLink]="portalHomeRoute()"
            >Portal home</a
          >
        </div>
      </otui-card>

      <section class="grid">
        <otui-card class="stat">
          <span>Upcoming sessions</span>
          <strong>{{ bookings().length }}</strong>
        </otui-card>
        @if (siteConfig.site().features.clientTasks.enabled) {
        <otui-card class="stat">
          <span>Assigned routines</span>
          <strong>{{ routines().length }}</strong>
        </otui-card>
        <otui-card class="stat">
          <span>Recent check-ins</span>
          <strong>{{ checkIns().length }}</strong>
        </otui-card>
        }
      </section>

      <otui-card class="business-directory">
        <div class="section-head">
          <div>
            <p class="eyebrow">Explore more</p>
            <h3>Other businesses you can work with</h3>
          </div>
        </div>

        <div class="directory-list">
          @for (business of additionalBusinesses(); track business.slug) {
          <a class="business-link" [routerLink]="['/sites', business.slug]">
            <strong>{{ business.businessName }}</strong>
            <span>{{ business.tagline }}</span>
          </a>
          } @empty {
          <p class="empty">
            More businesses will appear here as they publish their sites.
          </p>
          }
        </div>
      </otui-card>
    </section>
  `,
  styles: [
    `
      .dashboard {
        display: grid;
        gap: 1rem;
      }

      .overview,
      .business-directory {
        display: grid;
        gap: 0.85rem;
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 1rem;
      }

      .stat {
        display: grid;
        gap: 0.45rem;
      }

      .eyebrow {
        margin: 0;
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--primary);
      }

      .support-copy,
      .empty,
      .business-link span {
        margin: 0;
        color: var(--muted);
      }

      .actions {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
      }

      .cta-primary,
      .cta-secondary,
      .business-link {
        text-decoration: none;
      }

      .cta-primary,
      .cta-secondary {
        padding: 0.75rem 1rem;
        border-radius: var(--personality-button-radius, 999px);
        font-weight: 700;
      }

      .cta-primary {
        background: var(--primary);
        color: var(--primary-foreground);
      }

      .cta-secondary {
        border: var(--personality-border-width, 1px) solid var(--border);
        color: var(--foreground);
      }

      .section-head h3,
      .overview h2 {
        margin: 0;
      }

      .directory-list {
        display: grid;
        gap: 0.75rem;
      }

      .business-link {
        display: grid;
        gap: 0.2rem;
        padding: 0.85rem 1rem;
        border: 1px solid var(--border);
        border-radius: 1rem;
        color: var(--foreground);
      }

      span {
        color: var(--muted);
      }

      strong {
        font-size: 2.3rem;
        font-family: 'Instrument Serif', serif;
        font-weight: 400;
      }

      .business-link strong {
        font-size: 1rem;
        font-family: inherit;
        font-weight: 700;
      }
    `,
  ],
})
export class BusinessClientDashboardPageComponent {
  private readonly api = inject(BusinessApiService);
  private readonly auth = inject(BusinessAuthService);
  protected readonly siteConfig = inject(BusinessSiteConfigStore);
  readonly siteSlug = injectSiteSlugSignal();
  private readonly clientId = computed(
    () => this.auth.clientUser()?.userId ?? ''
  );
  readonly bookings = toSignal(
    toObservable(this.clientId).pipe(
      switchMap((id) =>
        id ? this.api.getClientBookings(this.siteSlug()) : of([])
      )
    ),
    { initialValue: [] }
  );
  readonly routines = toSignal(
    toObservable(this.clientId).pipe(
      switchMap((id) =>
        id ? this.api.getClientRoutines(id, this.siteSlug()) : of([])
      )
    ),
    { initialValue: [] }
  );
  readonly checkIns = toSignal(
    toObservable(this.clientId).pipe(
      switchMap((id) =>
        id ? this.api.getClientCheckIns(id, this.siteSlug()) : of([])
      )
    ),
    { initialValue: [] }
  );
  readonly publishedBusinesses = toSignal(this.api.listPublishedSites(), {
    initialValue: [],
  });
  readonly additionalBusinesses = computed(() =>
    this.publishedBusinesses().filter(
      (business) => business.slug !== this.siteSlug()
    )
  );

  bookingRoute(): string[] {
    const siteSlug = this.siteSlug();
    return siteSlug ? ['/sites', siteSlug, 'book'] : ['/'];
  }

  portalHomeRoute(): string[] {
    const siteSlug = this.siteSlug();
    return siteSlug ? ['/sites', siteSlug, 'client'] : ['/client'];
  }

  constructor() {
    this.siteConfig.fetch(false, this.siteSlug()).subscribe();
  }
}

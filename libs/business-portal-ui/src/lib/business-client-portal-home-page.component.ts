import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EMPTY, catchError } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  BusinessApiService,
  BusinessAuthService,
  BusinessClientBookingStatus,
  BusinessSiteConfigStore,
} from '@optimistic-tanuki/business-data-access';
import { CardComponent } from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'business-client-portal-home-page',
  standalone: true,
  imports: [CommonModule, RouterLink, CardComponent],
  template: `
    <section class="hero">
      <otui-card class="copy">
        <p class="eyebrow">Client Portal</p>
        <h2>{{ site().clientPortal.headline }}</h2>
        <p>{{ nextActionCopy() }}</p>
        <p class="portal-note">
          Use the portal as the single place for sessions, assigned routines,
          and the next action your business expects from you.
        </p>
        <div class="actions">
          <a class="cta-primary" [routerLink]="dashboardRoute()"
            >Open dashboard</a
          >
          <a class="cta-secondary" [routerLink]="bookingRoute()">{{
            consultationCtaLabel()
          }}</a>
        </div>
      </otui-card>

      <otui-card>
        <h3>Inside the portal</h3>
        <ul>
          @for (item of site().clientPortal.capabilities; track item) {
          <li>{{ item }}</li>
          }
        </ul>
      </otui-card>
    </section>
  `,
  styles: [
    `
      .hero {
        display: grid;
        grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.9fr);
        gap: 1rem;
      }
      .eyebrow {
        margin: 0 0 0.35rem;
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--primary, #1f7a63);
      }
      h2,
      h3 {
        margin: 0;
        font-family: var(
          --font-heading,
          'Source Sans Pro',
          system-ui,
          sans-serif
        );
        font-weight: 700;
      }
      ul {
        display: grid;
        gap: 1rem;
        margin: 0;
        padding-left: 1.1rem;
        color: color-mix(in srgb, var(--foreground, #0f172a) 74%, transparent);
      }
      .actions {
        display: flex;
        gap: 0.8rem;
        flex-wrap: wrap;
        margin-top: 1rem;
      }
      .portal-note {
        margin-top: 0.35rem;
      }
      .cta-primary,
      .cta-secondary {
        text-decoration: none;
        padding: var(--personality-button-padding, 0.85rem 1rem);
        border-radius: var(--personality-button-radius, 999px);
        font-weight: 700;
      }
      .cta-primary {
        background: var(--primary, #1f7a63);
        color: var(--primary-foreground, white);
      }
      .cta-secondary {
        border: var(--personality-border-width, 1px) solid var(--border);
      }
      @media (max-width: 900px) {
        .hero {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class BusinessClientPortalHomePageComponent {
  private readonly api = inject(BusinessApiService);
  private readonly auth = inject(BusinessAuthService);
  private readonly siteConfig = inject(BusinessSiteConfigStore);
  private readonly route = inject(ActivatedRoute, { optional: true });
  private readonly destroyRef = inject(DestroyRef);
  readonly site = this.siteConfig.site;
  readonly siteSlug = this.route?.snapshot.paramMap.get('siteSlug') ?? null;
  readonly clientStatus = signal<BusinessClientBookingStatus | null>(null);
  readonly consultationCtaLabel = computed(() =>
    this.clientStatus()?.accepted ? 'Book session' : 'Request consultation'
  );
  readonly nextActionCopy = computed(
    () =>
      this.clientStatus()?.nextAction || this.site().clientPortal.description
  );

  dashboardRoute(): string[] {
    return this.siteSlug
      ? ['/sites', this.siteSlug, 'client', 'dashboard']
      : ['/client/dashboard'];
  }

  bookingRoute(): string[] {
    return this.siteSlug ? ['/sites', this.siteSlug, 'book'] : ['/'];
  }

  constructor() {
    this.siteConfig.fetch(false, this.siteSlug).subscribe();

    effect(() => {
      if (!this.auth.clientUser()) {
        this.clientStatus.set(null);
        return;
      }

      this.api
        .getClientBookingStatus(this.siteSlug)
        .pipe(
          catchError(() => {
            this.clientStatus.set(null);
            return EMPTY;
          }),
          takeUntilDestroyed(this.destroyRef)
        )
        .subscribe((status) => {
          this.clientStatus.set(status);
        });
    });
  }
}

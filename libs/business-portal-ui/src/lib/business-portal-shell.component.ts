import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import {
  ActivatedRoute,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import {
  BusinessSiteConfigStore,
  injectSiteSlugSignal,
} from '@optimistic-tanuki/business-data-access';

@Component({
  selector: 'business-portal-shell',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <section class="shell">
      <header class="hero entrance">
        <div class="hero-text">
          <p class="eyebrow">{{ route.snapshot.data['portalLabel'] }}</p>
          <h1>{{ route.snapshot.data['portalDescription'] }}</h1>
        </div>
        <nav class="subnav">
          @for (link of links(); track link.path; let i = $index) {
          <a
            [routerLink]="link.path"
            routerLinkActive="active"
            class="subnav-link"
            [style.animation-delay]="0.06 * i + 's'"
            >{{ link.label }}</a
          >
          }
        </nav>
      </header>
      <div class="content-area">
        <router-outlet></router-outlet>
      </div>
    </section>
  `,
  styles: [
    `
      @keyframes entrance-up {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes link-pop {
        from {
          opacity: 0;
          transform: scale(0.92);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }

      .shell {
        display: grid;
        gap: 1.25rem;
      }

      .entrance {
        animation: entrance-up 0.55s cubic-bezier(0.22, 1, 0.36, 1) forwards;
      }

      .hero {
        display: grid;
        gap: 1.1rem;
        border: var(--personality-border-width, 1px) solid var(--border);
        border-radius: var(--personality-card-radius, 1.5rem);
        background: color-mix(in srgb, var(--background) 96%, white);
        padding: var(--personality-card-padding, 1.5rem);
        box-shadow: var(
          --personality-card-shadow,
          0 18px 44px rgba(15, 23, 42, 0.06)
        );
        position: relative;
        overflow: hidden;
      }

      .hero::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: linear-gradient(
          90deg,
          var(--primary),
          color-mix(in srgb, var(--secondary) 70%, var(--primary)),
          var(--primary)
        );
        opacity: 0.6;
      }

      .hero-text {
        position: relative;
        z-index: 1;
      }

      .eyebrow {
        margin: 0 0 0.35rem;
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--primary);
      }

      h1 {
        margin: 0;
        font-family: var(
          --font-heading,
          'Source Sans Pro',
          system-ui,
          sans-serif
        );
        font-size: clamp(1.4rem, 2.8vw, 2.2rem);
        font-weight: 700;
        color: var(--foreground);
        line-height: 1.15;
      }

      .subnav {
        display: flex;
        gap: 0.55rem;
        flex-wrap: wrap;
        position: relative;
        z-index: 1;
      }

      .subnav-link {
        padding: 0.65rem 1rem;
        border-radius: var(--personality-button-radius, 999px);
        text-decoration: none;
        border: var(--personality-border-width, 1px) solid var(--border);
        color: color-mix(in srgb, var(--foreground) 72%, transparent);
        font-size: 0.88rem;
        font-weight: 500;
        background: var(--background);
        transition: background 0.2s ease, color 0.2s ease,
          border-color 0.2s ease,
          transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease;
        animation: link-pop 0.4s cubic-bezier(0.22, 1, 0.36, 1) backwards;
        will-change: transform;
      }

      .subnav-link:hover {
        transform: translateY(-2px);
        border-color: color-mix(in srgb, var(--primary) 35%, var(--border));
        box-shadow: 0 6px 16px
          color-mix(in srgb, var(--primary) 8%, rgba(0, 0, 0, 0.04));
        color: var(--foreground);
      }

      .subnav-link.active {
        background: color-mix(in srgb, var(--primary) 12%, transparent);
        border-color: color-mix(in srgb, var(--primary) 50%, var(--border));
        color: var(--primary);
        font-weight: 600;
      }

      .content-area {
        position: relative;
        z-index: 1;
      }
    `,
  ],
})
export class BusinessPortalShellComponent {
  readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly siteConfig = inject(BusinessSiteConfigStore);
  private readonly siteSlug = injectSiteSlugSignal();

  private ownerPath(path?: string): string {
    const siteSlug = this.siteSlug();
    return siteSlug
      ? ['/sites', siteSlug, 'owner', path].filter(Boolean).join('/')
      : ['/owner', path].filter(Boolean).join('/');
  }

  private clientPath(path?: string): string {
    const siteSlug = this.siteSlug();
    return siteSlug
      ? ['/sites', siteSlug, 'client', path].filter(Boolean).join('/')
      : ['/client', path].filter(Boolean).join('/');
  }

  readonly links = computed(() =>
    this.router.url.includes('/client') && !this.router.url.startsWith('/owner')
      ? [
          { path: this.clientPath(), label: 'Overview' },
          { path: this.clientPath('dashboard'), label: 'Dashboard' },
          ...(this.siteConfig.site().features.clientTasks.enabled
            ? [{ path: this.clientPath('routines'), label: 'Routines' }]
            : []),
          ...(this.siteConfig.site().features.invoices.enabled
            ? [{ path: this.clientPath('billing'), label: 'Billing' }]
            : []),
        ]
      : [
          { path: this.ownerPath('dashboard'), label: 'Dashboard' },
          { path: this.ownerPath('requests'), label: 'Requests' },
          { path: this.ownerPath('clients'), label: 'Clients' },
          { path: this.ownerPath('availability'), label: 'Availability' },
          { path: this.ownerPath('products'), label: 'Products' },
          ...(this.siteConfig.site().features.invoices.enabled
            ? [
                {
                  path: this.ownerPath('finance/business/invoices'),
                  label: 'Invoices',
                },
                {
                  path: this.ownerPath('finance/business/checkout'),
                  label: 'Checkout',
                },
                {
                  path: this.ownerPath('finance/business/payments'),
                  label: 'Payments',
                },
              ]
            : []),
          { path: this.ownerPath('site'), label: 'Site Editor' },
        ]
  );

  constructor() {
    this.siteConfig.fetch(true, this.siteSlug()).subscribe();
  }
}

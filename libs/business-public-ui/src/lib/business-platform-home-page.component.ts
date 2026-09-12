import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import {
  BusinessApiService,
  BusinessSiteConfigStore,
  type PublicBusinessSiteSummary,
} from '@optimistic-tanuki/business-data-access';
import {
  DiscoveryListComponent,
  DiscoveryRegionComponent,
  LandingHeaderComponent,
  LandingHeroComponent,
  type DiscoveryCard,
  type DiscoveryListState,
  type DiscoveryNavItem,
} from '@optimistic-tanuki/common-ui';
import { catchError, map, of } from 'rxjs';
import {
  BUSINESS_PUBLIC_DARK_ACCENT_TEXT,
  BUSINESS_PUBLIC_LIGHT_ACCENT_TEXT,
} from './public-contrast.tokens';

type PublishedSitesState = {
  state: DiscoveryListState;
  sites: PublicBusinessSiteSummary[];
};

export const businessPlatformHomePageStyles = `
      :host {
        display: grid;
        gap: 2rem;
        box-sizing: border-box;
        min-width: 0;
        max-width: 100%;
        color-scheme: light dark;
        --platform-bg: #f4efe6;
        --platform-bg-alt: #fffaf1;
        --platform-panel: color-mix(
          in srgb,
          var(--foreground, #18241f) 90%,
          var(--primary, #b85c38)
        );
        --platform-ink: #18241f;
        --platform-muted: #425466;
        --platform-accent: var(--primary, #b85c38);
        --platform-accent-text: var(--primary-2, ${BUSINESS_PUBLIC_LIGHT_ACCENT_TEXT});
        --platform-accent-soft: #f4e1d7;
        --platform-panel-ink: var(--on-primary, var(--primary-foreground, #ffffff));
        --platform-card: #ffffff;
        --platform-card-strong: #fff8ee;
        --platform-border: rgba(24, 36, 31, 0.12);
        --platform-shadow: 0 18px 40px rgba(24, 36, 31, 0.08);
      }

      otui-public-landing-header,
      otui-public-landing-hero,
      otui-public-discovery-region {
        display: block;
        box-sizing: border-box;
        min-width: 0;
        max-width: 100%;
      }

      .platform-hero,
      .platform-panel,
      .capability-grid,
      .capability-grid article,
      .directory-section,
      .directory-grid,
      .directory-card {
        box-sizing: border-box;
        min-width: 0;
        max-width: 100%;
      }

      otui-public-landing-header,
      otui-public-landing-hero,
      otui-public-discovery-region {
        --background: var(--platform-bg);
        --surface: var(--platform-card);
        --foreground: var(--platform-ink);
        --muted-foreground: var(--platform-muted);
        --primary: var(--platform-accent);
        --otui-public-landing-brand: var(--platform-accent-text);
        --otui-public-landing-focus: var(--platform-accent-text);
        --on-primary: var(--platform-panel-ink);
        --primary-foreground: var(--platform-panel-ink);
        --border: var(--platform-border);
      }

      :host-context([data-mode='dark']) {
        --platform-bg: color-mix(
          in srgb,
          var(--background, #121814) 92%,
          var(--surface, #1b231f)
        );
        --platform-bg-alt: color-mix(
          in srgb,
          var(--surface, #1b231f) 82%,
          var(--background, #121814)
        );
        --platform-ink: var(--foreground, #edf3ef);
        --platform-accent-text: var(--primary-8, ${BUSINESS_PUBLIC_DARK_ACCENT_TEXT});
        --platform-muted: color-mix(
          in srgb,
          var(--foreground, #edf3ef) 74%,
          transparent
        );
        --platform-accent-soft: color-mix(
          in srgb,
          var(--primary, #d88862) 16%,
          var(--surface, #1b231f)
        );
        --platform-card: color-mix(
          in srgb,
          var(--surface, #1b231f) 88%,
          var(--background, #121814)
        );
        --platform-card-strong: color-mix(
          in srgb,
          var(--surface, #1b231f) 94%,
          var(--background, #121814)
        );
        --platform-border: rgba(237, 243, 239, 0.12);
        --platform-shadow: 0 18px 44px rgba(0, 0, 0, 0.26);
      }

      :host-context([data-mode='light']) {
        --platform-bg: #f4efe6;
        --platform-bg-alt: #fffaf1;
        --platform-ink: #18241f;
        --platform-muted: #425466;
        --platform-accent-soft: #f4e1d7;
        --platform-card: #ffffff;
        --platform-card-strong: #fff8ee;
        --platform-border: rgba(24, 36, 31, 0.12);
        --platform-shadow: 0 18px 40px rgba(24, 36, 31, 0.08);
      }

      .platform-hero {
        display: grid;
        grid-template-columns: 1.4fr 0.9fr;
        gap: 1.5rem;
        padding: clamp(1.5rem, 3vw, 3rem);
        background:
          radial-gradient(
            circle at top left,
            color-mix(in srgb, var(--platform-accent) 18%, transparent),
            transparent 28rem
          ),
          linear-gradient(
            135deg,
            var(--platform-bg-alt) 0%,
            var(--platform-bg) 58%,
            color-mix(in srgb, var(--platform-bg) 84%, var(--platform-accent-soft))
              100%
          );
        border-radius: 2rem;
        color: var(--platform-ink);
        border: 1px solid var(--platform-border);
        box-shadow: var(--platform-shadow);
      }

      .platform-copy h1 {
        margin: 0;
        font: 400 clamp(2.4rem, 6vw, 5.1rem) / 0.94 'Instrument Serif', serif;
        letter-spacing: -0.04em;
        max-width: 11ch;
      }

      .eyebrow,
      .capability-grid p {
        margin: 0 0 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.16em;
        font-size: 0.74rem;
        font-weight: 700;
      }

      .lede,
      .platform-panel span,
      .capability-grid span {
        font: 500 1rem/1.65 'Manrope', sans-serif;
        color: var(--platform-muted);
      }

      .platform-actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.85rem;
      }

      .platform-actions a:focus-visible,
      .public-landing-action:focus-visible,
      .directory-card:focus-visible {
        outline: 3px solid var(--platform-accent-text);
        outline-offset: 3px;
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.85rem;
        margin-top: 1.5rem;
      }

      .actions a {
        text-decoration: none;
        border-radius: 999px;
        padding: 0.82rem 1.2rem;
        font: 700 0.92rem/1 'Manrope', sans-serif;
      }

      .primary {
        background: var(--surface, var(--background, #fff));
        color: var(--platform-panel-ink);
      }

      .secondary {
        background: var(--platform-accent-soft);
        color: var(--platform-ink);
        border: 1px solid var(--platform-border);
      }

      .platform-panel {
        display: grid;
        gap: 1rem;
        padding: 1.35rem;
        border-radius: 1.6rem;
        background: var(--surface, var(--background, #fff));
        color: var(--foreground, var(--platform-ink));
        align-content: start;
      }

      .metric {
        display: grid;
        gap: 0.45rem;
        padding: 1rem;
        border-radius: 1.15rem;
        background: color-mix(
          in srgb,
          var(--foreground, var(--platform-ink)) 8%,
          transparent
        );
      }

      .metric strong,
      .capability-grid h2 {
        font: 600 1.35rem/1.1 'Fraunces', serif;
      }

      .capability-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 1rem;
      }

      .capability-grid article {
        display: grid;
        gap: 0.55rem;
        padding: 1.35rem;
        border-radius: 1.4rem;
        background: var(--platform-card);
        border: 1px solid var(--platform-border);
        box-shadow: var(--platform-shadow);
      }

      .directory-section {
        display: grid;
        gap: 1.25rem;
        padding: 1.5rem;
        border-radius: 1.6rem;
        background: var(--platform-card);
        border: 1px solid var(--platform-border);
        box-shadow: var(--platform-shadow);
      }

      .directory-copy {
        display: grid;
        gap: 0.55rem;
      }

      .directory-copy h2,
      .directory-card h3 {
        margin: 0;
        color: var(--foreground, var(--platform-ink));
        font: 600 1.6rem/1.1 'Fraunces', serif;
      }

      .directory-lede,
      .directory-card span,
      .directory-empty p,
      .directory-card p {
        margin: 0;
        color: var(--platform-muted);
        font: 500 0.98rem/1.6 'Manrope', sans-serif;
      }

      .directory-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 1rem;
      }

      .directory-card {
        display: grid;
        gap: 1rem;
        padding: 1.2rem;
        border-radius: 1.25rem;
        border: 1px solid var(--platform-border);
        background: var(--platform-card-strong);
        color: inherit;
        text-decoration: none;
        box-shadow: 0 10px 24px rgba(24, 36, 31, 0.06);
      }

      .directory-card-copy {
        display: grid;
        gap: 0.45rem;
      }

      .directory-card p {
        text-transform: uppercase;
        letter-spacing: 0.12em;
        font-size: 0.72rem;
        font-weight: 700;
        color: var(--platform-accent-text);
      }

      .directory-card strong {
        color: var(--platform-accent-text);
        font: 700 0.9rem/1 'Manrope', sans-serif;
      }

      .directory-empty {
        padding: 1rem 1.1rem;
        border-radius: 1rem;
        border: 1px dashed var(--platform-border);
      }

      .capability-grid h2 {
        margin: 0;
        color: var(--platform-ink);
      }

      @media (max-width: 900px) {
        .capability-grid,
        .directory-grid {
          grid-template-columns: 1fr;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        *,
        *::before,
        *::after {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          scroll-behavior: auto !important;
          transition-duration: 0.01ms !important;
        }
      }
    `;

@Component({
  selector: 'business-platform-home-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    DiscoveryListComponent,
    DiscoveryRegionComponent,
    LandingHeaderComponent,
    LandingHeroComponent,
  ],
  template: `
    <otui-public-landing-header
      brandLabel="Business Site"
      [navItems]="platformNavigation"
    >
      <div slot="actions" class="platform-actions">
        <a routerLink="/auth">Owner sign in</a>
        <a routerLink="/client/register">Client account</a>
      </div>
    </otui-public-landing-header>

    <otui-public-landing-hero
      eyebrow="Hosted business connection services"
      heading="Launch a client-ready business site without stitching the stack together yourself."
      description="Business Site gives owners a branded public presence, guided onboarding, booking and client flows, and a live editor for the copy clients actually read."
    >
      <div slot="actions" class="platform-actions">
        <a
          class="public-landing-action public-landing-action--primary"
          routerLink="/auth"
          >Start as an owner</a
        >
        <a
          class="public-landing-action public-landing-action--secondary"
          routerLink="/client/register"
          >Client account</a
        >
      </div>
      <div slot="visual" class="platform-panel">
        <div class="metric">
          <strong>Owners</strong>
          <span
            >Onboard with a guided setup, then fine-tune layout, theme, imagery,
            and messaging in the editor.</span
          >
        </div>
        <div class="metric">
          <strong>Clients</strong>
          <span
            >Discover services, request contact, book availability, and enter
            the client workspace from the same experience.</span
          >
        </div>
      </div>
    </otui-public-landing-hero>

    <section class="capability-grid" id="capabilities">
      <article>
        <p>Owner workflow</p>
        <h2>Profile-to-site onboarding</h2>
        <span
          >Convert a normal sign-in into an owner workspace with onboarding
          status, site draft state, and a publish path.</span
        >
      </article>
      <article>
        <p>Content system</p>
        <h2>Live WYSIWYG composition</h2>
        <span
          >Use inline rich editing for marketing sections while keeping
          structured controls for services, themes, and operations.</span
        >
      </article>
      <article>
        <p>Hosted tenancy</p>
        <h2>Tenant-scoped public experiences</h2>
        <span
          >Each owner gets a dedicated hosted site route today, with domain
          mapping and multi-workspace expansion ready later.</span
        >
      </article>
    </section>

    <otui-public-discovery-region
      id="directory"
      eyebrow="Registered businesses"
      heading="Browse the businesses currently published in the platform."
      description="These links resolve to the same hosted tenant routes evaluators use for /sites/<business-slug> verification."
    >
      <otui-public-discovery-list
        [items]="directoryItems()"
        [state]="directoryState()"
        ariaLabel="Published businesses"
        emptyHeadline="No published businesses are available yet."
      />
    </otui-public-discovery-region>
  `,
  styles: [businessPlatformHomePageStyles],
})
export class BusinessPlatformHomePageComponent {
  private readonly api = inject(BusinessApiService);
  private readonly siteConfig = inject(BusinessSiteConfigStore);
  private readonly title = inject(Title);

  readonly platformNavigation: DiscoveryNavItem[] = [
    { label: 'Capabilities', href: '#capabilities' },
    { label: 'Directory', href: '#directory' },
  ];

  private readonly publishedSitesResponse = toSignal(
    this.api.listPublishedSites().pipe(
      map(
        (sites): PublishedSitesState => ({
          state: sites.length ? 'ready' : 'empty',
          sites,
        })
      ),
      catchError(() => of<PublishedSitesState>({ state: 'error', sites: [] }))
    ),
    {
      initialValue: {
        state: 'loading',
        sites: [],
      } as PublishedSitesState,
    }
  );

  readonly directoryState = computed<DiscoveryListState>(
    () => this.publishedSitesResponse().state
  );
  readonly publishedSites = computed(() => this.publishedSitesResponse().sites);
  readonly directoryItems = computed<DiscoveryCard[]>(() =>
    this.publishedSites().map((site) => ({
      id: site.slug,
      eyebrow: site.businessType,
      title: `${site.businessName} · Visit site`,
      description: site.tagline || site.location,
      href: `/sites/${site.slug}`,
    }))
  );

  constructor() {
    // AppComponent also reacts to the shared config signal. While this page is
    // mounted, its platform title must win over any late tenant emission.
    effect(() => {
      this.siteConfig.site();
      this.title.setTitle('Business Site Platform');
    });
  }
}

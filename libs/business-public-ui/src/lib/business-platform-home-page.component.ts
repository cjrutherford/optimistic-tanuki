import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { BusinessApiService } from '@optimistic-tanuki/business-data-access';

export const businessPlatformHomePageStyles = `
      :host {
        display: grid;
        gap: 2rem;
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
        --platform-accent-soft: #f4e1d7;
        --platform-panel-ink: var(--primary-foreground, #f7f1e7);
        --platform-card: #ffffff;
        --platform-card-strong: #fff8ee;
        --platform-border: rgba(24, 36, 31, 0.12);
        --platform-shadow: 0 18px 40px rgba(24, 36, 31, 0.08);
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
      }

      .directory-card strong {
        color: var(--platform-accent);
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
        .platform-hero,
        .capability-grid,
        .directory-grid {
          grid-template-columns: 1fr;
        }
      }
    `;

@Component({
  selector: 'business-platform-home-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="platform-hero">
      <div class="platform-copy">
        <p class="eyebrow">Hosted business connection services</p>
        <h1>
          Launch a client-ready business site without stitching the stack
          together yourself.
        </h1>
        <p class="lede">
          Business Site gives owners a branded public presence, guided
          onboarding, booking and client flows, and a live editor for the copy
          clients actually read.
        </p>
        <div class="actions">
          <a class="primary" routerLink="/auth">Start as an owner</a>
          <a class="secondary" routerLink="/client/register">Client account</a>
        </div>
      </div>
      <div class="platform-panel">
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
    </section>

    <section class="capability-grid">
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

    <section class="directory-section">
      <div class="directory-copy">
        <p class="eyebrow">Registered businesses</p>
        <h2>Browse the businesses currently published in the platform.</h2>
        <p class="directory-lede">
          These links resolve to the same hosted tenant routes evaluators use
          for
          <code>/sites/&lt;business-slug&gt;</code> verification.
        </p>
      </div>

      @if (publishedSites().length) {
      <div class="directory-grid">
        @for (site of publishedSites(); track site.slug) {
        <a class="directory-card" [routerLink]="['/sites', site.slug]">
          <div class="directory-card-copy">
            <p>{{ site.businessType }}</p>
            <h3>{{ site.businessName }}</h3>
            <span>{{ site.tagline || site.location }}</span>
          </div>
          <strong>Visit site</strong>
        </a>
        }
      </div>
      } @else {
      <div class="directory-empty">
        <p>No published businesses are available yet.</p>
      </div>
      }
    </section>
  `,
  styles: [businessPlatformHomePageStyles],
})
export class BusinessPlatformHomePageComponent {
  private readonly api = inject(BusinessApiService);

  private readonly publishedSitesResponse = toSignal(
    this.api.listPublishedSites(),
    { initialValue: [] }
  );

  readonly publishedSites = computed(() => this.publishedSitesResponse());
}

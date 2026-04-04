import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'pg-page-shell',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-shell">
      <header class="page-header">
        <div class="hero-copy">
          <p class="eyebrow">{{ packageName }}</p>
          <h1>{{ title }}</h1>
          <p class="intro">{{ description }}</p>
        </div>

        <aside class="hero-aside">
          <div class="hero-panel">
            <span class="hero-label">Use Case</span>
            <p>Curated implementation reference with live previews and high-signal defaults.</p>
          </div>
          <div class="hero-panel">
            <span class="hero-label">Focus</span>
            <p>Import quickly, compare variants, and understand the exposed inputs before wiring features.</p>
          </div>
        </aside>
      </header>

      <section class="utility-grid">
        <div class="utility-section utility-section-index">
          <div class="section-heading">
            <span class="section-kicker">Jump To</span>
            <h2>Component Index</h2>
          </div>
          <div class="index-strip">
            <ng-content select="[slot=index]"></ng-content>
          </div>
        </div>

        @if (importSnippet) {
        <div class="utility-section utility-section-import">
          <div class="section-heading">
            <span class="section-kicker">Install</span>
            <h2>Import Surface</h2>
          </div>
          <div class="import-panel">
            <pre><code>{{ importSnippet }}</code></pre>
          </div>
        </div>
        }
      </section>

      <section class="catalog-shell">
        <div class="section-heading catalog-heading">
          <span class="section-kicker">Catalog</span>
          <h2>Live Previews</h2>
        </div>

        <section class="catalog">
          <ng-content></ng-content>
        </section>
      </section>
    </div>
  `,
  styles: [
    `
      .page-shell {
        width: min(1320px, 100%);
        margin: 0 auto;
        padding: 2rem 0 4rem;
      }

      .page-header {
        display: grid;
        grid-template-columns: minmax(0, 1.8fr) minmax(260px, 0.95fr);
        gap: 1rem;
        margin-bottom: 1.35rem;
      }

      .hero-copy,
      .hero-panel {
        border: 1px solid rgba(129, 168, 222, 0.12);
        background:
          radial-gradient(circle at top right, rgba(125, 183, 255, 0.12), transparent 35%),
          linear-gradient(180deg, rgba(15, 24, 38, 0.84), rgba(8, 14, 24, 0.94));
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
      }

      .hero-copy {
        padding: 1.35rem 1.4rem 1.45rem;
        border-radius: 1.6rem;
      }

      .hero-aside {
        display: grid;
        gap: 0.85rem;
      }

      .hero-panel {
        padding: 1rem 1rem 1.05rem;
        border-radius: 1.25rem;
      }

      .hero-label,
      .section-kicker,
      .eyebrow {
        display: block;
        color: color-mix(in srgb, var(--primary) 72%, white);
        font: 600 0.72rem/1 'IBM Plex Mono', monospace;
        letter-spacing: 0.16em;
        text-transform: uppercase;
      }

      .eyebrow {
        margin: 0 0 0.75rem;
      }

      h1 {
        margin: 0;
        max-width: 15ch;
        line-height: 0.95;
        letter-spacing: -0.05em;
        font-family: var(--font-heading);
        font-weight: 700;
        font-size: clamp(2.8rem, 6vw, 5.8rem);
      }

      .intro {
        max-width: 56ch;
        margin: 1rem 0 0;
        font-size: 1.02rem;
        line-height: 1.7;
        color: var(--muted);
      }

      .hero-panel p {
        margin: 0.65rem 0 0;
        color: var(--muted);
        font-size: 0.92rem;
        line-height: 1.55;
      }

      .utility-grid {
        display: grid;
        grid-template-columns: minmax(0, 1.35fr) minmax(320px, 0.95fr);
        gap: 1rem;
        margin-bottom: 1.6rem;
      }

      .utility-section,
      .catalog-shell {
        border: 1px solid rgba(129, 168, 222, 0.12);
        border-radius: 1.4rem;
        background: rgba(8, 13, 22, 0.56);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.025);
      }

      .utility-section {
        padding: 1rem;
      }

      .catalog-shell {
        padding: 1rem;
      }

      .section-heading {
        display: grid;
        gap: 0.35rem;
        margin-bottom: 0.85rem;
      }

      .section-heading h2 {
        margin: 0;
        font-family: var(--font-heading);
        font-size: 1.25rem;
        letter-spacing: -0.03em;
      }

      .import-panel {
        padding: 1rem;
        border: 1px solid rgba(129, 168, 222, 0.16);
        border-radius: 1rem;
        background: rgba(5, 10, 18, 0.84);
      }

      pre {
        margin: 0;
        overflow-x: auto;
        color: #d9ebff;
        font-size: 0.85rem;
        line-height: 1.5;
      }

      .index-strip {
        display: flex;
        flex-wrap: wrap;
        gap: 0.8rem;
      }

      .catalog {
        display: grid;
        gap: 1.4rem;
      }

      @media (max-width: 960px) {
        .page-header,
        .utility-grid {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 640px) {
        .page-shell {
          padding-top: 0.9rem;
          padding-bottom: 2.25rem;
        }

        .hero-copy,
        .utility-section,
        .catalog-shell {
          padding: 0.95rem;
        }

        .hero-panel {
          padding: 0.9rem;
        }

        h1 {
          max-width: none;
          font-size: clamp(2.1rem, 10vw, 3rem);
        }

        .intro {
          font-size: 0.96rem;
          line-height: 1.6;
        }

        .section-heading h2 {
          font-size: 1.05rem;
        }

        .index-strip {
          flex-wrap: nowrap;
          overflow-x: auto;
          padding-bottom: 0.25rem;
          mask-image: linear-gradient(90deg, transparent, #000 4%, #000 96%, transparent);
        }

        .import-panel {
          padding: 0.85rem;
          border-radius: 1rem;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageShellComponent {
  @Input() packageName = '';
  @Input() title = '';
  @Input() description = '';
  @Input() importSnippet = '';
}

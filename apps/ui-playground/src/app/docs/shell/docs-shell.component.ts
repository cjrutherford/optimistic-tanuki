import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'pg-docs-shell',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="docs-shell">
      <header class="docs-hero">
        <div class="docs-hero-copy">
          <span class="hero-kicker">Documentation</span>
          <h1>{{ title }}</h1>
          <p>{{ description }}</p>
        </div>
        <div class="docs-hero-meta">
          <ng-content select="[slot=meta]"></ng-content>
        </div>
      </header>

      <section class="docs-content">
        <ng-content></ng-content>
      </section>
    </section>
  `,
  styles: [
    `
      .docs-shell {
        width: min(1320px, 100%);
        margin: 0 auto;
        padding: 1.5rem 0 3rem;
      }

      .docs-hero {
        display: grid;
        grid-template-columns: minmax(0, 1.6fr) minmax(280px, 0.8fr);
        gap: 1rem;
        margin-bottom: 1.2rem;
      }

      .docs-hero-copy,
      .docs-hero-meta,
      .docs-content {
        border: 1px solid rgba(129, 168, 222, 0.12);
        border-radius: 1.45rem;
        background: radial-gradient(
            circle at top right,
            rgba(124, 186, 255, 0.12),
            transparent 35%
          ),
          linear-gradient(180deg, rgba(13, 21, 35, 0.9), rgba(7, 12, 21, 0.95));
        box-shadow: 0 26px 60px rgba(0, 0, 0, 0.22);
      }

      .docs-hero-copy {
        padding: 1.4rem 1.45rem 1.55rem;
      }

      .docs-hero-meta,
      .docs-content {
        padding: 1rem;
      }

      .hero-kicker {
        display: block;
        color: color-mix(in srgb, var(--primary) 72%, white);
        font: 600 0.72rem/1 'IBM Plex Mono', monospace;
        letter-spacing: 0.16em;
        text-transform: uppercase;
      }

      h1 {
        margin: 0.8rem 0 0;
        font-family: var(--font-heading);
        font-size: clamp(2.7rem, 5vw, 5rem);
        line-height: 0.96;
        letter-spacing: -0.06em;
      }

      p {
        max-width: 58ch;
        margin: 0.95rem 0 0;
        color: var(--muted);
        font-size: 1rem;
        line-height: 1.72;
      }

      @media (max-width: 960px) {
        .docs-hero {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocsShellComponent {
  @Input() title = '';
  @Input() description = '';
}

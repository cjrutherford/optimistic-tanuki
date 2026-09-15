import { Component, input } from '@angular/core';

export interface ValueProp {
  title: string;
  body: string;
}

/**
 * What the platform does that a page of notes does not.
 *
 * Deliberately plain. The original landing pages carried an icon per feature
 * and a gradient behind it; that reads as decoration on a product whose whole
 * argument is that it is specific about what it does. The claims here should
 * be checkable, which rules out the ones marketing usually reaches for.
 */
@Component({
  selector: 'otlearn-value-props',
  template: `
    <section class="props">
      @if (heading()) {
      <h2>{{ heading() }}</h2>
      }
      <ul>
        @for (prop of props(); track prop.title) {
        <li>
          <h3>{{ prop.title }}</h3>
          <p>{{ prop.body }}</p>
        </li>
        }
      </ul>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .props {
        padding: 3.5rem 0;
        border-top: var(--lx-border-width) var(--lx-border-style)
          var(--lx-border-soft);
      }
      h2 {
        margin: 0 0 2rem;
        font-family: var(--lx-font-heading);
        font-size: clamp(1.5rem, 3vw, 2.1rem);
        letter-spacing: -0.02em;
      }
      ul {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 1.5rem;
      }
      @media (min-width: 48rem) {
        ul {
          grid-template-columns: repeat(3, 1fr);
          gap: 1.75rem;
        }
      }
      li {
        background-color: var(--lx-surface);
        background-image: var(--lx-surface-texture);
        border: var(--lx-border-width) var(--lx-border-style)
          var(--lx-border-soft);
        border-left: calc(var(--lx-border-width) + 2px) var(--lx-border-style)
          var(--lx-accent);
        border-radius: var(--lx-radius);
        padding: 1.4rem 1.5rem;
        box-shadow: var(--lx-shadow-card);
        transition: var(--lx-btn-transition);
      }
      li:hover {
        border-color: var(--lx-accent);
        box-shadow: var(--lx-shadow-control);
        transform: translate(-1px, -1px);
      }
      h3 {
        margin: 0 0 0.6rem;
        font-family: var(--lx-font-mono, monospace);
        font-size: 0.98rem;
        font-weight: 700;
        line-height: 1.4;
        letter-spacing: -0.01em;
      }
      li p {
        margin: 0;
        line-height: 1.65;
        font-size: 0.92rem;
        color: var(--lx-text-muted);
      }
    `,
  ],
})
export class ValuePropsComponent {
  readonly heading = input<string>('');
  readonly props = input<ValueProp[]>([]);
}

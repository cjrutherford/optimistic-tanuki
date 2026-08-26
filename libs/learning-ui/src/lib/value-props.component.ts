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
        padding: 3rem 0;
        border-top: 1px solid var(--lx-rule, currentColor);
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
        gap: 2rem;
      }
      @media (min-width: 48rem) {
        ul {
          grid-template-columns: repeat(3, 1fr);
          gap: 2.5rem;
        }
      }
      h3 {
        margin: 0 0 0.55rem;
        font-size: 1.02rem;
        font-weight: 700;
      }
      li p {
        margin: 0;
        line-height: 1.65;
        color: var(--lx-text-dim, inherit);
      }
    `,
  ],
})
export class ValuePropsComponent {
  readonly heading = input<string>('');
  readonly props = input<ValueProp[]>([]);
}

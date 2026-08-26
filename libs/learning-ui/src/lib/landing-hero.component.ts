import { Component, input, output } from '@angular/core';

/**
 * The front door's argument.
 *
 * The app opened onto a catalog, which answers "what is here" for somebody who
 * already knows they want it, and answers nothing for anybody else. The
 * original repositories each had a landing page making a case; the port took
 * their lessons and left the case behind.
 *
 * Two calls to action rather than one. Writing a course is the half nothing in
 * the product currently mentions, and it is the half that makes this a
 * platform rather than four courses.
 *
 * Everything here is content passed in. A marketing component that fetches is
 * a marketing component that cannot be rendered in a test or reused on another
 * surface.
 */
@Component({
  selector: 'otlearn-landing-hero',
  template: `
    <section class="hero">
      <div class="argument">
        @if (eyebrow()) {
        <p class="eyebrow">{{ eyebrow() }}</p>
        }
        <h1>{{ headline() }}</h1>
        @if (subhead()) {
        <p class="subhead">{{ subhead() }}</p>
        }
        <div class="actions">
          <button type="button" class="primary" (click)="browse.emit()">
            {{ primaryLabel() }}
          </button>
          <button type="button" class="secondary" (click)="write.emit()">
            {{ secondaryLabel() }}
          </button>
        </div>
        @if (reassurance()) {
        <p class="reassurance">{{ reassurance() }}</p>
        }
      </div>

      <!--
        The product, not a picture of it. A landing page for something you can
        read without an account should show the thing you can read.
      -->
      @if (sampleLesson()) {
      <figure class="sample" aria-label="A lesson from this platform">
        <figcaption>
          <span class="dot" aria-hidden="true"></span>
          {{ sampleLesson()?.courseName }}
        </figcaption>
        <h2>{{ sampleLesson()?.lessonTitle }}</h2>
        <p>{{ sampleLesson()?.excerpt }}</p>
        @if (sampleLesson()?.exerciseTitle) {
        <p class="exercise">
          <span class="label">Then do this</span>
          {{ sampleLesson()?.exerciseTitle }}
        </p>
        }
      </figure>
      }
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .hero {
        display: grid;
        gap: 2.5rem;
        align-items: center;
        padding: 3rem 0 3.5rem;
      }
      @media (min-width: 60rem) {
        .hero {
          grid-template-columns: 1.05fr 0.95fr;
          gap: 3.5rem;
          padding: 4.5rem 0 5rem;
        }
      }

      .eyebrow {
        margin: 0 0 0.9rem;
        font-family: var(--lx-font-mono);
        font-size: 0.72rem;
        font-weight: 600;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: var(--lx-accent);
      }
      h1 {
        margin: 0;
        font-family: var(--lx-font-heading);
        font-size: clamp(2.2rem, 6vw, 3.9rem);
        line-height: 1.03;
        letter-spacing: -0.03em;
        text-wrap: balance;
      }
      .subhead {
        margin: 1.1rem 0 0;
        max-width: 54ch;
        font-size: 1.06rem;
        line-height: 1.6;
        color: var(--lx-text-muted);
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        margin-top: 2rem;
      }
      button {
        font: inherit;
        font-weight: 600;
        padding: 0.8rem 1.4rem;
        border-radius: var(--lx-radius);
        cursor: pointer;
      }
      .primary {
        border: 1px solid var(--lx-accent);
        background: var(--lx-accent);
        color: var(--lx-bg);
      }
      .secondary {
        border: 1px solid var(--lx-border);
        background: transparent;
        color: inherit;
      }
      button:focus-visible {
        outline: 2px solid var(--lx-focus);
        outline-offset: 2px;
      }
      .reassurance {
        margin: 1rem 0 0;
        font-size: 0.86rem;
        color: var(--lx-text-muted);
      }

      .sample {
        margin: 0;
        padding: 1.4rem 1.5rem 1.6rem;
        border: 1px solid var(--lx-border);
        border-radius: var(--lx-radius);
        background: var(--lx-surface);
      }
      figcaption {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-family: var(--lx-font-mono);
        font-size: 0.7rem;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--lx-text-muted);
      }
      .dot {
        width: 0.5rem;
        height: 0.5rem;
        border-radius: 50%;
        background: var(--lx-accent);
      }
      .sample h2 {
        margin: 0.9rem 0 0.6rem;
        font-family: var(--lx-font-heading);
        font-size: 1.35rem;
        letter-spacing: -0.02em;
      }
      .sample p {
        margin: 0;
        line-height: 1.65;
        color: var(--lx-text-muted);
      }
      .exercise {
        margin-top: 1.1rem !important;
        padding-top: 1rem;
        border-top: 1px solid var(--lx-border);
      }
      .exercise .label {
        display: block;
        font-family: var(--lx-font-mono);
        font-size: 0.66rem;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--lx-accent);
        margin-bottom: 0.3rem;
      }
    `,
  ],
})
export class LandingHeroComponent {
  readonly eyebrow = input<string>('');
  readonly headline = input<string>('');
  readonly subhead = input<string>('');
  readonly primaryLabel = input<string>('Browse courses');
  readonly secondaryLabel = input<string>('Write a course');
  /** What a visitor gets without signing up, said plainly under the buttons. */
  readonly reassurance = input<string>('');
  readonly sampleLesson = input<{
    courseName: string;
    lessonTitle: string;
    excerpt: string;
    exerciseTitle?: string;
  } | null>(null);

  readonly browse = output<void>();
  readonly write = output<void>();
}

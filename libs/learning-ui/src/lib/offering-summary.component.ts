import { Component, computed, input, output } from '@angular/core';
import { ButtonComponent } from '@optimistic-tanuki/common-ui';

export interface OfferingPrerequisite {
  offeringId: string;
  displayName: string;
}

/**
 * The course page: what it is, who wrote it, and how to start.
 *
 * This is the screen that was missing. A visitor used to go from a list
 * straight into a forty-module sidebar, with no chance to find out what the
 * course was, what it required, or who wrote it before committing to it.
 *
 * Presentational only. Enrolling and opening are events; this decides nothing
 * about whether either is permitted.
 */
@Component({
  selector: 'otlearn-offering-summary',
  imports: [ButtonComponent],
  template: `
    <section class="summary">
      <header>
        <p class="eyebrow">
          {{ context() }}
          @if (isDraft()) {
          <span class="draft">Draft</span>
          }
        </p>
        <h1>{{ displayName() }}</h1>
        @if (description()) {
        <p class="description">{{ description() }}</p>
        } @else {
        <p class="description muted">This course has no description yet.</p>
        }
      </header>

      @if (audience() || outcome()) {
      <section class="pitch">
        @if (audience()) {
        <div>
          <h2>Who this is for</h2>
          <p>{{ audience() }}</p>
        </div>
        } @if (outcome()) {
        <div>
          <h2>What you will be able to do</h2>
          <p>{{ outcome() }}</p>
        </div>
        }
      </section>
      }

      <dl class="facts">
        <div>
          <dt>Lessons</dt>
          <dd>{{ lessonCount() || 'None yet' }}</dd>
        </div>
        @if (level()) {
        <div>
          <dt>Level</dt>
          <dd>{{ level() }}</dd>
        </div>
        } @if (credits()) {
        <div>
          <dt>Credits</dt>
          <dd>{{ credits() }}</dd>
        </div>
        }
        <div>
          <dt>Written by</dt>
          <dd>{{ authorName() || 'Not recorded' }}</dd>
        </div>
      </dl>

      @if (prerequisites().length) {
      <section class="prerequisites">
        <h2>Take these first</h2>
        <ul>
          @for (prerequisite of prerequisites(); track prerequisite.offeringId)
          {
          <li>{{ prerequisite.displayName }}</li>
          }
        </ul>
      </section>
      }

      <div class="actions">
        @if (isEnrolled()) {
        <p class="enrolled" role="status">You are enrolled.</p>
        } @else {
        <otui-button
          variant="primary"
          [useGradient]="false"
          [disabled]="busy() || !canEnrol()"
          (action)="enrol.emit()"
        >
          {{ busy() ? 'Enrolling…' : 'Enrol' }}
        </otui-button>
        } @if (hasLessons()) {
        <otui-button variant="secondary" (action)="open.emit()">
          {{ isEnrolled() ? 'Continue' : 'Start reading' }}
        </otui-button>
        } @if (error()) {
        <span class="error">{{ error() }}</span>
        }
      </div>

      @if (!canEnrol() && !isEnrolled()) {
      <p class="note">
        Enrolment opens when this course is published. Reading is open now.
      </p>
      }
    </section>
  `,
  styles: [
    `
      .summary {
        display: grid;
        gap: 1.6rem;
      }
      .eyebrow {
        display: flex;
        gap: 0.6rem;
        align-items: center;
        margin: 0;
        color: var(--lx-accent, currentColor);
        font: 700 0.7rem var(--lx-font-mono, ui-monospace, monospace);
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }
      .draft {
        padding: 0.1rem 0.4rem;
        border: 1px dashed var(--lx-border-strong, currentColor);
        border-radius: var(--lx-radius, 2px);
        color: var(--lx-text-muted, currentColor);
      }
      h1 {
        margin: 0.5rem 0 0.7rem;
        font-size: clamp(2rem, 4vw, 3.2rem);
        line-height: 1.02;
        letter-spacing: -0.04em;
      }
      .pitch {
        display: grid;
        gap: 1.25rem;
        margin: 0 0 1.75rem;
        padding: 1.15rem 1.25rem;
        border-left: 2px solid var(--lx-accent);
        background: var(--lx-surface-2, transparent);
      }
      .pitch h2 {
        margin: 0 0 0.35rem;
        font-family: var(--lx-font-mono);
        font-size: 0.72rem;
        font-weight: 600;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--lx-accent);
      }
      .pitch p {
        margin: 0;
        max-width: 62ch;
        line-height: 1.6;
      }
      @media (min-width: 46rem) {
        .pitch {
          grid-template-columns: 1fr 1fr;
          gap: 2rem;
        }
      }

      .description {
        margin: 0;
        max-width: 62ch;
        line-height: 1.6;
      }
      .description.muted {
        color: var(--lx-text-muted, currentColor);
      }
      .facts {
        display: flex;
        flex-wrap: wrap;
        gap: 2rem;
        margin: 0;
        padding: 1rem 0;
        border-top: 1px solid var(--lx-border-soft, currentColor);
        border-bottom: 1px solid var(--lx-border-soft, currentColor);
      }
      .facts div {
        display: grid;
        gap: 0.2rem;
      }
      dt {
        color: var(--lx-text-muted, currentColor);
        font-size: 0.72rem;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }
      dd {
        margin: 0;
        font: 700 1.1rem var(--lx-font-mono, ui-monospace, monospace);
      }
      .prerequisites h2 {
        margin: 0 0 0.5rem;
        font-size: 0.95rem;
      }
      .prerequisites ul {
        margin: 0;
        padding-left: 1.1rem;
        color: var(--lx-text-body, currentColor);
      }
      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.7rem;
        align-items: center;
      }
      .enrolled {
        margin: 0;
        color: var(--lx-accent, currentColor);
        font-weight: 700;
      }
      .error {
        color: var(--lx-danger, currentColor);
        font-size: 0.85rem;
      }
      .note {
        margin: 0;
        color: var(--lx-text-muted, currentColor);
        font-size: 0.85rem;
      }
    `,
  ],
})
export class OfferingSummaryComponent {
  readonly displayName = input<string>('');
  readonly description = input<string>('');
  /**
   * The case this course makes for itself, written by its author.
   *
   * Blank on a course that predates these fields, and the whole block is
   * omitted rather than showing an empty heading. A course that has not said
   * who it is for should look like it has not said, not like it said nothing.
   */
  readonly audience = input<string>('');
  readonly outcome = input<string>('');
  readonly trackDisplayName = input<string>('');
  readonly authorName = input<string>('');
  readonly lessonCount = input<number>(0);
  readonly level = input<number>(0);
  readonly credits = input<number>(0);
  readonly prerequisites = input<OfferingPrerequisite[]>([]);
  readonly isEnrolled = input<boolean>(false);
  readonly isDraft = input<boolean>(false);
  readonly busy = input<boolean>(false);
  readonly error = input<string>('');

  readonly enrol = output<void>();
  readonly open = output<void>();

  /**
   * The line above the title.
   *
   * An authored course is usually the only one in its track, so the track name
   * and the course name are the same string and showing both reads as a
   * stutter. The label falls back to a neutral word in that case.
   */
  protected readonly context = computed(() => {
    const track = this.trackDisplayName().trim();
    if (!track || track === this.displayName().trim()) return 'Course';
    return track;
  });

  /** Nobody enrols in an unpublished course, which the server enforces too. */
  protected readonly canEnrol = computed(() => !this.isDraft());
  protected readonly hasLessons = computed(() => this.lessonCount() > 0);
}

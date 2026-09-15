import { Component, computed, input, output } from '@angular/core';
import { ButtonComponent } from '@optimistic-tanuki/common-ui';

/**
 * Stands between a learner and work they have not enrolled for.
 *
 * Enrolment is explicit: taking a course is a decision, and pressing Submit is
 * not that decision. This is what asks for it, so the refusal from the server
 * reads as an invitation rather than an error.
 *
 * Presentational only. It holds no knowledge of how enrolment is stored or
 * which service performs it, so anything with an enrol-then-continue shape can
 * use it.
 */
@Component({
  selector: 'otlearn-enrolment-gate',
  imports: [ButtonComponent],
  template: `
    <section
      class="gate"
      [class.success]="success()"
      [class.unavailable]="!available()"
      [attr.aria-busy]="busy() ? 'true' : null"
      role="status"
      aria-live="polite"
    >
      <div class="gate-heading">
        <span class="marker" aria-hidden="true">{{
          success() ? '✓' : available() ? '→' : '!'
        }}</span>
        <p class="headline">{{ headline() }}</p>
      </div>
      <p class="detail">{{ detail() }}</p>
      @if (success()) {
      <p class="confirmation">
        Your place is saved. Pick up where you left off.
      </p>
      } @if (error()) {
      <p class="error" role="alert">{{ error() }}</p>
      }
      <div class="actions">
        @if (success() && hasLessons()) {
        <otui-button
          variant="primary"
          [useGradient]="false"
          (action)="continue.emit()"
        >
          Continue to the first lesson
        </otui-button>
        } @else if (available()) {
        <otui-button
          variant="primary"
          [useGradient]="false"
          [disabled]="busy() || signedIn() === null"
          (action)="primaryAction()"
        >
          {{ actionLabel() }}
        </otui-button>
        }
      </div>
    </section>
  `,
  styles: [
    `
      .gate {
        display: grid;
        gap: 0.65rem;
        padding: clamp(1rem, 3vw, 1.35rem);
        border: var(--lx-border-width, 2px) var(--lx-border-style, solid)
          var(--lx-border-strong, currentColor);
        border-left-width: calc(var(--lx-border-width, 2px) + 2px);
        border-radius: var(--lx-radius, 2px);
        background-color: var(--lx-well, transparent);
        background-image: var(--lx-surface-texture, none);
        box-shadow: var(--lx-shadow-card);
        transition: var(--lx-btn-transition, all 0.1s steps(2));
      }
      .gate.success {
        border-color: var(--lx-accent, currentColor);
      }
      .gate.unavailable {
        border-style: dashed;
        border-color: var(--lx-border-soft, currentColor);
        box-shadow: var(--lx-shadow-sm);
      }
      .gate-heading {
        display: flex;
        align-items: center;
        gap: 0.6rem;
      }
      .marker {
        display: inline-grid;
        flex: 0 0 1.55rem;
        place-items: center;
        width: 1.55rem;
        height: 1.55rem;
        border: var(--lx-border-width, 2px) var(--lx-border-style, solid)
          currentColor;
        color: var(--lx-accent, currentColor);
        font: var(--lx-btn-weight, 800) 0.78rem/1
          var(--lx-font-mono, ui-monospace, monospace);
      }
      .headline {
        margin: 0;
        color: var(--lx-accent, currentColor);
        font: var(--lx-btn-weight, 800) 0.78rem
          var(--lx-font-mono, ui-monospace, monospace);
        letter-spacing: 0.08em;
        text-transform: var(--lx-btn-transform, uppercase);
      }
      .detail {
        margin: 0;
        color: var(--lx-text-muted, currentColor);
        font-size: 0.88rem;
        line-height: 1.5;
      }
      .confirmation {
        margin: 0;
        color: var(--lx-accent, currentColor);
        font-size: 0.84rem;
        font-weight: 700;
      }
      .actions {
        display: grid;
        gap: 0.7rem;
        margin-top: 0.25rem;
      }
      otui-button {
        width: 100%;
        --personality-button-font-weight: var(--lx-btn-weight);
        --personality-button-text-transform: var(--lx-btn-transform);
        --personality-button-radius: var(--lx-radius);
        --personality-border-width: var(--lx-border-width);
        --personality-border-style: var(--lx-border-style);
        --personality-box-shadow: var(--lx-shadow-control);
        --shadow-lg: var(--lx-shadow-control);
        --shadow-sm: var(--lx-shadow-sm);
        --personality-transition: var(--lx-btn-transition);
      }
      .error {
        color: var(--lx-danger, currentColor);
        font-size: 0.82rem;
      }
      @media (prefers-reduced-motion: reduce) {
        .gate {
          transition: none;
        }
      }
    `,
  ],
})
export class EnrolmentGateComponent {
  /** What the learner is being asked to enrol in, shown in the copy. */
  readonly offeringName = input<string>('');
  readonly signedIn = input<boolean | null>(true);
  readonly available = input<boolean>(true);
  readonly success = input<boolean>(false);
  readonly hasLessons = input<boolean>(false);
  readonly busy = input<boolean>(false);
  readonly error = input<string>('');

  readonly enrol = output<void>();
  readonly signIn = output<void>();
  readonly continue = output<void>();

  protected readonly headline = computed(() => {
    if (this.success()) return 'Enrolment confirmed';
    if (!this.available()) return 'Course not open for enrolment';
    if (this.signedIn() === null) return 'Checking session';
    return this.signedIn() === false ? 'Account required' : 'Enrol to start';
  });

  protected readonly detail = computed(() => {
    const name = this.offeringName().trim();
    if (this.success()) {
      return name
        ? `${name} is ready when you are.`
        : 'Your course is ready when you are.';
    }
    if (!this.available()) {
      return name
        ? `${name} is still being prepared. Enrolment opens when it is published.`
        : 'Enrolment opens when this course is published.';
    }
    if (this.signedIn() === false) {
      return `Sign in to enrol in ${
        name || 'this course'
      } and keep your progress.`;
    }
    return name
      ? `Reading is open to everyone. Enrol in ${name} to run exercises and keep your progress.`
      : 'Reading is open to everyone. Enrol in this course to run exercises and keep your progress.';
  });

  protected readonly actionLabel = computed(() => {
    if (this.busy()) return 'Enrolling…';
    if (this.signedIn() === null) return 'Checking session…';
    return this.signedIn() ? 'Enrol now' : 'Sign in to enrol';
  });

  protected primaryAction(): void {
    if (this.signedIn() === false) {
      this.signIn.emit();
      return;
    }
    if (this.signedIn() === true) this.enrol.emit();
  }
}

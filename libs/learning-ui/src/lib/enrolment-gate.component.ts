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
    <div class="gate" role="status">
      <p class="headline">{{ headline() }}</p>
      <p class="detail">{{ detail() }}</p>
      <div class="actions">
        <otui-button
          variant="primary"
          [useGradient]="false"
          [disabled]="busy()"
          (action)="enrol.emit()"
        >
          {{ busy() ? 'Enrolling…' : enrolLabel() }}
        </otui-button>
        @if (error()) {
        <span class="error">{{ error() }}</span>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .gate {
        display: grid;
        gap: 0.5rem;
        padding: 1rem 1.1rem;
        border: 1px dashed var(--lx-border-strong, currentColor);
        border-radius: 2px;
        background: var(--lx-well, transparent);
      }
      .headline {
        margin: 0;
        color: var(--lx-accent, currentColor);
        font: 700 0.8rem ui-monospace, monospace;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .detail {
        margin: 0;
        color: var(--lx-text-muted, currentColor);
        font-size: 0.88rem;
        line-height: 1.5;
      }
      .actions {
        display: flex;
        gap: 0.7rem;
        align-items: center;
        flex-wrap: wrap;
        margin-top: 0.25rem;
      }
      .error {
        color: var(--lx-danger, currentColor);
        font-size: 0.82rem;
      }
    `,
  ],
})
export class EnrolmentGateComponent {
  /** What the learner is being asked to enrol in, shown in the copy. */
  readonly offeringName = input<string>('');
  readonly busy = input<boolean>(false);
  readonly error = input<string>('');

  readonly enrol = output<void>();

  protected readonly headline = computed(() => 'Enrol to start');

  protected readonly detail = computed(() => {
    const name = this.offeringName().trim();
    return name
      ? `Reading is open to everyone. Enrol in ${name} to run exercises and keep your progress.`
      : 'Reading is open to everyone. Enrol in this course to run exercises and keep your progress.';
  });

  protected readonly enrolLabel = computed(() => {
    const name = this.offeringName().trim();
    return name ? `Enrol in ${name}` : 'Enrol';
  });
}

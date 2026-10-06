import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import {
  type ContributionView,
  STAGE_WORDS,
  STATE_WORDS,
} from '@optimistic-tanuki/civic-briefing-data-access';

/**
 * A contribution's state and every review step, with its reasons. An
 * unexplained automated decision is how a civic project loses the people it
 * depends on, so every reason recorded is shown.
 */
@Component({
  selector: 'civic-review-trail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="state" [attr.data-state]="contribution().state">
      <strong>{{ state().label }}.</strong> {{ state().meaning }}
    </p>
    <ol class="steps">
      @for (step of contribution().review; track $index) {
      <li>
        <span class="stage">{{ stage(step.stage) }}</span>
        @for (reason of step.reasons; track $index) {
        <span class="reason">{{ reason }}</span>
        }
      </li>
      }
    </ol>
  `,
  styleUrl: './review-trail.component.scss',
})
export class ReviewTrailComponent {
  readonly contribution = input.required<ContributionView>();
  protected readonly state = computed(
    () => STATE_WORDS[this.contribution().state]
  );

  protected stage(stage: string): string {
    return STAGE_WORDS[stage] ?? stage;
  }
}

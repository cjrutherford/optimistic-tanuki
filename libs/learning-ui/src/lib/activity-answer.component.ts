import { Component, computed, input, output, signal } from '@angular/core';
import { ButtonComponent } from '@optimistic-tanuki/common-ui';

export interface AnswerableActivity {
  type: 'quiz.mcq' | 'writing.response' | 'project.submission' | 'code.run';
  id: string;
  prompt: string;
  options?: { id: string; text: string }[];
  maxWords?: number;
}

export interface AnswerMark {
  graded: boolean;
  score?: number;
  maxScore?: number;
  feedback: string;
  criteria?: {
    id: string;
    description: string;
    maxPoints: number;
    points: number;
    evidenceFound: boolean;
    comment: string;
  }[];
}

/**
 * The work an author set, and somewhere to answer it.
 *
 * Written answers are marked against the author's rubric, so the marking is
 * shown criterion by criterion rather than as a single number. A learner who
 * lost a mark should be able to see which part of the rubric it was.
 *
 * Presentational only. It knows nothing about how anything is marked.
 */
@Component({
  selector: 'otlearn-activity-answer',
  imports: [ButtonComponent],
  template: `
    <section class="activity">
      <p class="kind">{{ kindLabel() }}</p>
      <p class="prompt">{{ activity().prompt }}</p>

      @if (activity().type === 'quiz.mcq') {
      <ul class="options">
        @for (option of activity().options ?? []; track option.id) {
        <li>
          <label>
            <input
              type="checkbox"
              [checked]="chosen().includes(option.id)"
              [disabled]="answered()"
              (change)="toggle(option.id)"
            />
            <span>{{ option.text }}</span>
          </label>
        </li>
        }
      </ul>
      } @else if (activity().type === 'writing.response') {
      <textarea
        rows="6"
        [attr.aria-label]="'Your answer'"
        [value]="text()"
        [disabled]="answered()"
        placeholder="Write your answer."
        (input)="text.set(value($event))"
      ></textarea>
      @if (activity().maxWords) {
      <p class="hint">{{ wordCount() }} of {{ activity().maxWords }} words</p>
      } } @else {
      <p class="hint">This one is handed in outside the site.</p>
      } @if (canAnswer()) {
      <div class="actions">
        <otui-button
          variant="primary"
          [useGradient]="false"
          [disabled]="busy() || !hasAnswer()"
          (action)="submit()"
        >
          {{ busy() ? 'Marking…' : 'Answer' }}
        </otui-button>
        @if (error()) {
        <span class="error">{{ error() }}</span>
        }
      </div>
      } @if (mark(); as result) {
      <div class="mark" [class.unmarked]="!result.graded">
        @if (result.graded && result.maxScore) {
        <p class="score">{{ result.score }} / {{ result.maxScore }}</p>
        }
        <p class="feedback">{{ result.feedback }}</p>
        @if (result.criteria?.length) {
        <ul class="criteria">
          @for (criterion of result.criteria ?? []; track criterion.id) {
          <li [class.missed]="criterion.points === 0">
            <span class="points">
              {{ criterion.points }}/{{ criterion.maxPoints }}
            </span>
            <span class="description">
              {{ criterion.description }}
              @if (criterion.comment) {
              <em>{{ criterion.comment }}</em>
              }
            </span>
          </li>
          }
        </ul>
        }
      </div>
      }
    </section>
  `,
  styles: [
    `
      .activity {
        display: grid;
        gap: 0.7rem;
        padding: 1rem 1.1rem;
        border: 1px solid var(--lx-border-soft, currentColor);
        border-radius: 2px;
      }
      .kind {
        margin: 0;
        color: var(--lx-accent, currentColor);
        font: 700 0.66rem ui-monospace, monospace;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }
      .prompt {
        margin: 0;
        font-weight: 600;
      }
      .options {
        margin: 0;
        padding: 0;
        list-style: none;
        display: grid;
        gap: 0.35rem;
      }
      .options label {
        display: flex;
        gap: 0.55rem;
        align-items: baseline;
        cursor: pointer;
      }
      textarea {
        width: 100%;
        padding: 0.5rem 0.6rem;
        border: 1px solid var(--lx-border-soft, currentColor);
        border-radius: 2px;
        background: transparent;
        color: inherit;
        font: inherit;
        resize: vertical;
      }
      .hint {
        margin: 0;
        color: var(--lx-text-muted, currentColor);
        font-size: 0.8rem;
      }
      .actions {
        display: flex;
        gap: 0.7rem;
        align-items: center;
        flex-wrap: wrap;
      }
      .error {
        color: var(--lx-danger, currentColor);
        font-size: 0.82rem;
      }
      .mark {
        display: grid;
        gap: 0.5rem;
        padding: 0.75rem 0.85rem;
        border-left: 3px solid var(--lx-accent, currentColor);
        background: var(--lx-well, transparent);
      }
      .mark.unmarked {
        border-left-color: var(--lx-text-muted, currentColor);
      }
      .score {
        margin: 0;
        font: 700 1.1rem ui-monospace, monospace;
        color: var(--lx-accent, currentColor);
      }
      .feedback {
        margin: 0;
        font-size: 0.9rem;
        line-height: 1.55;
        white-space: pre-line;
      }
      .criteria {
        margin: 0;
        padding: 0;
        list-style: none;
        display: grid;
        gap: 0.3rem;
      }
      .criteria li {
        display: flex;
        gap: 0.6rem;
        font-size: 0.85rem;
      }
      .criteria li.missed .points {
        color: var(--lx-text-muted, currentColor);
      }
      .points {
        font: 700 0.8rem ui-monospace, monospace;
        color: var(--lx-accent, currentColor);
        white-space: nowrap;
      }
      .description em {
        display: block;
        color: var(--lx-text-muted, currentColor);
        font-style: normal;
      }
    `,
  ],
})
export class ActivityAnswerComponent {
  readonly activity = input.required<AnswerableActivity>();
  readonly mark = input<AnswerMark | null>(null);
  readonly busy = input<boolean>(false);
  readonly error = input<string>('');

  readonly answer = output<unknown>();

  protected readonly chosen = signal<string[]>([]);
  protected readonly text = signal('');

  protected readonly answered = computed(() => Boolean(this.mark()));

  /** Project submissions and code exercises are not answered here. */
  protected readonly canAnswer = computed(
    () =>
      !this.answered() &&
      (this.activity().type === 'quiz.mcq' ||
        this.activity().type === 'writing.response')
  );

  protected readonly hasAnswer = computed(() =>
    this.activity().type === 'quiz.mcq'
      ? this.chosen().length > 0
      : this.text().trim().length > 0
  );

  protected readonly wordCount = computed(
    () => this.text().trim().split(/\s+/).filter(Boolean).length
  );

  protected readonly kindLabel = computed(() =>
    this.activity().type === 'quiz.mcq'
      ? 'Multiple choice'
      : this.activity().type === 'writing.response'
      ? 'Written response'
      : 'Project submission'
  );

  protected value(event: Event): string {
    return (event.target as HTMLTextAreaElement).value;
  }

  protected toggle(optionId: string): void {
    this.chosen.update((current) =>
      current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId]
    );
  }

  protected submit(): void {
    this.answer.emit(
      this.activity().type === 'quiz.mcq' ? this.chosen() : this.text().trim()
    );
  }
}

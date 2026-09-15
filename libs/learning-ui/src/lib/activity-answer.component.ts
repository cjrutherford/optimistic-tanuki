import { Component, computed, input, output, signal } from '@angular/core';
import { ButtonComponent } from '@optimistic-tanuki/common-ui';
import { EnrolmentGateComponent } from './enrolment-gate.component';

export interface AnswerableActivity {
  type: 'quiz.mcq' | 'writing.response' | 'project.submission' | 'code.run';
  id: string;
  prompt: string;
  options?: { id: string; text: string }[];
  maxWords?: number;
  starterCode?: string;
  languageId?: string;
}

export interface CodeActivityResult {
  output: string;
  errors: string[];
  passed?: boolean;
  testsPassed?: boolean;
  awardedPoints?: number;
  needsSignIn?: boolean;
  needsSignInFor?: 'run' | 'submit';
  needsEnrolmentIn?: string;
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
  imports: [ButtonComponent, EnrolmentGateComponent],
  template: `
    <section
      class="activity"
      [class.busy]="busy()"
      [attr.aria-busy]="busy() ? 'true' : null"
    >
      <p class="kind">{{ kindLabel() }}</p>
      <p class="prompt">{{ activity().prompt }}</p>

      @if (activity().type === 'quiz.mcq') {
      <ul class="options" role="group" aria-label="Answer options">
        @for (option of activity().options ?? []; track option.id) {
        <li>
          <label
            class="option-chip"
            [class.selected]="chosen().includes(option.id)"
            [class.disabled]="answered() || busy()"
          >
            <input
              class="option-input"
              type="checkbox"
              [checked]="chosen().includes(option.id)"
              [disabled]="answered() || busy()"
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
        [disabled]="answered() || busy()"
        placeholder="Write your answer."
        (input)="text.set(value($event))"
      ></textarea>
      @if (activity().maxWords) {
      <p class="hint">{{ wordCount() }} of {{ activity().maxWords }} words</p>
      } } @else if (activity().type === 'code.run') {
      <ng-content></ng-content>
      <p class="hint">
        Run checks your code without scoring it. Submit checks the author's
        verifier and records your result.
      </p>
      <div class="actions">
        <otui-button
          variant="secondary"
          [disabled]="busy() || !hasAnswer() || answered()"
          (action)="runCode.emit(code())"
        >
          {{ busy() ? 'Working…' : 'Run' }}
        </otui-button>
        <otui-button
          variant="primary"
          [useGradient]="false"
          [disabled]="busy() || !hasAnswer() || answered()"
          (action)="submitCode.emit(code())"
        >
          Submit
        </otui-button>
      </div>
      @if (codeResult(); as result) {
      <div
        class="code-result"
        [class.pass]="result.passed === true"
        [class.fail]="result.passed === false"
        role="status"
        aria-live="polite"
      >
        @if (result.needsEnrolmentIn; as offeringId) {
        <otlearn-enrolment-gate
          [busy]="enrolling()"
          [error]="enrolError()"
          (enrol)="enrol.emit(offeringId)"
        ></otlearn-enrolment-gate>
        } @else if (result.needsSignIn) {
        <p class="feedback">
          {{
            result.needsSignInFor === 'run'
              ? 'Sign in to run code.'
              : 'Sign in to submit code.'
          }}
        </p>
        } @else if (result.passed === true) {
        <p class="feedback">
          Passed@if (result.awardedPoints) {, +{{ result.awardedPoints }}
          points }
        </p>
        } @else if (result.passed === false) {
        <p class="feedback">
          Not passed yet. Review the diagnostics and try again.
        </p>
        } @if (result.output) {
        <pre class="output">{{ result.output }}</pre>
        } @if (result.errors.length) {
        <pre class="errors">{{
          result.errors.join(
            '
'
          )
        }}</pre>
        }
      </div>
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
        <span class="error" role="alert">{{ error() }}</span>
        }
      </div>
      } @if (mark(); as result) {
      <div
        class="mark"
        [class.unmarked]="!result.graded"
        [class.success]="
          result.graded &&
          result.maxScore !== undefined &&
          result.score === result.maxScore
        "
        [class.failure]="
          result.graded &&
          result.maxScore !== undefined &&
          result.score !== result.maxScore
        "
        role="status"
        aria-live="polite"
      >
        <p class="mark-state">
          {{ result.graded ? 'Marked response' : 'Recorded for review' }}
        </p>
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
        border: var(--lx-border-width, 2px) var(--lx-border-style, solid)
          var(--lx-border-strong, currentColor);
        border-radius: var(--lx-radius, 2px);
        background-color: var(--lx-surface);
        background-image: var(--lx-surface-texture);
        box-shadow: var(--lx-shadow-card);
      }
      .kind {
        margin: 0;
        color: var(--lx-accent, currentColor);
        font: 700 0.66rem var(--lx-font-mono, ui-monospace, monospace);
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
      .options li {
        min-width: 0;
      }
      .option-chip {
        display: flex;
        gap: 0.7rem;
        align-items: flex-start;
        min-height: 2.75rem;
        box-sizing: border-box;
        padding: 0.65rem 0.75rem;
        border: var(--lx-border-width, 2px) var(--lx-border-style, solid)
          var(--lx-border-soft, currentColor);
        border-radius: var(--lx-radius, 2px);
        background: var(--lx-well);
        color: var(--lx-text-body, currentColor);
        box-shadow: var(--lx-shadow-sm);
        cursor: pointer;
        transition: var(--lx-btn-transition, all 0.1s steps(2));
      }
      .option-chip:hover:not(.disabled) {
        border-color: var(--lx-accent);
        background: var(--lx-surface-hover);
        box-shadow: var(--lx-shadow-control);
        transform: translateY(-1px);
      }
      .option-chip.selected {
        border-color: var(--lx-accent);
        background: var(--lx-surface-active);
        box-shadow: var(--lx-shadow-inset);
        color: var(--lx-text);
      }
      .option-chip.disabled {
        cursor: not-allowed;
        opacity: 0.72;
      }
      .option-chip:has(.option-input:focus-visible) {
        outline: var(--lx-border-width, 2px) solid var(--lx-focus);
        outline-offset: 2px;
      }
      .option-input {
        flex: 0 0 auto;
        width: 1rem;
        height: 1rem;
        margin: 0.1rem 0 0;
        accent-color: var(--lx-accent);
      }
      textarea {
        box-sizing: border-box;
        width: 100%;
        min-height: 9rem;
        padding: 0.5rem 0.6rem;
        border: var(--lx-border-width, 2px) var(--lx-border-style, solid)
          var(--lx-border-strong, currentColor);
        border-radius: var(--lx-radius, 2px);
        background: var(--lx-well);
        color: var(--lx-text-body, currentColor);
        font: inherit;
        resize: vertical;
        box-shadow: var(--lx-shadow-sm);
        transition: var(--lx-btn-transition, all 0.1s steps(2));
      }
      textarea:focus {
        outline: var(--lx-border-width, 2px) solid var(--lx-focus);
        outline-offset: 2px;
        box-shadow: var(--lx-shadow-sm);
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
      .actions otui-button {
        min-width: 7rem;
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
      .mark {
        display: grid;
        gap: 0.5rem;
        padding: 0.75rem 0.85rem;
        border: var(--lx-border-width, 2px) var(--lx-border-style, solid)
          var(--lx-accent, currentColor);
        border-left-width: calc(var(--lx-border-width, 2px) + 1px);
        border-radius: var(--lx-radius, 2px);
        background: var(--lx-well, transparent);
        box-shadow: var(--lx-shadow-inset);
      }
      .mark.unmarked {
        border-left-color: var(--lx-text-muted, currentColor);
      }
      .mark.failure {
        border-color: var(--lx-danger, currentColor);
      }
      .mark-state {
        margin: 0;
        color: var(--lx-text-muted, currentColor);
        font: var(--lx-btn-weight, 800) 0.64rem/1
          var(--lx-font-mono, ui-monospace, monospace);
        letter-spacing: 0.08em;
        text-transform: var(--lx-btn-transform, uppercase);
      }
      .score {
        margin: 0;
        font: 700 1.1rem var(--lx-font-mono, ui-monospace, monospace);
        color: var(--lx-accent, currentColor);
      }
      .feedback {
        margin: 0;
        font-size: 0.9rem;
        line-height: 1.55;
        white-space: pre-line;
      }
      .code-result {
        display: grid;
        gap: 0.45rem;
        padding: 0.7rem 0.8rem;
        border: var(--lx-border-width, 2px) var(--lx-border-style, solid)
          var(--lx-border-soft, currentColor);
        border-radius: var(--lx-radius, 2px);
        background: var(--lx-well, transparent);
      }
      .code-result.pass {
        border-color: var(--lx-accent, currentColor);
      }
      .code-result.fail {
        border-color: var(--lx-danger, currentColor);
      }
      .code-result pre {
        margin: 0;
        overflow: auto;
        white-space: pre-wrap;
        font: 0.78rem/1.5 var(--lx-font-mono, ui-monospace, monospace);
      }
      .code-result .errors {
        color: var(--lx-danger, currentColor);
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
        font: 700 0.8rem var(--lx-font-mono, ui-monospace, monospace);
        color: var(--lx-accent, currentColor);
        white-space: nowrap;
      }
      .description em {
        display: block;
        color: var(--lx-text-muted, currentColor);
        font-style: normal;
      }
      @media (prefers-reduced-motion: reduce) {
        .option-chip,
        textarea {
          transition: none;
        }
      }
    `,
  ],
})
export class ActivityAnswerComponent {
  readonly activity = input.required<AnswerableActivity>();
  readonly mark = input<AnswerMark | null>(null);
  readonly busy = input<boolean>(false);
  readonly error = input<string>('');
  readonly code = input<string>('');
  readonly codeResult = input<CodeActivityResult | null>(null);
  readonly enrolling = input<boolean>(false);
  readonly enrolError = input<string>('');

  readonly answer = output<unknown>();
  readonly runCode = output<string>();
  readonly submitCode = output<string>();
  readonly enrol = output<string>();

  protected readonly chosen = signal<string[]>([]);
  protected readonly text = signal('');

  protected readonly answered = computed(
    () =>
      Boolean(this.mark()) ||
      (this.activity().type === 'code.run' &&
        this.codeResult()?.passed === true)
  );

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
      : this.activity().type === 'writing.response'
      ? this.text().trim().length > 0
      : this.code().trim().length > 0
  );

  protected readonly wordCount = computed(
    () => this.text().trim().split(/\s+/).filter(Boolean).length
  );

  protected readonly kindLabel = computed(() =>
    this.activity().type === 'quiz.mcq'
      ? 'Multiple choice'
      : this.activity().type === 'writing.response'
      ? 'Written response'
      : this.activity().type === 'code.run'
      ? 'Code exercise'
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

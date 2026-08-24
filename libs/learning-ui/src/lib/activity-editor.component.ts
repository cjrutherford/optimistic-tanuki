import { Component, input, output } from '@angular/core';

export type ActivityKind =
  | 'writing.response'
  | 'quiz.mcq'
  | 'project.submission'
  | 'code.run';

export interface RubricCriterionDraft {
  id: string;
  description: string;
  maxPoints: number;
}

export interface EditableActivity {
  type: ActivityKind;
  id: string;
  prompt: string;
  /** The lesson this work belongs to, so a reader meets it in context. */
  lessonId?: string;
  /** quiz.mcq only. */
  options?: { id: string; text: string }[];
  correctOptionIds?: string[];
  /** writing.response only. */
  maxWords?: number;
  /** An answer the author would accept, shown to the marker and never to the learner. */
  sampleResponse?: string;
  /** How a written answer is marked. Without one it waits for a person. */
  rubric?: { id: string; title: string; criteria: RubricCriterionDraft[] };
  /** project.submission only. */
  artifactTypes?: string[];
  /** code.run only. */
  starterCode?: string;
  expectedOutput?: string;
}

const KIND_LABELS: Record<ActivityKind, string> = {
  'writing.response': 'Written response',
  'quiz.mcq': 'Multiple choice',
  'project.submission': 'Project submission',
  'code.run': 'Run code',
};

/**
 * The work a course asks of a learner.
 *
 * All four kinds the schema supports are offered, not just the code one. The
 * ported courseware only ever used `code.run`, which is why a platform meant
 * for any subject read as a programming site: the only work it could ask for
 * was to write a program.
 *
 * Presentational only. Everything is emitted as a whole new list, matching how
 * the server replaces a course's activities.
 */
@Component({
  selector: 'otlearn-activity-editor',
  template: `
    <section class="activities">
      <header>
        <h2>Activities</h2>
        <div class="add">
          @for (kind of kinds; track kind) {
          <button type="button" (click)="add(kind)">
            Add {{ label(kind) }}
          </button>
          }
        </div>
      </header>

      @if (!activities().length) {
      <p class="empty">No activities yet. A course can be read without them.</p>
      } @for (activity of activities(); track $index; let index = $index) {
      <article class="activity">
        <div class="activity-head">
          <span class="kind">{{ label(activity.type) }}</span>
          <button
            type="button"
            class="remove"
            [attr.aria-label]="'Remove ' + label(activity.type)"
            (click)="remove(index)"
          >
            Remove
          </button>
        </div>

        <label>
          <span>Prompt</span>
          <textarea
            rows="2"
            [value]="activity.prompt"
            (input)="setPrompt(index, $event)"
          ></textarea>
        </label>

        @if (lessons().length) {
        <label>
          <span>Shown with</span>
          <select
            [value]="activity.lessonId ?? ''"
            [attr.aria-label]="'Lesson for ' + label(activity.type)"
            (change)="setLesson(index, $event)"
          >
            <option value="">Nowhere in particular</option>
            @for (lesson of lessons(); track lesson.id) {
            <option
              [value]="lesson.id"
              [selected]="activity.lessonId === lesson.id"
            >
              {{ lesson.title }}
            </option>
            }
          </select>
        </label>
        @if (!activity.lessonId) {
        <p class="hint">
          Work that belongs to no lesson is stored but never put in front of a
          reader.
        </p>
        } } @if (activity.type === 'quiz.mcq') {
        <div class="options">
          <span class="legend">Options, with the correct ones ticked</span>
          @for (option of activity.options ?? []; track $index; let optionIndex
          = $index) {
          <div class="option">
            <input
              type="checkbox"
              [checked]="isCorrect(activity, option.id)"
              [attr.aria-label]="'Option ' + (optionIndex + 1) + ' is correct'"
              (change)="toggleCorrect(index, option.id)"
            />
            <input
              type="text"
              [value]="option.text"
              [attr.aria-label]="'Option ' + (optionIndex + 1) + ' text'"
              (input)="setOptionText(index, optionIndex, $event)"
            />
            <button
              type="button"
              class="remove"
              [attr.aria-label]="'Remove option ' + (optionIndex + 1)"
              (click)="removeOption(index, optionIndex)"
            >
              ×
            </button>
          </div>
          }
          <button type="button" (click)="addOption(index)">Add option</button>
          @if (quizWarning(activity)) {
          <p class="warning" role="status">{{ quizWarning(activity) }}</p>
          }
        </div>
        } @if (activity.type === 'writing.response') {
        <label>
          <span>An answer you would accept</span>
          <textarea
            rows="3"
            placeholder="Not shown to the learner. The marker sees it as a reference."
            [value]="activity.sampleResponse ?? ''"
            (input)="setSampleResponse(index, $event)"
          ></textarea>
        </label>
        <div class="rubric">
          <span class="legend">How it is marked</span>
          @for (criterion of activity.rubric?.criteria ?? []; track $index; let
          criterionIndex = $index) {
          <div class="criterion">
            <input
              type="text"
              [value]="criterion.description"
              [attr.aria-label]="'Criterion ' + (criterionIndex + 1)"
              placeholder="What earns the marks"
              (input)="setCriterion(index, criterionIndex, $event)"
            />
            <input
              type="number"
              min="0"
              [value]="criterion.maxPoints"
              [attr.aria-label]="
                'Criterion ' + (criterionIndex + 1) + ' points'
              "
              (input)="setCriterionPoints(index, criterionIndex, $event)"
            />
            <button
              type="button"
              class="remove"
              [attr.aria-label]="'Remove criterion ' + (criterionIndex + 1)"
              (click)="removeCriterion(index, criterionIndex)"
            >
              ×
            </button>
          </div>
          }
          <button type="button" (click)="addCriterion(index)">
            Add criterion
          </button>
          <p class="hint">
            {{ rubricHint(activity) }}
          </p>
        </div>
        } @if (activity.type === 'project.submission') {
        <label>
          <span>What may be handed in, comma separated</span>
          <input
            type="text"
            [value]="(activity.artifactTypes ?? []).join(', ')"
            placeholder="pdf, image, link"
            (input)="setArtifactTypes(index, $event)"
          />
        </label>
        } @if (activity.type === 'code.run') {
        <label>
          <span>Starter code</span>
          <textarea
            rows="4"
            [value]="activity.starterCode ?? ''"
            (input)="setStarterCode(index, $event)"
          ></textarea>
        </label>
        }
      </article>
      }
    </section>
  `,
  styles: [
    `
      .activities {
        display: grid;
        gap: 1rem;
      }
      header {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 1rem;
        flex-wrap: wrap;
      }
      h2 {
        margin: 0;
        font-size: 1rem;
      }
      .add {
        display: flex;
        gap: 0.35rem;
        flex-wrap: wrap;
      }
      button {
        padding: 0.3rem 0.55rem;
        border: 1px solid var(--lx-border-soft, currentColor);
        border-radius: 2px;
        background: transparent;
        color: inherit;
        font: inherit;
        font-size: 0.8rem;
        cursor: pointer;
      }
      button.remove {
        color: var(--lx-danger, currentColor);
      }
      .empty {
        margin: 0;
        color: var(--lx-text-muted, currentColor);
        font-size: 0.88rem;
      }
      .activity {
        display: grid;
        gap: 0.6rem;
        padding: 0.9rem;
        border: 1px solid var(--lx-border-soft, currentColor);
        border-radius: 2px;
      }
      .activity-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
      }
      .kind {
        color: var(--lx-accent, currentColor);
        font: 700 0.68rem ui-monospace, monospace;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      label {
        display: grid;
        gap: 0.25rem;
      }
      label span,
      .legend {
        color: var(--lx-text-muted, currentColor);
        font-size: 0.72rem;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }
      select {
        padding: 0.4rem 0.5rem;
        border: 1px solid var(--lx-border-soft, currentColor);
        border-radius: 2px;
        background: transparent;
        color: inherit;
        font: inherit;
      }
      input[type='text'],
      textarea {
        width: 100%;
        padding: 0.4rem 0.5rem;
        border: 1px solid var(--lx-border-soft, currentColor);
        border-radius: 2px;
        background: transparent;
        color: inherit;
        font: inherit;
      }
      textarea {
        resize: vertical;
      }
      .options {
        display: grid;
        gap: 0.4rem;
        justify-items: start;
      }
      .option {
        display: flex;
        gap: 0.5rem;
        align-items: center;
        width: 100%;
      }
      .rubric {
        display: grid;
        gap: 0.4rem;
        justify-items: start;
      }
      .criterion {
        display: flex;
        gap: 0.5rem;
        align-items: center;
        width: 100%;
      }
      .criterion input[type='number'] {
        width: 5rem;
        padding: 0.4rem 0.5rem;
        border: 1px solid var(--lx-border-soft, currentColor);
        border-radius: 2px;
        background: transparent;
        color: inherit;
        font: inherit;
      }
      .hint {
        margin: 0;
        color: var(--lx-text-muted, currentColor);
        font-size: 0.8rem;
      }
      .warning {
        margin: 0;
        color: var(--lx-warn, currentColor);
        font-size: 0.82rem;
      }
    `,
  ],
})
export class ActivityEditorComponent {
  readonly activities = input<EditableActivity[]>([]);
  /** The lessons this work can be attached to. */
  readonly lessons = input<{ id: string; title: string }[]>([]);
  readonly activitiesChange = output<EditableActivity[]>();

  protected readonly kinds: ActivityKind[] = [
    'writing.response',
    'quiz.mcq',
    'project.submission',
    'code.run',
  ];

  protected label(kind: ActivityKind): string {
    return KIND_LABELS[kind];
  }

  protected isCorrect(activity: EditableActivity, optionId: string): boolean {
    return (activity.correctOptionIds ?? []).includes(optionId);
  }

  /**
   * Why a quiz would be refused if it were saved as it stands.
   *
   * The schema needs at least two options and at least one correct answer.
   * Saying so here beats a rejected save with no explanation attached to it.
   */
  protected quizWarning(activity: EditableActivity): string {
    const options = activity.options ?? [];
    if (options.length < 2)
      return 'A multiple choice needs at least two options.';
    if (!(activity.correctOptionIds ?? []).length) {
      return 'Tick at least one correct answer.';
    }
    if (options.some((option) => !option.text.trim())) {
      return 'Every option needs some text.';
    }
    return '';
  }

  protected add(kind: ActivityKind): void {
    const next = this.copy();
    const activity: EditableActivity = {
      type: kind,
      id: `activity-${Math.random().toString(36).slice(2, 10)}`,
      prompt: '',
    };
    if (kind === 'quiz.mcq') {
      activity.options = [
        { id: this.freshOptionId(), text: '' },
        { id: this.freshOptionId(), text: '' },
      ];
      activity.correctOptionIds = [];
    }
    if (kind === 'project.submission') activity.artifactTypes = [];
    if (kind === 'code.run') activity.starterCode = '';
    next.push(activity);
    this.activitiesChange.emit(next);
  }

  protected remove(index: number): void {
    const next = this.copy();
    next.splice(index, 1);
    this.activitiesChange.emit(next);
  }

  protected setPrompt(index: number, event: Event): void {
    const next = this.copy();
    next[index].prompt = this.value(event);
    this.activitiesChange.emit(next);
  }

  protected addOption(index: number): void {
    const next = this.copy();
    next[index].options = [
      ...(next[index].options ?? []),
      { id: this.freshOptionId(), text: '' },
    ];
    this.activitiesChange.emit(next);
  }

  protected removeOption(index: number, optionIndex: number): void {
    const next = this.copy();
    const options = next[index].options ?? [];
    const [removed] = options.splice(optionIndex, 1);
    // A correct answer that no longer exists would make the quiz unanswerable.
    next[index].correctOptionIds = (next[index].correctOptionIds ?? []).filter(
      (id) => id !== removed?.id
    );
    this.activitiesChange.emit(next);
  }

  protected setOptionText(
    index: number,
    optionIndex: number,
    event: Event
  ): void {
    const next = this.copy();
    const options = next[index].options ?? [];
    options[optionIndex] = { ...options[optionIndex], text: this.value(event) };
    next[index].options = options;
    this.activitiesChange.emit(next);
  }

  protected toggleCorrect(index: number, optionId: string): void {
    const next = this.copy();
    const current = next[index].correctOptionIds ?? [];
    next[index].correctOptionIds = current.includes(optionId)
      ? current.filter((id) => id !== optionId)
      : [...current, optionId];
    this.activitiesChange.emit(next);
  }

  /**
   * What marking this answer will do, said plainly.
   *
   * Without a rubric there is nothing to mark against, and a course that
   * silently never marks anything is worse than one that says so.
   */
  protected rubricHint(activity: EditableActivity): string {
    const criteria = activity.rubric?.criteria ?? [];
    if (!criteria.length) {
      return 'With no criteria, an answer is recorded and left for you to mark yourself.';
    }
    if (criteria.some((criterion) => !criterion.description.trim())) {
      return 'Every criterion needs to say what earns the marks.';
    }
    const total = criteria.reduce(
      (sum, criterion) => sum + (criterion.maxPoints || 0),
      0
    );
    return `Marked out of ${total} against ${criteria.length} ${
      criteria.length === 1 ? 'criterion' : 'criteria'
    }.`;
  }

  protected setLesson(index: number, event: Event): void {
    const next = this.copy();
    const chosen = (event.target as HTMLSelectElement).value;
    next[index].lessonId = chosen || undefined;
    this.activitiesChange.emit(next);
  }

  protected setSampleResponse(index: number, event: Event): void {
    const next = this.copy();
    next[index].sampleResponse = this.value(event);
    this.activitiesChange.emit(next);
  }

  private ensureRubric(activity: EditableActivity) {
    activity.rubric = activity.rubric ?? {
      id: `rubric-${Math.random().toString(36).slice(2, 10)}`,
      title: 'How this is marked',
      criteria: [],
    };
    return activity.rubric;
  }

  protected addCriterion(index: number): void {
    const next = this.copy();
    const rubric = this.ensureRubric(next[index]);
    rubric.criteria = [
      ...rubric.criteria,
      {
        id: `criterion-${Math.random().toString(36).slice(2, 10)}`,
        description: '',
        maxPoints: 1,
      },
    ];
    this.activitiesChange.emit(next);
  }

  protected removeCriterion(index: number, criterionIndex: number): void {
    const next = this.copy();
    const rubric = this.ensureRubric(next[index]);
    rubric.criteria = rubric.criteria.filter(
      (_criterion, position) => position !== criterionIndex
    );
    this.activitiesChange.emit(next);
  }

  protected setCriterion(
    index: number,
    criterionIndex: number,
    event: Event
  ): void {
    const next = this.copy();
    const rubric = this.ensureRubric(next[index]);
    rubric.criteria = rubric.criteria.map((criterion, position) =>
      position === criterionIndex
        ? { ...criterion, description: this.value(event) }
        : criterion
    );
    this.activitiesChange.emit(next);
  }

  protected setCriterionPoints(
    index: number,
    criterionIndex: number,
    event: Event
  ): void {
    const parsed = Number.parseInt(this.value(event), 10);
    const next = this.copy();
    const rubric = this.ensureRubric(next[index]);
    rubric.criteria = rubric.criteria.map((criterion, position) =>
      position === criterionIndex
        ? {
            ...criterion,
            maxPoints: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0,
          }
        : criterion
    );
    this.activitiesChange.emit(next);
  }

  protected setArtifactTypes(index: number, event: Event): void {
    const next = this.copy();
    next[index].artifactTypes = this.value(event)
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
    this.activitiesChange.emit(next);
  }

  protected setStarterCode(index: number, event: Event): void {
    const next = this.copy();
    next[index].starterCode = this.value(event);
    this.activitiesChange.emit(next);
  }

  private copy(): EditableActivity[] {
    return this.activities().map((activity) => ({
      ...activity,
      options: activity.options?.map((option) => ({ ...option })),
      correctOptionIds: activity.correctOptionIds
        ? [...activity.correctOptionIds]
        : undefined,
      artifactTypes: activity.artifactTypes
        ? [...activity.artifactTypes]
        : undefined,
      rubric: activity.rubric
        ? {
            ...activity.rubric,
            criteria: activity.rubric.criteria.map((criterion) => ({
              ...criterion,
            })),
          }
        : undefined,
    }));
  }

  private value(event: Event): string {
    return (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  }

  private freshOptionId(): string {
    return `option-${Math.random().toString(36).slice(2, 10)}`;
  }
}

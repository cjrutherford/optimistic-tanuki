import { Component, computed, input, output } from '@angular/core';

export interface OutlineLesson {
  id: string;
  title: string;
  slug: string;
  body: string;
}

export interface OutlineModule {
  id: string;
  title: string;
  lessons: OutlineLesson[];
}

/** Which lesson is being written, addressed by position rather than by id. */
export interface LessonAddress {
  moduleIndex: number;
  lessonIndex: number;
}

/**
 * The shape of a course: its modules, its lessons, and the order they read in.
 *
 * Order is the whole point of an outline, so moving things is a first-class
 * action rather than something to be done by editing ids. Everything is
 * emitted as a whole new outline: the server replaces a course's structure
 * wholesale, and matching that here means there is no half-applied state to
 * reason about.
 *
 * Presentational only. It does not know how a course is stored, who may edit
 * it, or what a lesson body is written in.
 */
@Component({
  selector: 'otlearn-outline-editor',
  template: `
    <section class="outline">
      <header>
        <h2>Outline</h2>
        <button type="button" class="add" (click)="addModule()">
          Add module
        </button>
      </header>

      @if (!modules().length) {
      <p class="empty">
        No modules yet. A course needs at least one before it can be read.
      </p>
      } @for (module of modules(); track $index; let moduleIndex = $index) {
      <article class="module">
        <div class="module-head">
          <span class="grip" aria-hidden="true">:::</span>
          <input
            class="module-title"
            type="text"
            [value]="module.title"
            [attr.aria-label]="'Module ' + (moduleIndex + 1) + ' title'"
            (input)="renameModule(moduleIndex, $event)"
          />
          <div class="module-actions">
            <button
              type="button"
              [disabled]="moduleIndex === 0"
              [attr.aria-label]="'Move ' + module.title + ' up'"
              (click)="moveModule(moduleIndex, -1)"
            >
              ↑
            </button>
            <button
              type="button"
              [disabled]="moduleIndex === modules().length - 1"
              [attr.aria-label]="'Move ' + module.title + ' down'"
              (click)="moveModule(moduleIndex, 1)"
            >
              ↓
            </button>
            <button
              type="button"
              class="remove"
              [attr.aria-label]="'Remove ' + module.title"
              (click)="removeModule(moduleIndex)"
            >
              Remove
            </button>
          </div>
        </div>

        <ol class="lessons">
          @for (lesson of module.lessons; track $index; let lessonIndex =
          $index) {
          <li [class.selected]="isSelected(moduleIndex, lessonIndex)">
            <span class="grip lesson-grip" aria-hidden="true">:::</span>
            <button
              type="button"
              class="pick"
              (click)="pick(moduleIndex, lessonIndex)"
            >
              {{ lesson.title || 'Untitled lesson' }}
              @if (!lesson.body) {
              <span class="unwritten">Not written</span>
              }
            </button>
            <span class="lesson-actions">
              <button
                type="button"
                [disabled]="lessonIndex === 0"
                [attr.aria-label]="'Move ' + lesson.title + ' up'"
                (click)="moveLesson(moduleIndex, lessonIndex, -1)"
              >
                ↑
              </button>
              <button
                type="button"
                [disabled]="lessonIndex === module.lessons.length - 1"
                [attr.aria-label]="'Move ' + lesson.title + ' down'"
                (click)="moveLesson(moduleIndex, lessonIndex, 1)"
              >
                ↓
              </button>
              <button
                type="button"
                class="remove"
                [attr.aria-label]="'Remove ' + lesson.title"
                (click)="removeLesson(moduleIndex, lessonIndex)"
              >
                Remove
              </button>
            </span>
          </li>
          }
        </ol>

        <button type="button" class="add" (click)="addLesson(moduleIndex)">
          Add lesson
        </button>
      </article>
      }
    </section>
  `,
  styles: [
    `
      .outline {
        display: grid;
        gap: 1rem;
      }
      header {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 1rem;
      }
      h2 {
        margin: 0;
        font-size: 1rem;
      }
      .empty {
        margin: 0;
        color: var(--lx-text-muted, currentColor);
        font-size: 0.88rem;
      }
      .module {
        display: grid;
        gap: 0.6rem;
        padding: 0.9rem;
        border: var(--lx-border-width, 2px) var(--lx-border-style, solid)
          var(--lx-border-soft, currentColor);
        border-left-width: calc(var(--lx-border-width, 2px) + 2px);
        border-radius: var(--lx-radius, 2px);
        background-color: var(--lx-surface, transparent);
        background-image: var(--lx-surface-texture, none);
        box-shadow: var(--lx-shadow-card, none);
      }
      .module-head {
        display: flex;
        gap: 0.6rem;
        align-items: center;
        flex-wrap: wrap;
      }
      .module-title {
        flex: 1 1 12rem;
        min-width: 0;
        padding: 0.4rem 0.5rem;
        border: var(--lx-border-width, 2px) var(--lx-border-style, solid)
          var(--lx-border-soft, currentColor);
        border-radius: var(--lx-radius, 2px);
        background: var(--lx-surface, transparent);
        color: var(--lx-text, inherit);
        font: inherit;
        font-weight: 700;
        transition: var(--lx-btn-transition, all 0.1s steps(2));
      }
      .module-title:hover,
      .module-title:focus {
        border-color: var(--lx-accent, currentColor);
      }
      .grip {
        flex: 0 0 auto;
        color: var(--lx-text-faint, var(--lx-text-muted, currentColor));
        font: var(--lx-btn-weight, 700) 0.82rem/1 var(--lx-font-mono, monospace);
        letter-spacing: -0.12em;
        user-select: none;
      }
      .module-actions,
      .lesson-actions {
        display: flex;
        gap: 0.3rem;
      }
      button {
        min-height: 2.2rem;
        padding: 0.3rem 0.55rem;
        border: var(--lx-border-width, 2px) var(--lx-border-style, solid)
          var(--lx-border-soft, currentColor);
        border-radius: var(--lx-radius, 2px);
        background: var(--lx-surface, transparent);
        color: var(--lx-text-body, inherit);
        font: var(--lx-btn-weight, 700) 0.72rem var(--lx-font-mono, monospace);
        text-transform: var(--lx-btn-transform, uppercase);
        font-size: 0.8rem;
        cursor: pointer;
        transition: var(--lx-btn-transition, all 0.1s steps(2));
      }
      button:hover:not(:disabled) {
        border-color: var(--lx-accent, currentColor);
        box-shadow: var(--lx-shadow-control, none);
        transform: translate(-1px, -1px);
      }
      button:active:not(:disabled) {
        box-shadow: var(--lx-shadow-inset, none);
        transform: translate(1px, 1px);
      }
      button:disabled {
        opacity: 0.35;
        cursor: default;
        box-shadow: none;
      }
      button:focus-visible,
      input:focus-visible {
        outline: var(--lx-border-width, 2px) var(--lx-border-style, solid)
          var(--lx-focus, currentColor);
        outline-offset: 2px;
      }
      button.add {
        border-color: var(--lx-accent, currentColor);
        color: var(--lx-accent, currentColor);
        justify-self: start;
      }
      button.remove {
        color: var(--lx-danger, currentColor);
        border-color: var(--lx-danger, currentColor);
      }
      .lessons {
        margin: 0;
        padding: 0;
        list-style: none;
        display: grid;
        gap: 0.3rem;
      }
      .lessons li {
        display: flex;
        gap: 0.6rem;
        align-items: center;
        justify-content: space-between;
        padding: 0.25rem 0.35rem;
        border: var(--lx-border-width, 2px) var(--lx-border-style, solid)
          transparent;
        border-radius: var(--lx-radius, 2px);
        background: var(--lx-surface, transparent);
        transition: var(--lx-btn-transition, all 0.1s steps(2));
      }
      .lessons li.selected {
        border-color: var(--lx-accent, currentColor);
        background: var(--lx-surface-active, transparent);
      }
      .pick {
        flex: 1;
        min-width: 0;
        border: 0;
        background: transparent;
        color: var(--lx-text-body, inherit);
        text-align: left;
        font-size: 0.9rem;
      }
      .pick:hover:not(:disabled) {
        box-shadow: none;
        transform: none;
      }
      .lesson-grip {
        margin-left: 0.1rem;
      }
      .unwritten {
        margin-left: 0.5rem;
        color: var(--lx-text-muted, currentColor);
        font: 700 0.65rem var(--lx-font-mono, ui-monospace, monospace);
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
    `,
  ],
})
export class OutlineEditorComponent {
  readonly modules = input<OutlineModule[]>([]);
  readonly selected = input<LessonAddress | null>(null);

  /** The whole outline, every time. There is no partial update to merge. */
  readonly outlineChange = output<OutlineModule[]>();
  readonly selectLesson = output<LessonAddress>();

  protected isSelected(moduleIndex: number, lessonIndex: number): boolean {
    const selected = this.selected();
    return (
      selected?.moduleIndex === moduleIndex &&
      selected?.lessonIndex === lessonIndex
    );
  }

  protected pick(moduleIndex: number, lessonIndex: number): void {
    this.selectLesson.emit({ moduleIndex, lessonIndex });
  }

  protected addModule(): void {
    const next = this.copy();
    next.push({
      id: this.freshId('module'),
      title: `Module ${next.length + 1}`,
      lessons: [],
    });
    this.outlineChange.emit(next);
  }

  protected renameModule(moduleIndex: number, event: Event): void {
    const next = this.copy();
    next[moduleIndex].title = (event.target as HTMLInputElement).value;
    this.outlineChange.emit(next);
  }

  protected removeModule(moduleIndex: number): void {
    const next = this.copy();
    next.splice(moduleIndex, 1);
    this.outlineChange.emit(next);
  }

  protected moveModule(moduleIndex: number, direction: -1 | 1): void {
    const next = this.copy();
    const target = moduleIndex + direction;
    if (target < 0 || target >= next.length) return;
    [next[moduleIndex], next[target]] = [next[target], next[moduleIndex]];
    this.outlineChange.emit(next);
  }

  protected addLesson(moduleIndex: number): void {
    const next = this.copy();
    const count = next[moduleIndex].lessons.length + 1;
    next[moduleIndex].lessons.push({
      id: this.freshId('lesson'),
      title: `Lesson ${count}`,
      slug: `lesson-${count}`,
      body: '',
    });
    this.outlineChange.emit(next);
    this.selectLesson.emit({
      moduleIndex,
      lessonIndex: next[moduleIndex].lessons.length - 1,
    });
  }

  protected removeLesson(moduleIndex: number, lessonIndex: number): void {
    const next = this.copy();
    next[moduleIndex].lessons.splice(lessonIndex, 1);
    this.outlineChange.emit(next);
  }

  protected moveLesson(
    moduleIndex: number,
    lessonIndex: number,
    direction: -1 | 1
  ): void {
    const next = this.copy();
    const lessons = next[moduleIndex].lessons;
    const target = lessonIndex + direction;
    if (target < 0 || target >= lessons.length) return;
    [lessons[lessonIndex], lessons[target]] = [
      lessons[target],
      lessons[lessonIndex],
    ];
    this.outlineChange.emit(next);
    // The lesson being written follows the move, rather than the selection
    // staying on whatever slid into its place.
    if (this.isSelected(moduleIndex, lessonIndex)) {
      this.selectLesson.emit({ moduleIndex, lessonIndex: target });
    }
  }

  /** A deep copy, so nothing the caller holds is mutated underneath it. */
  private copy(): OutlineModule[] {
    return this.modules().map((module) => ({
      ...module,
      lessons: module.lessons.map((lesson) => ({ ...lesson })),
    }));
  }

  private freshId(kind: string): string {
    return `${kind}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

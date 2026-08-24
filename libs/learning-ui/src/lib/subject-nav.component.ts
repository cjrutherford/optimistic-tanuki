import { Component, computed, input, output } from '@angular/core';

export interface SubjectNavItem {
  subjectId: string;
  displayName: string;
  courseCount: number;
}

/**
 * The first thing a visitor meets: what this platform teaches.
 *
 * Subjects come from the catalog rather than a fixed list, because a universal
 * platform cannot know its subjects in advance. Selecting nothing means "all",
 * which is the state a visitor arrives in.
 *
 * Presentational only. It knows nothing about courses, enrolment, or where the
 * catalog came from.
 */
@Component({
  selector: 'otlearn-subject-nav',
  template: `
    <nav class="subjects" [attr.aria-label]="ariaLabel()">
      <button
        type="button"
        class="chip"
        [class.selected]="!selected()"
        [attr.aria-pressed]="!selected()"
        (click)="select.emit('')"
      >
        {{ allLabel() }}
        <span class="count">{{ totalCourses() }}</span>
      </button>
      @for (subject of subjects(); track subject.subjectId) {
      <button
        type="button"
        class="chip"
        [class.selected]="selected() === subject.subjectId"
        [attr.aria-pressed]="selected() === subject.subjectId"
        (click)="select.emit(subject.subjectId)"
      >
        {{ subject.displayName }}
        <span class="count">{{ subject.courseCount }}</span>
      </button>
      }
    </nav>
  `,
  styles: [
    `
      .subjects {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }
      .chip {
        display: inline-flex;
        align-items: baseline;
        gap: 0.45rem;
        padding: 0.45rem 0.85rem;
        border: 1px solid var(--lx-border-soft, currentColor);
        border-radius: 999px;
        background: transparent;
        color: var(--lx-text-body, currentColor);
        font: inherit;
        font-size: 0.9rem;
        cursor: pointer;
      }
      .chip:hover {
        background: var(--lx-surface-hover, transparent);
      }
      .chip.selected {
        border-color: var(--lx-accent, currentColor);
        color: var(--lx-accent, currentColor);
      }
      .count {
        color: var(--lx-text-muted, currentColor);
        font: 700 0.72rem ui-monospace, monospace;
      }
      .chip.selected .count {
        color: inherit;
      }
    `,
  ],
})
export class SubjectNavComponent {
  readonly subjects = input<SubjectNavItem[]>([]);
  /** Empty string means every subject, which is the default. */
  readonly selected = input<string>('');
  readonly allLabel = input<string>('Everything');
  readonly ariaLabel = input<string>('Subjects');

  readonly select = output<string>();

  protected readonly totalCourses = computed(() =>
    this.subjects().reduce((total, subject) => total + subject.courseCount, 0)
  );
}

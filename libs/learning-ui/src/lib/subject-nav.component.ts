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
        gap: 0.6rem;
      }
      .chip {
        display: inline-flex;
        align-items: baseline;
        gap: 0.5rem;
        padding: 0.45rem 0.85rem;
        border: var(--lx-border-width) var(--lx-border-style)
          var(--lx-border-soft, currentColor);
        border-radius: var(--lx-radius);
        background: var(--lx-surface);
        color: var(--lx-text-body, currentColor);
        font-family: var(--lx-font-mono, ui-monospace, monospace);
        font-size: 0.82rem;
        font-weight: var(--lx-btn-weight, 800);
        letter-spacing: 0.03em;
        text-transform: uppercase;
        cursor: pointer;
        box-shadow: var(--lx-shadow-sm);
        transition: var(--lx-btn-transition);
      }
      .chip:hover {
        background: var(--lx-surface-hover, transparent);
        border-color: var(--lx-border-hard);
        box-shadow: var(--lx-shadow-control);
      }
      .chip:active {
        transform: translate(1px, 1px);
        box-shadow: var(--lx-shadow-inset);
      }
      .chip:focus-visible {
        outline: 2px solid var(--lx-focus);
        outline-offset: 2px;
      }
      .chip.selected {
        border-color: var(--lx-accent, currentColor);
        background: var(--lx-accent);
        color: var(--lx-bg);
        box-shadow: var(--lx-shadow-sm);
      }
      .count {
        color: var(--lx-text-muted, currentColor);
        font: 700 0.72rem var(--lx-font-mono, ui-monospace, monospace);
      }
      .chip.selected .count {
        color: inherit;
        opacity: 0.8;
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

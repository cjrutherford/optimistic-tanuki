import { Component, computed, input, output } from '@angular/core';
import { ButtonComponent } from '@optimistic-tanuki/common-ui';

/**
 * Saying you have read a lesson.
 *
 * Progress used to be recorded only as a side effect of passing a code
 * exercise, which meant a course without code could be enrolled in and read
 * but never progressed through. Most subjects have no code in them.
 *
 * Presentational only: it does not know whether saving is allowed, only how to
 * ask.
 */
@Component({
  selector: 'otlearn-lesson-completion',
  imports: [ButtonComponent],
  template: `
    <div class="completion">
      @if (completed()) {
      <p class="done" role="status">Read.</p>
      <button type="button" class="undo" (click)="toggle.emit(false)">
        Mark as unread
      </button>
      } @else {
      <otui-button
        variant="primary"
        [useGradient]="false"
        [disabled]="busy()"
        (action)="toggle.emit(true)"
      >
        {{ busy() ? 'Saving…' : 'Mark as read' }}
      </otui-button>
      } @if (error()) {
      <span class="error" role="status">{{ error() }}</span>
      }
    </div>
  `,
  styles: [
    `
      .completion {
        display: flex;
        gap: 0.7rem;
        align-items: center;
        flex-wrap: wrap;
        margin-top: 2rem;
        padding-top: 1.2rem;
        border-top: 1px solid var(--lx-border-soft, currentColor);
      }
      .done {
        margin: 0;
        color: var(--lx-accent, currentColor);
        font: 700 0.8rem var(--lx-font-mono, ui-monospace, monospace);
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .undo {
        border: 0;
        background: transparent;
        color: var(--lx-text-muted, currentColor);
        font: inherit;
        font-size: 0.82rem;
        text-decoration: underline;
        cursor: pointer;
      }
      .error {
        color: var(--lx-danger, currentColor);
        font-size: 0.82rem;
      }
    `,
  ],
})
export class LessonCompletionComponent {
  readonly completed = input<boolean>(false);
  readonly busy = input<boolean>(false);
  readonly error = input<string>('');

  /** True to mark read, false to undo it. */
  readonly toggle = output<boolean>();

  protected readonly label = computed(() =>
    this.completed() ? 'Read' : 'Mark as read'
  );
}

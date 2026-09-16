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
    <div
      class="completion"
      [class.is-complete]="completed()"
      [class.is-busy]="busy()"
      [attr.aria-busy]="busy() ? 'true' : null"
    >
      @if (completed()) {
      <p class="done" role="status" aria-live="polite">
        <span class="completion-mark" aria-hidden="true">✓</span>
        <span>Read.</span>
      </p>
      <button
        type="button"
        class="undo"
        [disabled]="busy()"
        (click)="toggle.emit(false)"
      >
        {{ busy() ? 'Saving…' : 'Mark as unread' }}
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
        padding: 1.2rem 0 0;
        border-top: var(--lx-border-width, 2px) var(--lx-border-style, solid)
          var(--lx-border-soft, currentColor);
      }
      .completion.is-complete {
        border-top-color: var(--lx-accent);
      }
      .done {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        min-height: 2.35rem;
        margin: 0;
        padding: 0.35rem 0.6rem 0.35rem 0.4rem;
        border: var(--lx-border-width, 2px) var(--lx-border-style, solid)
          var(--lx-accent);
        border-radius: var(--lx-radius, 2px);
        background: var(--lx-surface-active);
        color: var(--lx-on-surface-active, var(--lx-text, currentColor));
        box-shadow: var(--lx-shadow-inset);
        font: var(--lx-btn-weight, 800) 0.8rem/1
          var(--lx-font-mono, ui-monospace, monospace);
        letter-spacing: 0.08em;
        text-transform: var(--lx-btn-transform, uppercase);
      }
      .completion-mark {
        display: inline-grid;
        width: 1.35rem;
        height: 1.35rem;
        place-items: center;
        border: var(--lx-border-width, 2px) var(--lx-border-style, solid)
          var(--lx-accent);
        background: var(--lx-surface);
        color: var(--lx-accent);
        box-shadow: var(--lx-shadow-sm);
      }
      .undo {
        min-height: 2.35rem;
        padding: 0.4rem 0.7rem;
        border: var(--lx-border-width, 2px) var(--lx-border-style, solid)
          var(--lx-border-soft, currentColor);
        border-radius: var(--lx-radius, 2px);
        background: var(--lx-surface);
        color: var(--lx-text-muted, currentColor);
        box-shadow: var(--lx-shadow-sm);
        font: var(--lx-btn-weight, 800) 0.68rem/1
          var(--lx-font-mono, ui-monospace, monospace);
        text-transform: var(--lx-btn-transform, uppercase);
        cursor: pointer;
        transition: var(--lx-btn-transition, all 0.1s steps(2));
      }
      .undo:hover:not(:disabled) {
        border-color: var(--lx-accent);
        background: var(--lx-surface-hover);
        color: var(--lx-text);
        box-shadow: var(--lx-shadow-control);
        transform: translateY(-1px);
      }
      .undo:active:not(:disabled) {
        box-shadow: var(--lx-shadow-inset);
        transform: translate(1px, 1px);
      }
      .undo:disabled {
        cursor: not-allowed;
        opacity: 0.62;
      }
      .error {
        color: var(--lx-danger, currentColor);
        font-size: 0.82rem;
      }
      otui-button {
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
      @media (prefers-reduced-motion: reduce) {
        .undo {
          transition: none;
        }
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

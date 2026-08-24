import { Component, computed, input, output } from '@angular/core';
import { LessonProseComponent } from './lesson-prose.component';

/**
 * Writing one lesson: its title, the address readers reach it by, and its text.
 *
 * The preview is rendered by whoever uses this, and handed back as
 * `previewHtml`. That keeps the markdown pipeline out of this library, and
 * more importantly means the preview a writer sees comes from the same
 * renderer a reader gets rather than a second one that drifts from it.
 *
 * Presentational only.
 */
@Component({
  selector: 'otlearn-lesson-editor',
  imports: [LessonProseComponent],
  template: `
    <section class="editor">
      <header>
        <label>
          <span>Title</span>
          <input
            type="text"
            [value]="title()"
            (input)="titleChange.emit(value($event))"
          />
        </label>
        <label>
          <span>Address</span>
          <input
            type="text"
            [value]="slug()"
            (input)="slugChange.emit(value($event))"
          />
        </label>
      </header>
      @if (slugWarning()) {
      <p class="warning" role="status">{{ slugWarning() }}</p>
      }

      <div class="panes">
        <label class="write">
          <span>Lesson</span>
          <textarea
            rows="20"
            [value]="body()"
            placeholder="Write in Markdown. Fenced code blocks are highlighted."
            (input)="bodyChange.emit(value($event))"
          ></textarea>
        </label>
        <div class="preview">
          <span class="label">Preview</span>
          @if (body()) {
          <otlearn-lesson-prose
            class="prose"
            [html]="previewHtml()"
          ></otlearn-lesson-prose>
          } @else {
          <p class="empty">Nothing written yet.</p>
          }
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      .editor {
        display: grid;
        gap: 0.9rem;
      }
      header {
        display: flex;
        gap: 1rem;
        flex-wrap: wrap;
      }
      label {
        display: grid;
        gap: 0.25rem;
        flex: 1 1 12rem;
      }
      label span,
      .label {
        color: var(--lx-text-muted, currentColor);
        font-size: 0.72rem;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }
      input,
      textarea {
        width: 100%;
        padding: 0.45rem 0.55rem;
        border: 1px solid var(--lx-border-soft, currentColor);
        border-radius: var(--lx-radius, 2px);
        background: transparent;
        color: inherit;
        font: inherit;
      }
      textarea {
        font-family: var(--lx-font-mono, ui-monospace, monospace);
        font-size: 0.85rem;
        line-height: 1.6;
        resize: vertical;
      }
      .warning {
        margin: 0;
        color: var(--lx-warn, currentColor);
        font-size: 0.82rem;
      }
      .panes {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
        align-items: start;
      }
      .preview {
        display: grid;
        gap: 0.25rem;
        min-width: 0;
      }
      .prose {
        min-width: 0;
        max-height: 30rem;
        overflow: auto;
        padding: 0.75rem;
        border: 1px solid var(--lx-border-soft, currentColor);
        border-radius: var(--lx-radius, 2px);
      }
      .empty {
        margin: 0;
        color: var(--lx-text-muted, currentColor);
        font-size: 0.85rem;
      }
      @media (max-width: 900px) {
        .panes {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class LessonEditorComponent {
  readonly title = input<string>('');
  readonly slug = input<string>('');
  readonly body = input<string>('');
  /** Rendered by the caller, with the same pipeline a reader gets. */
  readonly previewHtml = input<string>('');

  readonly titleChange = output<string>();
  readonly slugChange = output<string>();
  readonly bodyChange = output<string>();

  /**
   * A slug is part of a URL and is what exercises are matched on, so a
   * malformed one fails quietly later rather than loudly here.
   */
  protected readonly slugWarning = computed(() => {
    const slug = this.slug();
    if (!slug) return 'An address is needed before this lesson can be opened.';
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
      return 'Use lowercase letters, numbers and single hyphens.';
    }
    return '';
  });

  protected value(event: Event): string {
    return (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  }
}

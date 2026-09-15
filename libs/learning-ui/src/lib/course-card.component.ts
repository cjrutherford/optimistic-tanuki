import { Component, computed, input } from '@angular/core';

/**
 * One course in a catalog listing.
 *
 * Says nothing about a programming language: the label above the title is
 * whatever the course varies along, and a course that varies along nothing
 * shows no label at all rather than an empty space.
 *
 * Presentational only, and deliberately not a link. The catalog decides where
 * a course goes, so this can be used in a list, a grid, or a search result
 * without carrying a route with it.
 */
@Component({
  selector: 'otlearn-course-card',
  template: `
    <article class="card">
      <header>
        @if (variantLabel()) {
        <small class="variant">{{ variantLabel() }}</small>
        } @if (isDraft()) {
        <small class="draft">Draft</small>
        }
      </header>
      <h2>{{ displayName() }}</h2>
      @if (description()) {
      <p class="description">{{ description() }}</p>
      }
      <p class="facts">{{ facts() }}</p>
      @if (authorName()) {
      <p class="author">Written by {{ authorName() }}</p>
      }
    </article>
  `,
  styles: [
    `
      .card {
        display: grid;
        gap: 0.5rem;
        padding: 1.35rem 1.6rem;
        background-color: var(--lx-surface);
        background-image: var(--lx-surface-texture);
        border: var(--lx-border-width) var(--lx-border-style)
          var(--lx-border-soft);
        border-left: calc(var(--lx-border-width) + 3px) var(--lx-border-style)
          var(--lx-accent);
        border-radius: var(--lx-radius);
        box-shadow: var(--lx-shadow-card);
        transition: var(--lx-btn-transition);
      }
      :host-context(a:hover) .card,
      .card:hover {
        border-color: var(--lx-accent);
        box-shadow: var(--lx-shadow-control);
        transform: translate(-1px, -1px);
      }
      header {
        display: flex;
        gap: 0.6rem;
        align-items: center;
        min-height: 1rem;
      }
      .variant,
      .draft {
        font: 700 0.68rem var(--lx-font-mono, ui-monospace, monospace);
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }
      .variant {
        color: var(--lx-accent, currentColor);
      }
      .draft {
        padding: 0.1rem 0.4rem;
        border: var(--lx-border-width) dashed
          var(--lx-border-hard, currentColor);
        border-radius: var(--lx-radius, 2px);
        color: var(--lx-text-muted, currentColor);
      }
      h2 {
        margin: 0;
        font-family: var(--lx-font-heading);
        font-size: 1.25rem;
        letter-spacing: -0.01em;
      }
      .description {
        margin: 0;
        max-width: 65ch;
        color: var(--lx-text-body, currentColor);
        font-size: 0.94rem;
        line-height: 1.55;
      }
      .facts,
      .author {
        margin: 0;
        color: var(--lx-text-muted, currentColor);
        font-size: 0.85rem;
        font-family: var(--lx-font-mono, ui-monospace, monospace);
      }
    `,
  ],
})
export class CourseCardComponent {
  readonly displayName = input<string>('');
  readonly description = input<string>('');
  /** What this course varies along, such as a language. Often nothing. */
  readonly variantLabel = input<string>('');
  readonly isDraft = input<boolean>(false);
  readonly lessonCount = input<number>(0);
  readonly credits = input<number>(0);
  readonly level = input<number>(0);
  readonly authorName = input<string>('');

  /**
   * The one-line summary under the title.
   *
   * Assembled from whatever is actually known, so a course with no credits and
   * no lessons yet reads as "No lessons yet" instead of "0 lessons · 0 credits".
   */
  protected readonly facts = computed(() => {
    const parts: string[] = [];
    const lessons = this.lessonCount();
    parts.push(
      lessons === 0
        ? 'No lessons yet'
        : `${lessons} ${lessons === 1 ? 'lesson' : 'lessons'}`
    );
    if (this.level()) parts.push(`Level ${this.level()}`);
    const credits = this.credits();
    if (credits)
      parts.push(`${credits} ${credits === 1 ? 'credit' : 'credits'}`);
    return parts.join(' · ');
  });
}

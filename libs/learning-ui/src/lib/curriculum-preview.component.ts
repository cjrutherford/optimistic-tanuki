import { Component, input, output } from '@angular/core';

export interface CurriculumPreviewCourse {
  offeringId: string;
  displayName: string;
  /** Who it is for, in its author's words. Blank on a course that has not said. */
  audience: string;
  lessonCount: number;
  subjectName: string;
}

/**
 * What is actually in the catalog, shown before anybody commits to it.
 *
 * The original landing pages hardcoded their module lists, which is how a
 * marketing page goes stale: the curriculum moves and the page keeps promising
 * the old one. This takes the live catalog, so it cannot describe a course that
 * is not there.
 *
 * It shows each course's audience rather than its description, because on a
 * landing page the question a reader is asking is "is this for me", not "what
 * is it about".
 */
@Component({
  selector: 'otlearn-curriculum-preview',
  template: `
    <section class="preview">
      <header>
        <h2>{{ heading() }}</h2>
        @if (subheading()) {
        <p>{{ subheading() }}</p>
        }
      </header>

      @if (courses().length) {
      <ul>
        @for (course of courses(); track course.offeringId) {
        <li>
          <button type="button" (click)="open.emit(course.offeringId)">
            <span class="subject">{{ course.subjectName }}</span>
            <span class="name">{{ course.displayName }}</span>
            @if (course.audience) {
            <span class="audience">{{ course.audience }}</span>
            }
            <span class="count"
              >{{ course.lessonCount }}
              {{ course.lessonCount === 1 ? 'lesson' : 'lessons' }}</span
            >
          </button>
        </li>
        }
      </ul>
      } @else {
      <!--
        An empty catalog is a real state on a fresh install, and it should not
        render as an empty grid that looks broken.
      -->
      <p class="empty">{{ emptyMessage() }}</p>
      }
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .preview {
        padding: 3rem 0;
        border-top: 1px solid var(--lx-rule, currentColor);
      }
      header h2 {
        margin: 0;
        font-family: var(--lx-font-heading);
        font-size: clamp(1.5rem, 3vw, 2.1rem);
        letter-spacing: -0.02em;
      }
      header p {
        margin: 0.6rem 0 0;
        max-width: 58ch;
        color: var(--lx-text-dim, inherit);
      }
      ul {
        list-style: none;
        margin: 2rem 0 0;
        padding: 0;
        display: grid;
        gap: 1px;
        background: var(--lx-rule, currentColor);
        border: 1px solid var(--lx-rule, currentColor);
      }
      @media (min-width: 48rem) {
        ul {
          grid-template-columns: repeat(2, 1fr);
        }
      }
      li {
        background: var(--lx-surface, transparent);
      }
      button {
        display: grid;
        gap: 0.4rem;
        width: 100%;
        height: 100%;
        padding: 1.25rem 1.35rem;
        font: inherit;
        text-align: left;
        color: inherit;
        background: none;
        border: 0;
        cursor: pointer;
      }
      button:hover,
      button:focus-visible {
        background: var(--lx-surface-2, transparent);
      }
      button:focus-visible {
        outline: 2px solid var(--lx-focus, var(--lx-accent));
        outline-offset: -2px;
      }
      .subject {
        font-family: var(--lx-font-mono);
        font-size: 0.66rem;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--lx-accent);
      }
      .name {
        font-family: var(--lx-font-heading);
        font-size: 1.2rem;
        letter-spacing: -0.01em;
      }
      .audience {
        font-size: 0.9rem;
        line-height: 1.55;
        color: var(--lx-text-dim, inherit);
      }
      .count {
        font-family: var(--lx-font-mono);
        font-size: 0.72rem;
        color: var(--lx-text-dim, inherit);
      }
      .empty {
        margin: 2rem 0 0;
        color: var(--lx-text-dim, inherit);
      }
    `,
  ],
})
export class CurriculumPreviewComponent {
  readonly heading = input<string>('What is here');
  readonly subheading = input<string>('');
  readonly courses = input<CurriculumPreviewCourse[]>([]);
  readonly emptyMessage = input<string>(
    'No courses have been published yet. If you have something to teach, this is a good moment.'
  );

  readonly open = output<string>();
}

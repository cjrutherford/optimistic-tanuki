import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { LoadingStateComponent } from '@optimistic-tanuki/common-ui';
import { CourseCardComponent } from '@optimistic-tanuki/learning-ui';
import { LearningLayoutComponent } from './learning-layout.component';
import { LearningDataService } from './learning-data.service';

/**
 * An author's own courses, and the way in for somebody who has not written
 * one before.
 *
 * Authorship is opt-in, so this page has two states: an invitation, and a
 * list. Nothing else in the product lists a draft to the person writing it.
 */
@Component({
  selector: 'learning-author',
  imports: [
    LearningLayoutComponent,
    LoadingStateComponent,
    CourseCardComponent,
    RouterLink,
  ],
  template: `<learning-layout>
    <header>
      <p class="eyebrow">Writing</p>
      <h1>Your courses.</h1>
    </header>

    @if (status(); as authorStatus) { @if (!authorStatus.isCourseDesigner) {
    <section class="panel invite" aria-labelledby="author-invite-title">
      <p class="panel-kicker">Author access</p>
      <h2 id="author-invite-title">Make something useful.</h2>
      <p>
        Anyone can write a course here. You keep control of what you write:
        nobody else can change it unless you invite them, and nothing is visible
        until you publish it.
      </p>
      <button
        type="button"
        class="primary"
        (click)="optIn()"
        [disabled]="working()"
        [attr.aria-busy]="working()"
      >
        {{ working() ? 'Just a moment…' : 'Start writing' }}
      </button>
      @if (error()) {
      <p class="error" role="alert">{{ error() }}</p>
      }
    </section>
    } @else {
    <section class="panel new" aria-labelledby="new-course-title">
      <p class="panel-kicker">Course authoring</p>
      <h2 id="new-course-title">Open a new course</h2>
      <div class="fields">
        <label>
          <span>Name</span>
          <input
            type="text"
            [value]="newName()"
            placeholder="Intro to Watercolour"
            (input)="newName.set(value($event))"
          />
        </label>
        <label>
          <span>Subject</span>
          <input
            type="text"
            [value]="newSubject()"
            placeholder="art"
            (input)="newSubject.set(value($event))"
          />
        </label>
        <button
          type="button"
          class="primary"
          [disabled]="!canCreate() || working()"
          [attr.aria-busy]="working()"
          (click)="create()"
        >
          {{ working() ? 'Opening…' : 'Open it' }}
        </button>
      </div>
      <p class="hint">
        A new course starts empty and unpublished. Nobody sees it but you.
      </p>
      @if (error()) {
      <p class="error" role="alert">{{ error() }}</p>
      }
    </section>

    @if (courses(); as mine) { @if (mine.length) {
    <section class="courses" aria-label="Your courses">
      @for (course of mine; track course.offering.id) {
      <a class="course" [routerLink]="['/author', course.offering.id]">
        <div class="course-meta">
          <span
            class="badge status"
            [class.published]="course.offering.status === 'published'"
            [class.draft]="course.offering.status !== 'published'"
            >{{
              course.offering.status === 'published' ? 'Published' : 'Draft'
            }}</span
          >
          <span class="badge role">{{
            course.isOwner ? 'Owner' : 'Co-editor'
          }}</span>
          @if (!course.isOwner) {
          <span class="sr-only">You co-edit this one</span>
          }
        </div>
        <otlearn-course-card
          [displayName]="course.offering.displayName"
          [description]="course.offering.description ?? ''"
          [isDraft]="course.offering.status !== 'published'"
          [lessonCount]="course.lessonCount"
          [credits]="course.offering.credits"
          [level]="course.offering.level"
        ></otlearn-course-card>
      </a>
      }
    </section>
    } @else {
    <section class="panel empty" aria-labelledby="author-empty-title">
      <p class="panel-kicker">Workspace clear</p>
      <h2 id="author-empty-title">You have not written anything yet.</h2>
      <p>Open a draft above and build the outline one useful step at a time.</p>
    </section>
    } } } } @else {
    <otui-loading-state headline="Loading your courses"></otui-loading-state>
    }
  </learning-layout>`,
  styles: [
    `
      .eyebrow {
        margin: 0;
        color: var(--lx-accent);
        font: 700 0.7rem var(--lx-font-mono, ui-monospace, monospace);
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }
      h1 {
        margin: 0.6rem 0 2rem;
        font-size: clamp(2.2rem, 4vw, 3.6rem);
        line-height: 0.98;
        letter-spacing: -0.045em;
      }
      h2 {
        margin: 0;
        font-family: var(--lx-font-heading);
        font-size: clamp(1.35rem, 3vw, 2rem);
        line-height: 1.05;
      }
      .invite p,
      .hint,
      .empty p {
        max-width: 58ch;
        color: var(--lx-text-muted);
      }
      .panel {
        display: grid;
        gap: 0.8rem;
        padding: clamp(1.1rem, 3vw, 1.6rem);
        border: var(--lx-border-width) var(--lx-border-style)
          var(--lx-border-soft);
        border-left-width: calc(var(--lx-border-width) + 3px);
        border-left-color: var(--lx-accent);
        border-radius: var(--lx-radius);
        background-color: var(--lx-surface);
        background-image: var(--lx-surface-texture);
        box-shadow: var(--lx-shadow-card);
      }
      .panel-kicker {
        margin: 0;
        color: var(--lx-accent);
        font: var(--lx-btn-weight) 0.68rem var(--lx-font-mono);
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }
      .invite {
        justify-items: start;
      }
      .new {
        margin-bottom: 1.5rem;
      }
      .fields {
        display: flex;
        gap: 0.75rem;
        align-items: end;
        flex-wrap: wrap;
      }
      label {
        display: grid;
        gap: 0.25rem;
      }
      label span {
        color: var(--lx-text-muted);
        font-size: 0.72rem;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }
      input {
        min-width: min(15rem, 100%);
        padding: 0.45rem 0.55rem;
        border: var(--lx-border-width) var(--lx-border-style)
          var(--lx-border-soft);
        border-radius: var(--lx-radius);
        background: var(--lx-surface);
        color: var(--lx-text);
        font: inherit;
        transition: var(--lx-btn-transition);
      }
      input:hover {
        border-color: var(--lx-border-strong);
      }
      input:focus-visible,
      button:focus-visible,
      .course:focus-visible {
        outline: var(--lx-border-width) var(--lx-border-style) var(--lx-focus);
        outline-offset: 3px;
      }
      button {
        min-height: 2.55rem;
        padding: 0.5rem 0.9rem;
        border: var(--lx-border-width) var(--lx-border-style) var(--lx-accent);
        border-radius: var(--lx-radius);
        background: transparent;
        color: var(--lx-accent);
        font: var(--lx-btn-weight) 0.75rem var(--lx-font-mono);
        text-transform: var(--lx-btn-transform);
        cursor: pointer;
        transition: var(--lx-btn-transition);
      }
      button.primary {
        background: var(--lx-accent);
        color: var(--lx-bg);
        box-shadow: var(--lx-shadow-sm);
      }
      button:hover:not(:disabled) {
        box-shadow: var(--lx-shadow-control);
        transform: translate(-1px, -1px);
      }
      button:active:not(:disabled) {
        box-shadow: var(--lx-shadow-inset);
        transform: translate(1px, 1px);
      }
      button:disabled {
        opacity: 0.4;
        cursor: default;
        box-shadow: none;
      }
      .hint {
        margin: 0.75rem 0 0;
        font-size: 0.85rem;
      }
      .courses {
        display: grid;
        gap: 1rem;
      }
      .course {
        display: block;
        color: inherit;
        text-decoration: none;
      }
      .course:hover {
        color: inherit;
      }
      .course-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        margin: 0 0 -0.55rem 0.75rem;
        position: relative;
        z-index: 1;
      }
      .badge {
        padding: 0.22rem 0.45rem;
        border: var(--lx-border-width) var(--lx-border-style)
          var(--lx-border-soft);
        border-radius: var(--lx-radius);
        background: var(--lx-surface);
        font: var(--lx-btn-weight) 0.65rem var(--lx-font-mono);
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .badge.published {
        border-color: var(--lx-accent);
        color: var(--lx-accent);
      }
      .badge.draft {
        border-style: dashed;
        color: var(--lx-warn);
      }
      .badge.role {
        color: var(--lx-text-muted);
      }
      .empty,
      .error {
        margin-top: 1.5rem;
        color: var(--lx-text-muted);
      }
      .empty {
        margin-top: 0;
      }
      .error {
        color: var(--lx-danger);
      }
      @media (max-width: 600px) {
        .fields {
          align-items: stretch;
          flex-direction: column;
        }
        .fields label,
        .fields button {
          width: 100%;
        }
        input {
          width: 100%;
          box-sizing: border-box;
        }
      }
    `,
  ],
})
export class AuthorComponent {
  private readonly data = inject(LearningDataService);
  private readonly router = inject(Router);

  readonly status = signal<{ isCourseDesigner: boolean } | undefined>(
    undefined
  );
  readonly courses = toSignal(this.data.myCourses());

  readonly newName = signal('');
  readonly newSubject = signal('');
  readonly working = signal(false);
  readonly error = signal('');

  constructor() {
    this.data.authorStatus().subscribe({
      next: (status) => this.status.set(status),
      // A visitor with no session is not an author, which is the honest
      // answer here rather than a spinner that never resolves.
      error: () => this.status.set({ isCourseDesigner: false }),
    });
  }

  protected canCreate(): boolean {
    return Boolean(this.newName().trim() && this.newSubject().trim());
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  optIn(): void {
    this.working.set(true);
    this.error.set('');
    this.data.optInAsAuthor().subscribe({
      next: () => {
        this.status.set({ isCourseDesigner: true });
        this.working.set(false);
      },
      error: (failure: { status?: number }) => {
        this.working.set(false);
        this.error.set(
          failure?.status === 401
            ? 'Sign in to write a course.'
            : 'Could not start just now. Try again.'
        );
      },
    });
  }

  create(): void {
    this.working.set(true);
    this.error.set('');
    this.data
      .createCourse({
        displayName: this.newName().trim(),
        subjectId: this.newSubject().trim().toLowerCase(),
      })
      .subscribe({
        next: (created) => {
          this.working.set(false);
          // A track holds one authored offering and they share an id, so the
          // track id is what the editor is addressed by.
          this.router.navigate(['/author', created.track.id]);
        },
        error: (failure: { status?: number }) => {
          this.working.set(false);
          this.error.set(
            failure?.status === 403
              ? 'You need to start writing before opening a course.'
              : 'Could not open the course. Try again.'
          );
        },
      });
  }
}

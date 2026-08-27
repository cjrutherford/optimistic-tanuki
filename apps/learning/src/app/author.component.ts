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
    <section class="invite">
      <p>
        Anyone can write a course here. You keep control of what you write:
        nobody else can change it unless you invite them, and nothing is visible
        until you publish it.
      </p>
      <button type="button" (click)="optIn()" [disabled]="working()">
        {{ working() ? 'Just a moment…' : 'Start writing' }}
      </button>
      @if (error()) {
      <p class="error">{{ error() }}</p>
      }
    </section>
    } @else {
    <section class="new">
      <h2>Open a new course</h2>
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
          [disabled]="!canCreate() || working()"
          (click)="create()"
        >
          {{ working() ? 'Opening…' : 'Open it' }}
        </button>
      </div>
      <p class="hint">
        A new course starts empty and unpublished. Nobody sees it but you.
      </p>
      @if (error()) {
      <p class="error">{{ error() }}</p>
      }
    </section>

    @if (courses(); as mine) { @if (mine.length) {
    <section class="courses" aria-label="Your courses">
      @for (course of mine; track course.offering.id) {
      <a class="course" [routerLink]="['/author', course.offering.id]">
        <otlearn-course-card
          [displayName]="course.offering.displayName"
          [description]="course.offering.description ?? ''"
          [isDraft]="course.offering.status !== 'published'"
          [lessonCount]="course.lessonCount"
          [credits]="course.offering.credits"
          [level]="course.offering.level"
        ></otlearn-course-card>
        @if (!course.isOwner) {
        <span class="role">You co-edit this one</span>
        }
      </a>
      }
    </section>
    } @else {
    <p class="empty">You have not written anything yet.</p>
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
        margin: 0 0 0.75rem;
        font-size: 1rem;
      }
      .invite p,
      .hint {
        max-width: 58ch;
        color: var(--lx-text-muted);
      }
      .invite {
        display: grid;
        gap: 1rem;
        justify-items: start;
      }
      .new {
        padding-bottom: 1.75rem;
        border-bottom: 1px solid var(--lx-border-soft);
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
        padding: 0.45rem 0.55rem;
        border: 1px solid var(--lx-border-soft);
        border-radius: var(--lx-radius, 2px);
        background: transparent;
        color: inherit;
        font: inherit;
      }
      button {
        padding: 0.5rem 0.9rem;
        border: 1px solid var(--lx-accent);
        border-radius: var(--lx-radius, 2px);
        background: transparent;
        color: var(--lx-accent);
        font: inherit;
        cursor: pointer;
      }
      button:disabled {
        opacity: 0.4;
        cursor: default;
      }
      .hint {
        margin: 0.75rem 0 0;
        font-size: 0.85rem;
      }
      .courses {
        margin-top: 1.5rem;
        border-top: 1px solid var(--lx-border-soft);
      }
      .course {
        display: block;
        border-bottom: 1px solid var(--lx-border-soft);
        color: inherit;
        text-decoration: none;
      }
      .course:hover {
        background: var(--lx-surface-hover);
      }
      .role {
        display: block;
        padding: 0 0.35rem 0.9rem;
        color: var(--lx-text-muted);
        font-size: 0.8rem;
      }
      .empty,
      .error {
        margin-top: 1.5rem;
        color: var(--lx-text-muted);
      }
      .error {
        color: var(--lx-danger);
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

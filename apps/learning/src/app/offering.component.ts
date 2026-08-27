import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap } from 'rxjs';
import { LoadingStateComponent } from '@optimistic-tanuki/common-ui';
import { OfferingSummaryComponent } from '@optimistic-tanuki/learning-ui';
import { LearningLayoutComponent } from './learning-layout.component';
import { LearningDataService, OfferingDetail } from './learning-data.service';

/**
 * The course page: the step that used to be missing.
 *
 * Between the catalog and the reading, a visitor gets to see what a course is,
 * who wrote it, what it requires, and whether they are in it, and can enrol
 * from here rather than discovering the requirement when Submit fails.
 */
@Component({
  selector: 'learning-offering',
  imports: [
    LearningLayoutComponent,
    LoadingStateComponent,
    OfferingSummaryComponent,
    RouterLink,
  ],
  template: `<learning-layout [trackId]="detail()?.trackId ?? ''">
    @if (detail(); as course) {
    <a routerLink="/courses" class="back">← Catalog</a>
    <otlearn-offering-summary
      [displayName]="course.offering.displayName"
      [description]="course.offering.description ?? ''"
      [audience]="course.offering.audience ?? ''"
      [outcome]="course.offering.outcome ?? ''"
      [trackDisplayName]="course.trackDisplayName"
      [authorName]="course.author?.displayName ?? ''"
      [lessonCount]="course.lessonCount"
      [level]="course.offering.level"
      [credits]="course.offering.credits"
      [prerequisites]="course.prerequisites"
      [isEnrolled]="enrolled() || course.isEnrolled"
      [isDraft]="course.offering.status !== 'published'"
      [busy]="enrolling()"
      [error]="error()"
      (enrol)="enrol(course)"
      (open)="open(course)"
    ></otlearn-offering-summary>

    @if (course.offering.modules.length) {
    <section class="outline" aria-label="What is in this course">
      <h2>What is in it</h2>
      <ol>
        @for (module of course.offering.modules; track module.id) {
        <li>
          <a [routerLink]="['/module', course.trackId, module.id]">{{
            module.title
          }}</a>
          <span>{{ module.lessons.length }}</span>
        </li>
        }
      </ol>
    </section>
    } } @else if (missing()) {
    <a routerLink="/courses" class="back">← Catalog</a>
    <section class="missing">
      <h1>No course here</h1>
      <p>
        There is no course at this address. It may have been unpublished, or the
        link may be wrong.
      </p>
      <a routerLink="/courses">Browse the catalog</a>
    </section>
    } @else {
    <otui-loading-state headline="Loading course"></otui-loading-state>
    }
  </learning-layout>`,
  styles: [
    `
      .back {
        display: inline-block;
        margin-bottom: 1.5rem;
        color: var(--lx-text-muted);
        font-size: 0.85rem;
        text-decoration: none;
      }
      .missing {
        margin-top: 2rem;
      }
      .missing h1 {
        font-size: 1.5rem;
        margin-bottom: 0.75rem;
      }
      .missing p {
        color: var(--lx-text-muted);
        margin-bottom: 1rem;
      }
      .missing a {
        color: var(--lx-accent);
      }
      .outline {
        margin-top: 2.5rem;
      }
      .outline h2 {
        margin: 0 0 0.75rem;
        font-size: 0.95rem;
      }
      .outline ol {
        margin: 0;
        padding: 0;
        list-style: none;
        border-top: 1px solid var(--lx-border-soft);
      }
      .outline li {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        padding: 0.7rem 0.35rem;
        border-bottom: 1px solid var(--lx-border-soft);
      }
      .outline a {
        color: var(--lx-text-body);
        text-decoration: none;
      }
      .outline a:hover {
        color: var(--lx-accent);
      }
      .outline span {
        color: var(--lx-text-muted);
        font: 0.8rem var(--lx-font-mono, ui-monospace, monospace);
      }
    `,
  ],
})
export class OfferingComponent {
  private readonly data = inject(LearningDataService);
  private readonly router = inject(Router);

  /**
   * Three states, not two.
   *
   * `undefined` is still asking, `null` is asked and there is no such course,
   * and a value is the course. Collapsing the middle one into the first is why
   * a wrong id used to sit on "Loading course" forever: the request had already
   * come back 404 and nothing was watching for it.
   */
  private readonly result = toSignal(
    inject(ActivatedRoute).paramMap.pipe(
      switchMap((params) =>
        this.data
          .offering(params.get('offeringId') ?? '')
          .pipe(catchError(() => of(null)))
      )
    ),
    { initialValue: undefined }
  );

  readonly detail = computed(() => this.result() ?? undefined);
  readonly missing = computed(() => this.result() === null);

  readonly enrolling = signal(false);
  readonly enrolled = signal(false);
  readonly error = signal('');

  enrol(course: OfferingDetail): void {
    this.enrolling.set(true);
    this.error.set('');
    this.data.enrol(course.offering.id).subscribe({
      next: () => {
        this.enrolled.set(true);
        this.enrolling.set(false);
      },
      error: (failure: { status?: number }) => {
        this.enrolling.set(false);
        // A visitor with no session gets told to sign in rather than that
        // something went wrong, since that is the actual next step.
        this.error.set(
          failure?.status === 401
            ? 'Sign in to enrol.'
            : 'Could not enrol just now. Try again.'
        );
      },
    });
  }

  /** Opens the first module, which is where reading starts. */
  open(course: OfferingDetail): void {
    const firstModule = course.offering.modules[0];
    if (!firstModule) return;
    this.router.navigate(['/module', course.trackId, firstModule.id]);
  }
}

import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, map, of, switchMap } from 'rxjs';
import { LoadingStateComponent } from '@optimistic-tanuki/common-ui';
import {
  EnrolmentGateComponent,
  OfferingSummaryComponent,
} from '@optimistic-tanuki/learning-ui';
import { LearningLayoutComponent } from './learning-layout.component';
import { LearningAuthService, SignedInPerson } from './learning-auth.service';
import { LearningDataService, OfferingDetail } from './learning-data.service';

interface OfferingLoadState {
  detail: OfferingDetail | null | undefined;
  error: { status?: number } | null;
}

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
    EnrolmentGateComponent,
    OfferingSummaryComponent,
    RouterLink,
  ],
  template: `<learning-layout
    [trackId]="detail()?.trackId ?? ''"
    [offeringId]="detail()?.offering?.id ?? ''"
  >
    @if (detail(); as course) {
    <a routerLink="/courses" class="back">← Catalog</a>
    <div class="course-shell">
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
        [showEnrolAction]="false"
        [showOpenAction]="false"
      ></otlearn-offering-summary>

      <otlearn-enrolment-gate
        [offeringName]="course.offering.displayName"
        [signedIn]="signedIn()"
        [available]="course.offering.status === 'published'"
        [success]="enrolled() || course.isEnrolled"
        [hasLessons]="course.lessonCount > 0"
        [busy]="enrolling()"
        [error]="error()"
        (enrol)="enrol(course)"
        (signIn)="goToSignIn(course)"
        (continue)="open(course)"
      ></otlearn-enrolment-gate>

      @if (course.offering.status !== 'published') {
      <p class="draft-note" role="note">
        This is a draft preview. Only its author and collaborators can see it;
        enrolment opens after publication.
      </p>
      }

      <section class="outline" aria-labelledby="curriculum-heading">
        <div class="section-heading">
          <div>
            <p class="section-kicker">Course map</p>
            <h2 id="curriculum-heading">Curriculum</h2>
          </div>
          <span class="section-count"
            >{{ course.lessonCount }}
            {{ course.lessonCount === 1 ? 'lesson' : 'lessons' }}</span
          >
        </div>

        @if (course.offering.modules.length) {
        <ol class="module-list">
          @for ( module of course.offering.modules; track module.id; let
          moduleIndex = $index ) {
          <li class="module-card">
            <div class="module-index" aria-hidden="true">
              {{ stepNumber(moduleIndex) }}
            </div>
            <div class="module-body">
              <a
                class="module-link"
                [routerLink]="['/module', course.trackId, module.id]"
                [queryParams]="{ offeringId: course.offering.id }"
              >
                <span class="module-title">{{ module.title }}</span>
                <span class="module-arrow" aria-hidden="true">↗</span>
              </a>
              <p class="module-meta">
                {{ module.lessons.length }}
                {{ module.lessons.length === 1 ? 'lesson' : 'lessons' }}
                <span aria-hidden="true">·</span>
                {{ course.offering.credits }} course
                {{ course.offering.credits === 1 ? 'credit' : 'credits' }}
              </p>

              @if (module.lessons.length) {
              <ol class="lesson-list">
                @for ( lesson of module.lessons; track lesson.id; let
                lessonIndex = $index ) {
                <li>
                  <a
                    [routerLink]="[
                      '/module',
                      course.trackId,
                      module.id,
                      lesson.id
                    ]"
                    [queryParams]="{ offeringId: course.offering.id }"
                  >
                    <span class="lesson-index" aria-hidden="true">{{
                      stepNumber(lessonIndex)
                    }}</span>
                    <span class="lesson-title">{{
                      lesson.title || 'Untitled lesson'
                    }}</span>
                    <span class="lesson-arrow" aria-hidden="true">→</span>
                  </a>
                </li>
                }
              </ol>
              } @else {
              <p class="unavailable">Lesson sequence coming soon.</p>
              }
            </div>
          </li>
          }
        </ol>
        } @else {
        <div class="empty-curriculum" role="status">
          <span class="empty-mark" aria-hidden="true">∅</span>
          <div>
            <h3>Curriculum in progress</h3>
            <p>
              There are no lessons published for this course yet. Check back
              when the author has laid down the first step.
            </p>
          </div>
        </div>
        }
      </section>
    </div>
    } @else if (loadFailure(); as failure) {
    <a routerLink="/courses" class="back">← Catalog</a>
    <section class="missing" role="alert">
      <p class="section-kicker">Course unavailable</p>
      <h1>{{ failure.title }}</h1>
      <p>{{ failure.detail }}</p>
      <a routerLink="/courses">Browse the catalog</a>
    </section>
    } @else if (missing()) {
    <a routerLink="/courses" class="back">← Catalog</a>
    <section class="missing">
      <p class="section-kicker">404 / COURSE NOT FOUND</p>
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
        font: var(--lx-btn-weight, 700) 0.75rem var(--lx-font-mono, monospace);
        letter-spacing: 0.06em;
        text-decoration: none;
        text-transform: var(--lx-btn-transform, uppercase);
        transition: var(--lx-btn-transition, all 0.1s steps(2));
      }
      .back:hover {
        color: var(--lx-accent);
        transform: translateX(-2px);
      }
      .back:focus-visible,
      .module-link:focus-visible,
      .lesson-list a:focus-visible,
      .missing a:focus-visible {
        outline: var(--lx-border-width, 2px) var(--lx-border-style, solid)
          var(--lx-focus, currentColor);
        outline-offset: 3px;
      }
      .course-shell {
        display: grid;
        gap: clamp(1.35rem, 3vw, 2.5rem);
        max-width: 74rem;
      }
      .draft-note {
        margin: -0.7rem 0 0;
        padding: 0.75rem 0.9rem;
        border: var(--lx-border-width, 2px) dashed var(--lx-border-soft);
        color: var(--lx-text-muted);
        background-color: var(--lx-well);
        background-image: var(--lx-surface-texture);
        font-size: 0.84rem;
        line-height: 1.5;
      }
      .outline {
        display: grid;
        gap: 1rem;
        padding-top: clamp(1.25rem, 3vw, 2rem);
        border-top: var(--lx-border-width, 2px) var(--lx-border-style, solid)
          var(--lx-border-soft);
      }
      .section-heading {
        display: flex;
        align-items: end;
        justify-content: space-between;
        gap: 1rem;
      }
      .section-kicker {
        margin: 0 0 0.35rem;
        color: var(--lx-accent);
        font: var(--lx-btn-weight, 800) 0.68rem
          var(--lx-font-mono, ui-monospace, monospace);
        letter-spacing: 0.14em;
        text-transform: var(--lx-btn-transform, uppercase);
      }
      .section-heading h2 {
        margin: 0;
        color: var(--lx-text);
        font-family: var(--lx-font-heading, inherit);
        font-size: clamp(1.45rem, 3vw, 2rem);
        letter-spacing: -0.03em;
      }
      .section-count {
        color: var(--lx-text-muted);
        font: var(--lx-btn-weight, 700) 0.72rem
          var(--lx-font-mono, ui-monospace, monospace);
        text-transform: var(--lx-btn-transform, uppercase);
        white-space: nowrap;
      }
      .module-list {
        display: grid;
        gap: 1rem;
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .module-card {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        gap: 0.9rem;
        padding: clamp(0.9rem, 2vw, 1.2rem);
        border: var(--lx-border-width, 2px) var(--lx-border-style, solid)
          var(--lx-border-soft);
        border-radius: var(--lx-radius);
        background-color: var(--lx-surface);
        background-image: var(--lx-surface-texture);
        box-shadow: var(--lx-shadow-card);
        transition: var(--lx-btn-transition, all 0.1s steps(2));
      }
      .module-card:hover {
        border-color: var(--lx-accent);
        box-shadow: var(--lx-shadow-control);
        transform: translate(-1px, -1px);
      }
      .module-index,
      .lesson-index {
        color: var(--lx-accent);
        font: var(--lx-btn-weight, 800) 0.72rem
          var(--lx-font-mono, ui-monospace, monospace);
        letter-spacing: 0.08em;
      }
      .module-index {
        padding-top: 0.15rem;
      }
      .module-body {
        min-width: 0;
      }
      .module-link {
        display: flex;
        align-items: start;
        justify-content: space-between;
        gap: 1rem;
        color: var(--lx-text);
        font-family: var(--lx-font-heading, inherit);
        font-size: 1.12rem;
        font-weight: 700;
        text-decoration: none;
        transition: var(--lx-btn-transition, all 0.1s steps(2));
      }
      .module-link:hover {
        color: var(--lx-accent);
      }
      .module-arrow,
      .lesson-arrow {
        flex: 0 0 auto;
        color: var(--lx-accent);
        font-family: var(--lx-font-mono, monospace);
      }
      .module-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 0.45rem;
        margin: 0.35rem 0 0;
        color: var(--lx-text-muted);
        font: 0.7rem var(--lx-font-mono, ui-monospace, monospace);
        letter-spacing: 0.03em;
        text-transform: var(--lx-btn-transform, uppercase);
      }
      .lesson-list {
        display: grid;
        gap: 0;
        margin: 1rem 0 0;
        padding: 0;
        list-style: none;
        border-top: var(--lx-border-width, 2px) var(--lx-border-style, solid)
          var(--lx-border-soft);
      }
      .lesson-list li {
        border-bottom: var(--lx-border-width, 2px) var(--lx-border-style, solid)
          var(--lx-border-soft);
      }
      .lesson-list li:last-child {
        border-bottom: 0;
      }
      .lesson-list a {
        display: grid;
        grid-template-columns: 2.2rem minmax(0, 1fr) auto;
        align-items: center;
        gap: 0.6rem;
        min-height: 2.75rem;
        color: var(--lx-text-body);
        text-decoration: none;
        transition: var(--lx-btn-transition, all 0.1s steps(2));
      }
      .lesson-list a:hover {
        padding-inline: 0.35rem;
        color: var(--lx-accent);
        background: var(--lx-surface-hover);
      }
      .lesson-title {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .lesson-arrow {
        color: var(--lx-text-muted);
      }
      .unavailable {
        margin: 1rem 0 0;
        color: var(--lx-text-muted);
        font-size: 0.84rem;
        font-style: italic;
      }
      .empty-curriculum {
        display: flex;
        align-items: start;
        gap: 0.85rem;
        padding: 1.1rem;
        border: var(--lx-border-width, 2px) dashed var(--lx-border-soft);
        background-color: var(--lx-well);
        background-image: var(--lx-surface-texture);
      }
      .empty-mark {
        color: var(--lx-warn, var(--lx-accent));
        font: var(--lx-btn-weight, 800) 1.3rem/1
          var(--lx-font-mono, ui-monospace, monospace);
      }
      .empty-curriculum h3 {
        margin: 0;
        font-size: 1rem;
      }
      .empty-curriculum p {
        margin: 0.35rem 0 0;
        color: var(--lx-text-muted);
        font-size: 0.88rem;
        line-height: 1.5;
      }
      .missing {
        max-width: 44rem;
        margin-top: 2rem;
        padding: clamp(1.25rem, 4vw, 2rem);
        border: var(--lx-border-width, 2px) var(--lx-border-style, solid)
          var(--lx-danger);
        background-color: var(--lx-surface);
        background-image: var(--lx-surface-texture);
        box-shadow: var(--lx-shadow-card);
      }
      .missing h1 {
        margin: 0;
        font-family: var(--lx-font-heading, inherit);
        font-size: clamp(1.65rem, 4vw, 2.5rem);
        letter-spacing: -0.04em;
      }
      .missing p:not(.section-kicker) {
        margin: 0.8rem 0 1rem;
        color: var(--lx-text-muted);
        line-height: 1.6;
      }
      .missing a {
        color: var(--lx-accent);
        font-weight: 700;
      }
      @media (max-width: 35rem) {
        .section-heading {
          align-items: start;
          flex-direction: column;
          gap: 0.45rem;
        }
        .module-card {
          grid-template-columns: 1.8rem minmax(0, 1fr);
          gap: 0.65rem;
        }
        .lesson-list a {
          grid-template-columns: 1.75rem minmax(0, 1fr) auto;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .back,
        .module-card,
        .module-link,
        .lesson-list a {
          transition: none;
        }
      }
    `,
  ],
})
export class OfferingComponent {
  private readonly data = inject(LearningDataService);
  private readonly auth = inject(LearningAuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly activeRoute = toSignal(
    this.route.paramMap.pipe(
      map((params) => ({
        offeringId: params.get('offeringId') ?? '',
        generation: Symbol(),
      }))
    ),
    {
      initialValue: {
        offeringId: this.route.snapshot?.paramMap?.get('offeringId') ?? '',
        generation: Symbol(),
      },
    }
  );

  private readonly result = toSignal<OfferingLoadState>(
    this.route.paramMap.pipe(
      switchMap((params) =>
        this.data.offering(params.get('offeringId') ?? '').pipe(
          map(
            (detail): OfferingLoadState => ({
              detail,
              error: null,
            })
          ),
          catchError((error: { status?: number }) =>
            of<OfferingLoadState>({ detail: null, error })
          )
        )
      )
    ),
    { initialValue: undefined }
  );

  private readonly person = toSignal<SignedInPerson | null | undefined>(
    this.auth.me(),
    { initialValue: undefined }
  );
  private readonly offeringState = signal<
    Record<
      string,
      {
        generation: symbol;
        enrolled: boolean;
        enrolling: boolean;
        error: string;
        sessionOverride?: boolean;
      }
    >
  >({});

  private readonly state = computed<OfferingLoadState>(
    () => this.result() ?? { detail: undefined, error: null }
  );

  readonly detail = computed(() => this.state().detail);
  readonly signedIn = computed<boolean | null>(() => {
    const current = this.currentOfferingState();
    const override = current.sessionOverride;
    if (override !== undefined) return override;
    const person = this.person();
    return person === undefined ? null : person !== null;
  });
  readonly missing = computed(() => {
    const state = this.state();
    return (
      state.detail === null &&
      (state.error?.status === 404 || state.error?.status === undefined)
    );
  });
  readonly loadFailure = computed(() => {
    const status = this.state().error?.status;
    if (!status || status === 404) return null;
    if (status === 401 || status === 403) {
      return {
        title: 'This course is not available here',
        detail:
          'The course may be private, unpublished, or your session may have expired. Sign in and try the link again.',
      };
    }
    return {
      title: 'Course data could not load',
      detail:
        'The course service did not answer cleanly. Nothing was changed; try again in a moment.',
    };
  });

  readonly enrolling = computed(() => this.currentOfferingState().enrolling);
  readonly enrolled = computed(() => this.currentOfferingState().enrolled);
  readonly error = computed(() => this.currentOfferingState().error);

  protected stepNumber(index: number): string {
    return String(index + 1).padStart(2, '0');
  }

  enrol(course: OfferingDetail): void {
    if (this.enrolling()) return;
    if (this.signedIn() === false) {
      this.goToSignIn(course);
      return;
    }

    const offeringId = course.offering.id;
    const generation = this.activeRoute().generation;
    this.updateOfferingState(offeringId, generation, {
      enrolling: true,
      error: '',
    });
    this.data.enrol(offeringId).subscribe({
      next: () => {
        if (!this.isCurrentOffering(offeringId, generation)) return;
        this.updateOfferingState(offeringId, generation, {
          enrolled: true,
          enrolling: false,
        });
      },
      error: (failure: { status?: number }) => {
        if (!this.isCurrentOffering(offeringId, generation)) return;
        this.updateOfferingState(offeringId, generation, {
          enrolling: false,
        });
        if (failure?.status === 401) {
          // A session can expire between the profile read and the mutation.
          // Redirect without retrying a state-changing request.
          this.updateOfferingState(offeringId, generation, {
            sessionOverride: false,
          });
          this.goToSignIn(course);
          return;
        }
        this.updateOfferingState(offeringId, generation, {
          error:
            failure?.status === 409
              ? 'You are already enrolled. Refresh the course to continue.'
              : failure?.status === 403
              ? 'Enrolment is not available for this course.'
              : failure?.status === 404
              ? 'This course is no longer available.'
              : 'Enrolment failed. Nothing was changed; try again.',
        });
      },
    });
  }

  goToSignIn(course: OfferingDetail): void {
    const current = this.activeRoute();
    if (current.offeringId === course.offering.id) {
      this.updateOfferingState(course.offering.id, current.generation, {
        error: '',
      });
    }
    this.router.navigate(['/sign-in'], {
      queryParams: { returnTo: this.returnTo(course) },
    });
  }

  /** Opens the first module, which is where reading starts. */
  open(course: OfferingDetail): void {
    const firstModule = course.offering.modules[0];
    if (!firstModule) return;
    this.router.navigate(['/module', course.trackId, firstModule.id], {
      queryParams: { offeringId: course.offering.id },
    });
  }

  private returnTo(course: OfferingDetail): string {
    return `/course/${encodeURIComponent(course.offering.id)}`;
  }

  private readonly currentOfferingState = computed(() => {
    const current = this.activeRoute();
    return this.offeringState()[current.offeringId]?.generation ===
      current.generation
      ? this.offeringState()[current.offeringId]
      : {
          generation: current.generation,
          enrolled: false,
          enrolling: false,
          error: '',
        };
  });

  private isCurrentOffering(offeringId: string, generation: symbol): boolean {
    const current = this.activeRoute();
    return (
      current.offeringId === offeringId && current.generation === generation
    );
  }

  private updateOfferingState(
    offeringId: string,
    generation: symbol,
    patch: Partial<{
      enrolled: boolean;
      enrolling: boolean;
      error: string;
      sessionOverride?: boolean;
    }>
  ): void {
    if (!this.isCurrentOffering(offeringId, generation)) return;
    this.offeringState.update((states) => ({
      ...states,
      [offeringId]: {
        generation,
        enrolled:
          states[offeringId]?.generation === generation
            ? states[offeringId].enrolled
            : false,
        enrolling:
          states[offeringId]?.generation === generation
            ? states[offeringId].enrolling
            : false,
        error:
          states[offeringId]?.generation === generation
            ? states[offeringId].error
            : '',
        sessionOverride:
          states[offeringId]?.generation === generation
            ? states[offeringId].sessionOverride
            : undefined,
        ...patch,
      },
    }));
  }
}

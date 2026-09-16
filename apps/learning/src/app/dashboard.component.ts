import { Component, inject } from '@angular/core';
import { AsyncPipe, NgIf } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { LoadingStateComponent } from '@optimistic-tanuki/common-ui';
import { LearningLayoutComponent } from './learning-layout.component';
import { LearningAuthService, SignedInPerson } from './learning-auth.service';
import {
  DashboardEntry,
  LearningDataService,
  Program,
  programVariantLabel,
} from './learning-data.service';

@Component({
  selector: 'learning-dashboard',
  imports: [
    LearningLayoutComponent,
    AsyncPipe,
    NgIf,
    RouterLink,
    LoadingStateComponent,
  ],
  template: ` <learning-layout
    ><ng-container *ngIf="paths$ | async as paths; else loading"
      ><header>
        <p class="eyebrow">Your progress</p>
        <h1>Keep your place.</h1>
        @if (paths.length) {
        <span
          >{{ paths.length }} {{ paths.length === 1 ? 'course' : 'courses' }} in
          progress or ready to start</span
        >
        } @else {
        <span>Pick up a course whenever you are ready.</span>
        }
      </header>
      @if (!paths.length) {
      <section class="empty-state" aria-labelledby="dashboard-empty-title">
        @if (person() === null) {
        <p class="empty-kicker">Reading is open</p>
        <h2 id="dashboard-empty-title">Sign in to keep a course here.</h2>
        <p>
          Your dashboard saves your place after you enrol. You can browse and
          start reading without an account.
        </p>
        <a
          class="action primary"
          routerLink="/sign-in"
          [queryParams]="{ returnTo: returnTo() }"
          >Sign in</a
        >
        <a class="quiet-link" routerLink="/courses">Browse courses →</a>
        } @else if (person(); as signedIn) {
        <p class="empty-kicker">No courses yet</p>
        <h2 id="dashboard-empty-title">
          Ready when you are, {{ signedIn.name }}.
        </h2>
        <p>
          Browse the catalog, enrol in something useful, and your next lesson
          will appear here.
        </p>
        <a class="action primary" routerLink="/courses">Browse courses</a>
        } @else {
        <p class="empty-kicker">Getting your workspace ready</p>
        <h2 id="dashboard-empty-title">Your progress will land here.</h2>
        <p>We are checking your session. Try the catalog while that settles.</p>
        <a class="action primary" routerLink="/courses">Browse courses</a>
        }
      </section>
      } @else {
      <section class="stats">
        <div>
          <b>{{ totalLessons(paths) }}</b
          ><span>Lessons</span>
        </div>
        <div>
          <b>{{ totalExercises(paths) }}</b
          ><span>Exercises</span>
        </div>
        <div>
          <b>{{ earnedPoints(paths) }}/{{ totalPoints(paths) }}</b
          ><span>Points earned</span>
        </div>
        <div>
          <b>{{ solvedExercises(paths) }}</b
          ><span>Solved</span>
        </div>
      </section>
      <section class="paths" aria-label="Courses">
        @for (entry of paths; track entry.offeringId ??
        entry.program.offerings[0].id) {<a
          class="path"
          [routerLink]="[
            '/course',
            entry.offeringId ??
              entry.offering?.id ??
              entry.program.offerings[0].id
          ]"
          ><span class="path-index" aria-hidden="true">{{
            indexLabel($index)
          }}</span
          ><span class="path-main"
            ><span class="path-heading"
              >@if (variantLabel(entry.program)) {
              <small>{{ variantLabel(entry.program) }}</small
              >} <b>{{ entry.program.displayName }}</b></span
            ><em
              >{{ entry.totals.lessons }}
              {{ entry.totals.lessons === 1 ? 'lesson' : 'lessons' }} @if
              (entry.totals.exercises) { · {{ entry.totals.exercises }} practice
              exercises } @if (entry.progress.completedLessons) { ·
              {{ entry.progress.completedLessons }} read } @if
              (entry.progress.completedExercises) { ·
              {{ entry.progress.completedExercises }} solved,
              {{ entry.progress.points }} pts }</em
            ><span class="progress-wrap">
              <span class="progress-label"
                >{{ progressPercent(entry) }}% complete ·
                {{ progressStatus(entry) }}</span
              >
              <progress
                [value]="progressPercent(entry)"
                max="100"
                [attr.aria-label]="
                  entry.program.displayName +
                  ' progress: ' +
                  progressPercent(entry) +
                  ' percent'
                "
              >
                {{ progressPercent(entry) }}%
              </progress>
            </span></span
          ><strong class="action-label"
            >{{ action(entry) }} <span aria-hidden="true">→</span></strong
          ></a
        >}
      </section>
      } </ng-container
    ><ng-template #loading
      ><otui-loading-state
        headline="Loading dashboard"
      ></otui-loading-state></ng-template
  ></learning-layout>`,
  styles: [
    `
      header p,
      .eyebrow,
      .path small,
      .empty-kicker {
        color: var(--lx-accent);
        font: 700 0.7rem var(--lx-font-mono, ui-monospace, monospace);
        text-transform: uppercase;
        letter-spacing: 0.1em;
      }
      .eyebrow,
      .empty-kicker {
        margin: 0;
      }
      h1 {
        max-width: 13ch;
        margin: 0.6rem 0;
        font-size: clamp(2.7rem, 5vw, 5.3rem);
        line-height: 0.92;
        letter-spacing: -0.06em;
      }
      header > span {
        color: var(--lx-text-muted);
      }
      .empty-state {
        display: grid;
        justify-items: start;
        gap: 0.75rem;
        max-width: 42rem;
        margin-top: 2.5rem;
        padding: clamp(1.2rem, 4vw, 2rem);
        border: var(--lx-border-width) var(--lx-border-style)
          var(--lx-border-soft);
        border-left-width: calc(var(--lx-border-width) + 3px);
        border-left-color: var(--lx-accent);
        border-radius: var(--lx-radius);
        background-color: var(--lx-surface);
        background-image: var(--lx-surface-texture);
        box-shadow: var(--lx-shadow-card);
      }
      .empty-state h2 {
        margin: 0;
        font-family: var(--lx-font-heading);
        font-size: clamp(1.5rem, 3vw, 2.2rem);
        line-height: 1.05;
      }
      .empty-state p:not(.empty-kicker) {
        max-width: 55ch;
        margin: 0;
        color: var(--lx-text-muted);
        line-height: 1.55;
      }
      .action {
        display: inline-flex;
        align-items: center;
        min-height: 2.6rem;
        padding: 0.55rem 0.9rem;
        border: var(--lx-border-width) var(--lx-border-style) var(--lx-accent);
        border-radius: var(--lx-radius);
        color: var(--lx-accent);
        font: var(--lx-btn-weight) 0.75rem/1 var(--lx-font-mono);
        text-decoration: none;
        text-transform: var(--lx-btn-transform);
        transition: var(--lx-btn-transition);
      }
      .action.primary {
        background: var(--lx-accent);
        color: var(--lx-bg);
        box-shadow: var(--lx-shadow-sm);
      }
      .action:hover {
        box-shadow: var(--lx-shadow-control);
        transform: translate(-1px, -1px);
      }
      .action:active {
        box-shadow: var(--lx-shadow-inset);
        transform: translate(1px, 1px);
      }
      .action:focus-visible,
      .quiet-link:focus-visible,
      .path:focus-visible {
        outline: var(--lx-border-width) var(--lx-border-style) var(--lx-focus);
        outline-offset: 3px;
      }
      .quiet-link {
        color: var(--lx-text-muted);
        font: 0.78rem var(--lx-font-mono);
        text-decoration: none;
      }
      .stats {
        display: flex;
        flex-wrap: wrap;
        gap: 1.25rem 2rem;
        margin: 2.5rem 0;
        padding: 1rem 0;
        border-top: 1px solid var(--lx-border-soft);
        border-bottom: 1px solid var(--lx-border-soft);
      }
      .stats div {
        display: grid;
        gap: 0.2rem;
      }
      .stats b {
        font: 700 1.7rem var(--lx-font-mono, ui-monospace, monospace);
      }
      .stats span {
        color: var(--lx-text-muted);
        font-size: 0.78rem;
        text-transform: uppercase;
      }
      .paths {
        display: grid;
        gap: 1rem;
      }
      .path {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: center;
        gap: 1rem;
        padding: 1.2rem 1.25rem;
        border: var(--lx-border-width) var(--lx-border-style)
          var(--lx-border-soft);
        border-left-width: calc(var(--lx-border-width) + 3px);
        border-left-color: var(--lx-accent);
        border-radius: var(--lx-radius);
        background-color: var(--lx-surface);
        background-image: var(--lx-surface-texture);
        box-shadow: var(--lx-shadow-card);
        color: var(--lx-text-body);
        text-decoration: none;
        transition: var(--lx-btn-transition);
      }
      .path:hover {
        border-color: var(--lx-accent);
        box-shadow: var(--lx-shadow-control);
        transform: translate(-1px, -1px);
      }
      .path-index {
        align-self: start;
        color: var(--lx-accent);
        font: var(--lx-btn-weight) 0.8rem var(--lx-font-mono);
      }
      .path-main {
        display: grid;
        min-width: 0;
        gap: 0.4rem;
      }
      .path-heading {
        display: grid;
        gap: 0.25rem;
      }
      .path b {
        font-size: 1.25rem;
      }
      .path em {
        color: var(--lx-text-muted);
        font-size: 0.9rem;
        font-style: normal;
      }
      .progress-wrap {
        display: grid;
        gap: 0.35rem;
        max-width: 36rem;
      }
      .progress-label {
        color: var(--lx-text-subtle, var(--lx-text-muted));
        font: 700 0.68rem var(--lx-font-mono);
        letter-spacing: 0.03em;
        text-transform: uppercase;
      }
      progress {
        display: block;
        width: 100%;
        height: 0.7rem;
        overflow: hidden;
        border: var(--lx-border-width) var(--lx-border-style)
          var(--lx-border-strong);
        border-radius: 0;
        background: var(--lx-well);
        accent-color: var(--lx-accent);
      }
      progress::-webkit-progress-bar {
        background: var(--lx-well);
      }
      progress::-webkit-progress-value {
        background: var(--lx-accent);
      }
      progress::-moz-progress-bar {
        background: var(--lx-accent);
      }
      .action-label {
        align-self: start;
        color: var(--lx-accent);
        font: var(--lx-btn-weight) 0.78rem var(--lx-font-mono);
        font-size: 0.85rem;
        text-transform: var(--lx-btn-transform);
      }
      @media (max-width: 600px) {
        .path {
          grid-template-columns: 1fr;
          gap: 0.75rem;
          padding: 1rem;
        }
        .path-index {
          display: none;
        }
        .action-label {
          margin-left: 0;
        }
      }
    `,
  ],
})
export class DashboardComponent {
  private readonly router = inject(Router);
  private readonly auth = inject(LearningAuthService);

  readonly person = toSignal<SignedInPerson | null | undefined>(
    this.auth.me(),
    { initialValue: undefined }
  );
  /**
   * What the card offers to do.
   *
   * A course that has been read to the end says so, rather than inviting
   * somebody back into it. Lesson completion was computed by the server and
   * never shown here, so finishing a course with no exercises in it looked
   * exactly like never having opened it.
   */
  protected action(entry: DashboardEntry): string {
    if (entry.progress.nextLessonId) {
      return entry.progress.completedLessons ? 'Continue' : 'Open';
    }
    return entry.totals.lessons && entry.progress.completedLessons
      ? 'Read again'
      : 'Open';
  }

  protected variantLabel(program: Program): string {
    return programVariantLabel(program);
  }

  readonly paths$ = inject(LearningDataService).dashboard();

  protected returnTo(): string {
    const current = this.router.url;
    return current.startsWith('/') && !current.startsWith('//')
      ? current
      : '/dashboard';
  }

  protected indexLabel(index: number): string {
    return String(index + 1).padStart(2, '0');
  }

  protected progressPercent(entry: DashboardEntry): number {
    if (!entry.totals.lessons) return 0;
    return Math.min(
      100,
      Math.round((entry.progress.completedLessons / entry.totals.lessons) * 100)
    );
  }

  protected progressStatus(entry: DashboardEntry): string {
    const percent = this.progressPercent(entry);
    if (percent >= 100) return 'complete';
    if (percent > 0) return 'in progress';
    return 'ready to start';
  }

  totalLessons = (p: DashboardEntry[]) =>
    p.reduce((n, x) => n + x.totals.lessons, 0);
  totalExercises = (p: DashboardEntry[]) =>
    p.reduce((n, x) => n + x.totals.exercises, 0);
  totalPoints = (p: DashboardEntry[]) =>
    p.reduce((n, x) => n + x.totals.points, 0);
  earnedPoints = (p: DashboardEntry[]) =>
    p.reduce((n, x) => n + x.progress.points, 0);
  solvedExercises = (p: DashboardEntry[]) =>
    p.reduce((n, x) => n + x.progress.completedExercises, 0);
}

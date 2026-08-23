import { Component, inject } from '@angular/core';
import { AsyncPipe, NgIf } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LoadingStateComponent } from '@optimistic-tanuki/common-ui';
import { LearningLayoutComponent } from './learning-layout.component';
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
        <p>Dashboard</p>
        <h1>Choose a path. Keep your place.</h1>
        <span>{{ paths.length }} language paths ready</span>
      </header>
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
      <section class="paths" aria-label="Learning paths">
        @for (entry of paths; track entry.program.id) {<a
          class="path"
          [routerLink]="[
            '/module',
            entry.program.id,
            entry.program.offerings[0].modules[0].id
          ]"
          ><small>{{ variantLabel(entry.program) }}</small
          ><span
            ><b>{{ entry.program.displayName }}</b
            ><em
              >{{ entry.totals.lessons }} lessons ·
              {{ entry.totals.exercises }} practice exercises @if
              (entry.progress.completedExercises) { ·
              {{ entry.progress.completedExercises }} solved,
              {{ entry.progress.points }} pts }</em
            ></span
          ><strong
            >{{ entry.progress.nextLessonId ? 'Continue' : 'Open' }} →</strong
          ></a
        >}
      </section></ng-container
    ><ng-template #loading
      ><otui-loading-state
        headline="Loading dashboard"
      ></otui-loading-state></ng-template
  ></learning-layout>`,
  styles: [
    `
      header p,
      .path small {
        color: var(--lx-accent);
        font: 700 0.7rem ui-monospace, monospace;
        text-transform: uppercase;
        letter-spacing: 0.1em;
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
      .stats {
        display: flex;
        gap: 2rem;
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
        font: 700 1.7rem ui-monospace, monospace;
      }
      .stats span {
        color: var(--lx-text-muted);
        font-size: 0.78rem;
        text-transform: uppercase;
      }
      .paths {
        border-top: 1px solid var(--lx-border-soft);
      }
      .path {
        display: grid;
        grid-template-columns: 6rem 1fr auto;
        align-items: center;
        gap: 1rem;
        padding: 1.35rem 0.35rem;
        border-bottom: 1px solid var(--lx-border-soft);
        color: var(--lx-text-body);
        text-decoration: none;
      }
      .path:hover {
        background: var(--lx-surface-hover);
      }
      .path span {
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
      .path strong {
        color: var(--lx-accent);
        font-size: 0.85rem;
      }
      @media (max-width: 600px) {
        .path {
          grid-template-columns: 1fr;
        }
        .path strong {
          margin-left: 0;
        }
      }
    `,
  ],
})
export class DashboardComponent {
  protected variantLabel(program: Program): string {
    return programVariantLabel(program);
  }

  readonly paths$ = inject(LearningDataService).dashboard();

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

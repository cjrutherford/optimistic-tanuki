import { Component, inject } from '@angular/core';
import { AsyncPipe, NgIf } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LoadingStateComponent } from '@optimistic-tanuki/common-ui';
import { LearningLayoutComponent } from './learning-layout.component';
import { LearningDataService } from './learning-data.service';

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
          <b>{{ totalPoints(paths) }}</b
          ><span>Points</span>
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
          ><small>{{ entry.program.supportedLanguageIds[0] }}</small
          ><span
            ><b>{{ entry.program.displayName }}</b
            ><em
              >{{ entry.totals.lessons }} lessons ·
              {{ entry.totals.exercises }} practice exercises</em
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
        color: #76e3d0;
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
        color: #9db4c7;
      }
      .stats {
        display: flex;
        gap: 2rem;
        margin: 2.5rem 0;
        padding: 1rem 0;
        border-top: 1px solid #254154;
        border-bottom: 1px solid #254154;
      }
      .stats div {
        display: grid;
        gap: 0.2rem;
      }
      .stats b {
        font: 700 1.7rem ui-monospace, monospace;
      }
      .stats span {
        color: #9db4c7;
        font-size: 0.78rem;
        text-transform: uppercase;
      }
      .paths {
        border-top: 1px solid #254154;
      }
      .path {
        display: grid;
        grid-template-columns: 6rem 1fr auto;
        align-items: center;
        gap: 1rem;
        padding: 1.35rem 0.35rem;
        border-bottom: 1px solid #254154;
        color: #dce8f4;
        text-decoration: none;
      }
      .path:hover {
        background: #0d2131;
      }
      .path span {
        display: grid;
        gap: 0.25rem;
      }
      .path b {
        font-size: 1.25rem;
      }
      .path em {
        color: #9db4c7;
        font-size: 0.9rem;
        font-style: normal;
      }
      .path strong {
        color: #76e3d0;
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
  readonly paths$ = inject(LearningDataService).dashboard();
  totalLessons = (p: any[]) => p.reduce((n, x) => n + x.totals.lessons, 0);
  totalExercises = (p: any[]) => p.reduce((n, x) => n + x.totals.exercises, 0);
  totalPoints = (p: any[]) => p.reduce((n, x) => n + x.totals.points, 0);
}

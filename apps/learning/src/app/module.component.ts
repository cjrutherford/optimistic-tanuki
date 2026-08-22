import { Component, inject } from '@angular/core';
import { AsyncPipe, NgIf } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { combineLatest, map, switchMap } from 'rxjs';
import { LearningLayoutComponent } from './learning-layout.component';
import { LearningDataService } from './learning-data.service';

@Component({
  selector: 'learning-module',
  imports: [LearningLayoutComponent, AsyncPipe, NgIf, RouterLink],
  template: ` <learning-layout
    ><ng-container *ngIf="vm$ | async as vm"
      ><a routerLink="/dashboard" class="back">← Dashboard</a>
      <header>
        <small>{{ vm.track.program.supportedLanguageIds[0] }} module</small>
        <h1>{{ vm.module.title }}</h1>
        <p>
          {{ vm.module.lessons.length }} compact lessons. Read in order or jump
          to the problem you need to solve.
        </p>
      </header>
      <ol class="lesson-list">
        @for (lesson of vm.module.lessons; track lesson.id; let index=$index) {
        <li>
          <a
            [routerLink]="[
              '/module',
              vm.track.program.id,
              vm.module.id,
              lesson.id
            ]"
            ><small>{{ (index + 1).toString().padStart(2, '0') }}</small
            ><span>{{ lesson.title }}</span
            ><b>→</b></a
          >
        </li>
        }
      </ol></ng-container
    ></learning-layout
  >`,
  styles: [
    `
      .back {
        color: #9db4c7;
        text-decoration: none;
        font-size: 0.85rem;
      }
      header {
        margin: 2.5rem 0;
      }
      header small {
        color: #76e3d0;
        font: 700 0.7rem ui-monospace, monospace;
        text-transform: uppercase;
        letter-spacing: 0.1em;
      }
      h1 {
        margin: 0.6rem 0;
        font-size: clamp(2.7rem, 5vw, 5rem);
        letter-spacing: -0.06em;
        line-height: 0.92;
      }
      header p {
        max-width: 56ch;
        color: #a9bed2;
        line-height: 1.65;
      }
      .lesson-list {
        max-width: 820px;
        margin: 0;
        padding: 0;
        list-style: none;
        border-top: 1px solid #294b62;
      }
      .lesson-list li {
        border-bottom: 1px solid #294b62;
      }
      .lesson-list a {
        display: grid;
        grid-template-columns: 3rem 1fr auto;
        gap: 1rem;
        padding: 1.1rem 0.25rem;
        color: #e5f0f7;
        text-decoration: none;
      }
      .lesson-list a:hover {
        background: #0b2030;
        color: #76e3d0;
      }
      .lesson-list small {
        color: #7894ab;
        font-family: ui-monospace, monospace;
      }
      .lesson-list b {
        color: #76e3d0;
      }
    `,
  ],
})
export class ModuleComponent {
  private readonly data = inject(LearningDataService);
  private readonly route = inject(ActivatedRoute);
  readonly vm$ = combineLatest([
    this.data.dashboard(),
    this.route.paramMap,
  ]).pipe(
    map(([paths, params]) => {
      const track = paths.find(
        (item) => item.program.id === params.get('trackId')
      )!;
      const module = track.program.offerings
        .flatMap((offering) => offering.modules)
        .find((item) => item.id === params.get('moduleId'))!;
      return { track, module };
    })
  );
}

import { Component, inject } from '@angular/core';
import { AsyncPipe, NgIf } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { combineLatest, map, switchMap } from 'rxjs';
import { LearningLayoutComponent } from './learning-layout.component';
import {
  LearningDataService,
  Program,
  programVariantLabel,
} from './learning-data.service';

@Component({
  selector: 'learning-module',
  imports: [LearningLayoutComponent, AsyncPipe, NgIf, RouterLink],
  template: ` <learning-layout
    ><ng-container *ngIf="vm$ | async as vm"
      ><a routerLink="/dashboard" class="back">← Dashboard</a>
      <header>
        <small *ngIf="variantLabel(vm.track.program) as label"
          >{{ label }} module</small
        >
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
        color: var(--lx-text-muted);
        text-decoration: none;
        font-size: 0.85rem;
      }
      header {
        margin: 2.5rem 0;
      }
      header small {
        color: var(--lx-accent);
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
        color: var(--lx-text-muted);
        line-height: 1.65;
      }
      .lesson-list {
        max-width: 820px;
        margin: 0;
        padding: 0;
        list-style: none;
        border-top: 1px solid var(--lx-border);
      }
      .lesson-list li {
        border-bottom: 1px solid var(--lx-border);
      }
      .lesson-list a {
        display: grid;
        grid-template-columns: 3rem 1fr auto;
        gap: 1rem;
        padding: 1.1rem 0.25rem;
        color: var(--lx-text);
        text-decoration: none;
      }
      .lesson-list a:hover {
        background: var(--lx-surface-hover);
        color: var(--lx-accent);
      }
      .lesson-list small {
        color: var(--lx-text-subtle);
        font-family: ui-monospace, monospace;
      }
      .lesson-list b {
        color: var(--lx-accent);
      }
    `,
  ],
})
export class ModuleComponent {
  protected variantLabel(program: Program): string {
    return programVariantLabel(program);
  }

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

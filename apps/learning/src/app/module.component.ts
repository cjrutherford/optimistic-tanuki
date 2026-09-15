import { Component, inject } from '@angular/core';
import { AsyncPipe, NgIf } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, distinctUntilChanged, map, shareReplay } from 'rxjs';
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
    [trackId]="trackId()"
    [offeringId]="layoutOfferingId()"
    ><ng-container *ngIf="vm$ | async as vm"
      ><a [routerLink]="['/course', vm.offering.id]" class="back">← Course</a>
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
            [queryParams]="{ offeringId: vm.offering.id }"
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
        font: 700 0.7rem var(--lx-font-mono, ui-monospace, monospace);
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
        font-family: var(--lx-font-mono, ui-monospace, monospace);
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

  /**
   * Passed to the layout so the sidebar shows this course's modules and only
   * this course's. Without it the module list vanished on the very page where
   * a reader is moving between modules.
   */
  private readonly routeState$ = combineLatest([
    this.route.paramMap,
    this.route.queryParamMap,
  ]).pipe(
    map(([params, query]) => ({
      trackId: params.get('trackId') ?? '',
      moduleId: params.get('moduleId') ?? '',
      offeringId: query.get('offeringId') ?? '',
    })),
    distinctUntilChanged(
      (left, right) =>
        left.trackId === right.trackId &&
        left.moduleId === right.moduleId &&
        left.offeringId === right.offeringId
    ),
    shareReplay({ bufferSize: 1, refCount: true })
  );
  readonly trackId = toSignal(
    this.routeState$.pipe(map((state) => state.trackId)),
    {
      initialValue: this.route.snapshot.paramMap.get('trackId') ?? '',
    }
  );
  readonly vm$ = combineLatest([this.data.catalog(), this.routeState$]).pipe(
    map(([tracks, routeState]) => {
      const program = tracks.find((item) => item.id === routeState.trackId);
      if (!program) return null;

      const moduleId = routeState.moduleId;
      const requestedOfferingId = routeState.offeringId;
      const offering = requestedOfferingId
        ? program.offerings.find(
            (candidate) =>
              candidate.id === requestedOfferingId &&
              candidate.modules.some((item) => item.id === moduleId)
          )
        : program.offerings.find((candidate) =>
            candidate.modules.some((item) => item.id === moduleId)
          );
      if (!offering) return null;

      const module = offering.modules.find((item) => item.id === moduleId);
      if (!module) return null;
      return { track: { program }, offering, module };
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );
  readonly layoutOfferingId = toSignal(
    this.vm$.pipe(map((vm) => vm?.offering.id ?? '')),
    {
      initialValue: this.route.snapshot.queryParamMap.get('offeringId') ?? '',
    }
  );
}

import { Component, inject } from '@angular/core';
import { AsyncPipe, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { switchMap, tap } from 'rxjs';
import { ButtonComponent, BadgeComponent } from '@optimistic-tanuki/common-ui';
import { LearningLayoutComponent } from './learning-layout.component';
import { LearningDataService, Exercise } from './learning-data.service';

@Component({
  selector: 'learning-lesson',
  imports: [
    LearningLayoutComponent,
    AsyncPipe,
    NgIf,
    RouterLink,
    FormsModule,
    ButtonComponent,
    BadgeComponent,
  ],
  template: ` <learning-layout
    ><ng-container *ngIf="lesson$ | async as lesson"
      ><a [routerLink]="['/module', trackId, moduleId]" class="back"
        >← Module</a
      >
      <header>
        <small>Lesson</small>
        <h1>{{ lesson.lesson.title }}</h1>
      </header>
      <div class="lesson-grid">
        <article>
          <pre>{{ lesson.content }}</pre>
        </article>
        <aside>
          <div class="practice-head">
            <span>Practice</span
            ><span>{{ lesson.exercises.length }} exercises</span>
          </div>
          @for (exercise of lesson.exercises; track exercise.id) {
          <section class="exercise">
            <div>
              <otui-badge tone="warning" shape="soft">{{
                exercise.difficulty
              }}</otui-badge>
              <h2>{{ exercise.title }}</h2>
              <p>{{ exercise.description }}</p>
            </div>
            <textarea
              [(ngModel)]="code[exercise.id]"
              [attr.aria-label]="exercise.title + ' code'"
              spellcheck="false"
            ></textarea>
            <div class="hints">
              @for (hint of exercise.hints; track hint) {<span
                >Hint · {{ hint }}</span
              >}
            </div>
            <otui-button variant="primary" (action)="run(exercise)"
              >Run code</otui-button
            >@if (results[exercise.id]; as result) {
            <pre class="result">{{
              result.output ||
                result.errors.join(
                  '
'
                ) ||
                'No output'
            }}</pre>
            }
          </section>
          }
        </aside>
      </div></ng-container
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
        margin: 2rem 0;
      }
      header small,
      .practice-head {
        color: #76e3d0;
        font: 700 0.7rem ui-monospace, monospace;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }
      h1 {
        margin: 0.65rem 0;
        font-size: clamp(2.5rem, 4.5vw, 4.6rem);
        letter-spacing: -0.06em;
        line-height: 0.92;
      }
      .lesson-grid {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(330px, 0.85fr);
        gap: 1.2rem;
      }
      article,
      aside {
        border: 1px solid #294b62;
        background: #091622;
      }
      article {
        padding: 1.2rem;
      }
      article pre {
        margin: 0;
        white-space: pre-wrap;
        color: #d5e7f6;
        font: 400 0.86rem/1.72 ui-monospace, monospace;
      }
      aside {
        padding: 1.1rem;
      }
      .practice-head {
        display: flex;
        justify-content: space-between;
        padding-bottom: 1rem;
        border-bottom: 1px solid #294b62;
      }
      .exercise {
        padding: 1.2rem 0;
        border-bottom: 1px solid #294b62;
      }
      .exercise:last-child {
        border-bottom: 0;
      }
      .exercise h2 {
        margin: 0.65rem 0 0.35rem;
        font-size: 1.15rem;
      }
      .exercise p {
        color: #a9bed2;
        line-height: 1.55;
      }
      .exercise textarea {
        display: block;
        box-sizing: border-box;
        width: 100%;
        min-height: 220px;
        margin: 1rem 0;
        padding: 1rem;
        border: 1px solid #365674;
        background: #050d16;
        color: #e7eef8;
        font: 400 0.82rem/1.6 ui-monospace, monospace;
      }
      .hints {
        display: grid;
        gap: 0.35rem;
        margin: 0 0 1rem;
        color: #8fa7bf;
        font-size: 0.8rem;
      }
      .result {
        margin: 1rem 0 0;
        padding: 0.8rem;
        background: #06101c;
        color: #d8e9f7;
        white-space: pre-wrap;
        font: 400 0.78rem/1.5 ui-monospace, monospace;
      }
      @media (max-width: 850px) {
        .lesson-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class LessonComponent {
  private readonly data = inject(LearningDataService);
  private readonly route = inject(ActivatedRoute);
  protected code: Record<string, string> = {};
  protected results: Record<string, { output: string; errors: string[] }> = {};
  readonly trackId = this.route.snapshot.paramMap.get('trackId')!;
  readonly moduleId = this.route.snapshot.paramMap.get('moduleId')!;
  readonly lesson$ = this.route.paramMap.pipe(
    switchMap((params) =>
      this.data.lesson(params.get('trackId')!, params.get('lessonId')!)
    ),
    tap((lesson) =>
      lesson.exercises.forEach(
        (exercise) => (this.code[exercise.id] ??= exercise.starterCode)
      )
    )
  );
  protected run(exercise: Exercise): void {
    this.data
      .run(exercise.id, this.code[exercise.id] ?? exercise.starterCode)
      .subscribe({
        next: (result) => (this.results[exercise.id] = result),
        error: (error) =>
          (this.results[exercise.id] = {
            output: '',
            errors: [error.message ?? 'Code could not run'],
          }),
      });
  }
}

import { Component, inject } from '@angular/core';
import { AsyncPipe, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BehaviorSubject, combineLatest, map, switchMap, tap } from 'rxjs';
import { ButtonComponent, BadgeComponent } from '@optimistic-tanuki/common-ui';
import {
  ActivityAnswerComponent,
  AnswerMark,
  EnrolmentGateComponent,
  LessonCompletionComponent,
  LessonProseComponent,
} from '@optimistic-tanuki/learning-ui';
import { LearningLayoutComponent } from './learning-layout.component';
import { LessonMarkdownService } from './lesson-markdown.service';
import { CodeEditorComponent } from './code-editor.component';
import { CodeDraftStore } from './code-draft.store';
import { Diagnostic, parseCompilerErrors } from './code-diagnostics';
import {
  Exercise,
  LearningDataService,
  LessonProgress,
  NotEnrolledError,
  NotSignedInError,
} from './learning-data.service';

interface ExerciseOutcome {
  output: string;
  errors: string[];
  /** Absent for a plain run, which never judges the answer. */
  passed?: boolean;
  awardedPoints?: number;
  needsSignIn?: boolean;
  /** Which action needed the session, so the message fits what was tried. */
  needsSignInFor?: 'run' | 'submit';
  /** Set when the learner has to enrol before this exercise will accept work. */
  needsEnrolmentIn?: string;
}

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
    CodeEditorComponent,
    EnrolmentGateComponent,
    LessonCompletionComponent,
    LessonProseComponent,
    ActivityAnswerComponent,
  ],
  template: `<learning-layout [trackId]="trackId"
    ><ng-container *ngIf="vm$ | async as vm"
      ><a [routerLink]="['/module', trackId, moduleId]" class="back"
        >← Module</a
      >
      <header>
        <small>Lesson</small>
        <h1>{{ vm.lesson.lesson.title }}</h1>
      </header>
      <div class="lesson-grid">
        <div class="reading">
          <otlearn-lesson-prose [html]="vm.content"></otlearn-lesson-prose>
          <!--
            The work this lesson's author set. Authored activities were
            storable and editable long before anything rendered them, so a
            quiz somebody wrote was never put in front of a reader.
          -->
          @if (vm.lesson.activities?.length) {
          <section class="activities" aria-label="Work set for this lesson">
            <h2>Work</h2>
            @for (activity of vm.lesson.activities ?? []; track activity.id) {
            <otlearn-activity-answer
              [activity]="activity"
              [mark]="marks[activity.id] ?? null"
              [busy]="answering === activity.id"
              [error]="answerErrors[activity.id] ?? ''"
              (answer)="answerActivity(activity.id, $event)"
            ></otlearn-activity-answer>
            }
          </section>
          }
          <!--
            The only way to make progress in a course with no code in it, which
            is most subjects. Progress used to be recorded solely as a side
            effect of passing a code exercise.
          -->
          <otlearn-lesson-completion
            [completed]="vm.lessonCompleted"
            [busy]="marking"
            [error]="markError"
            (toggle)="markRead(vm, $event)"
          ></otlearn-lesson-completion>
        </div>
        <aside aria-label="Practice exercises">
          <div class="practice-head">
            <span>Practice</span>
            <span
              >{{ vm.solvedCount }}/{{
                vm.lesson.exercises.length
              }}
              solved</span
            >
          </div>
          @for (exercise of vm.lesson.exercises; track exercise.id) {
          <section class="exercise" [class.solved]="vm.solved.has(exercise.id)">
            <div class="exercise-head">
              <otui-badge tone="warning" emphasis="soft">{{
                exercise.difficulty
              }}</otui-badge>
              <span class="points">{{ exercise.points }} pts</span>
              @if (vm.solved.has(exercise.id)) {
              <otui-badge tone="success" emphasis="soft">Solved</otui-badge>
              }
            </div>
            <h2>{{ exercise.title }}</h2>
            <p>{{ exercise.description }}</p>
            <learning-code-editor
              [code]="code[exercise.id] ?? exercise.starterCode"
              (codeChange)="onCodeChange(exercise, $event)"
              [language]="exercise.languageId"
              [diagnostics]="diagnostics[exercise.id] ?? []"
              [label]="exercise.title + ' code'"
            ></learning-code-editor>
            @if (exercise.hints.length) {
            <div class="hints">
              @for (hint of revealedHints(exercise); track hint; let i = $index)
              {
              <p>
                <span>Hint {{ i + 1 }}</span
                >{{ hint }}
              </p>
              } @if (hasMoreHints(exercise)) {
              <button
                type="button"
                class="hint-more"
                (click)="revealHint(exercise)"
              >
                {{
                  shownHints[exercise.id]
                    ? 'Show another hint'
                    : 'Stuck? Show a hint'
                }}
                <em>({{ remainingHints(exercise) }} left)</em>
              </button>
              }
            </div>
            }
            <div class="actions">
              <otui-button
                variant="secondary"
                [disabled]="busy[exercise.id]"
                (action)="run(exercise)"
                >Run</otui-button
              >
              <!--
                Flat rather than gradient: the personality paints the gradient
                from a much darker tint than the one --on-primary is computed
                against, which left dark text on a dark stripe.
              -->
              <otui-button
                variant="primary"
                [useGradient]="false"
                [disabled]="busy[exercise.id]"
                (action)="submit(exercise)"
                >Submit</otui-button
              >
              @if (isEdited(exercise)) {
              <button type="button" class="reset" (click)="resetCode(exercise)">
                Reset to starter
              </button>
              } @if (busy[exercise.id]) {
              <span class="working">Running…</span>
              }
            </div>
            @if (results[exercise.id]; as result) {
            <div
              class="result"
              [class.pass]="result.passed === true"
              [class.fail]="result.passed === false"
              role="status"
            >
              @if (result.needsEnrolmentIn; as offeringId) {
              <otlearn-enrolment-gate
                [busy]="enrolling[offeringId] ?? false"
                [error]="enrolError[offeringId] ?? ''"
                (enrol)="enrolThenRetry(exercise, offeringId)"
              ></otlearn-enrolment-gate>
              } @else if (result.needsSignIn && result.needsSignInFor === 'run')
              {
              <p class="verdict">Sign in to run code.</p>
              <p class="detail">
                Executing code needs a session so it can be attributed to you.
              </p>
              } @else if (result.needsSignIn) {
              <p class="verdict">Sign in to save your progress.</p>
              <p class="detail">
                Your code still runs without an account. Only the score needs
                one.
              </p>
              } @else { @if (result.passed === true) {
              <p class="verdict">
                Passed@if (result.awardedPoints) {, +{{ result.awardedPoints }}
                points }
              </p>
              } @else if (result.passed === false) {
              <p class="verdict">Not passed yet</p>
              }
              <pre>{{ transcript(result) }}</pre>
              }
            </div>
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
        color: var(--lx-text-muted);
        text-decoration: none;
        font-size: 0.85rem;
      }
      header {
        margin: 2rem 0;
      }
      header small,
      .practice-head {
        color: var(--lx-accent);
        font: 700 0.7rem var(--lx-font-mono, ui-monospace, monospace);
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
      /*
        A grid item defaults to min-width:auto, which means it refuses to
        shrink below its widest content. Without this a long line of code
        made the whole page scroll sideways on a phone.
      */
      .reading {
        min-width: 0;
      }
      article,
      aside {
        border: 1px solid var(--lx-border);
        background: var(--lx-surface);
      }
      article {
        padding: 1.2rem 1.5rem 2rem;
      }

      /* Rendered lesson markdown. */
      /*
        Lesson typography lives in otlearn-lesson-prose, so the reader's page
        and the author's preview cannot drift apart. It used to be 54 rules
        here, every one of them dead: content bound through innerHTML carries
        no encapsulation attribute, so none of them ever matched.
      */
      otlearn-lesson-prose {
        min-width: 0;
      }
      .activities {
        display: grid;
        gap: 1rem;
        margin-top: 2.5rem;
      }
      .activities h2 {
        margin: 0;
        font-size: 1rem;
      }
      aside {
        padding: 1.1rem;
      }
      .practice-head {
        display: flex;
        justify-content: space-between;
        padding-bottom: 1rem;
        border-bottom: 1px solid var(--lx-border);
      }
      .exercise {
        padding: 1.2rem 0;
        border-bottom: 1px solid var(--lx-border);
      }
      .exercise:last-child {
        border-bottom: 0;
      }
      .exercise.solved h2 {
        color: var(--lx-accent);
      }
      .exercise-head {
        display: flex;
        gap: 0.6rem;
        align-items: center;
      }
      .points {
        color: var(--lx-text-subtle);
        font: 700 0.7rem var(--lx-font-mono, ui-monospace, monospace);
      }
      .exercise h2 {
        margin: 0.65rem 0 0.35rem;
        font-size: 1.15rem;
      }
      .exercise p {
        color: var(--lx-text-muted);
        line-height: 1.55;
      }
      .exercise textarea {
        display: block;
        box-sizing: border-box;
        width: 100%;
        min-height: 220px;
        margin: 1rem 0;
        padding: 1rem;
        border: 1px solid var(--lx-border-strong);
        background: var(--lx-code);
        color: var(--lx-code-text);
        font: 400 0.82rem/1.6 var(--lx-font-mono, ui-monospace, monospace);
      }
      .hints {
        display: grid;
        gap: 0.5rem;
        margin: 0 0 1rem;
        justify-items: start;
      }
      .hints p {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 0.55rem;
        margin: 0;
        color: var(--lx-text-muted);
        font-size: 0.82rem;
        line-height: 1.5;
      }
      .hints p span {
        color: var(--lx-accent);
        font: 700 0.65rem var(--lx-font-mono, ui-monospace, monospace);
        letter-spacing: 0.09em;
        text-transform: uppercase;
        padding-top: 0.16rem;
      }
      .hint-more {
        padding: 0.4rem 0.75rem;
        border: 1px dashed var(--lx-border-strong);
        border-radius: var(--lx-radius, 2px);
        background: none;
        color: var(--lx-text-muted);
        font: 400 0.78rem inherit;
        cursor: pointer;
      }
      .hint-more:hover {
        border-color: var(--lx-accent);
        color: var(--lx-accent);
      }
      .hint-more:focus-visible {
        outline: 2px solid var(--lx-accent);
        outline-offset: 2px;
      }
      .hint-more em {
        color: var(--lx-text-subtle);
        font-style: normal;
      }
      .actions {
        display: flex;
        gap: 0.6rem;
        align-items: center;
        flex-wrap: wrap;
      }
      .working {
        color: var(--lx-text-subtle);
        font-size: 0.8rem;
      }
      .reset {
        padding: 0.4rem 0.7rem;
        border: 1px solid transparent;
        border-radius: var(--lx-radius, 2px);
        background: none;
        color: var(--lx-text-subtle);
        font: 400 0.78rem inherit;
        cursor: pointer;
      }
      .reset:hover {
        border-color: var(--lx-border-strong);
        color: var(--lx-text-body);
      }
      .reset:focus-visible {
        outline: 2px solid var(--lx-accent);
        outline-offset: 2px;
      }
      .result {
        margin: 1rem 0 0;
        padding: 0.8rem;
        border-left: 3px solid var(--lx-border-strong);
        background: var(--lx-well);
      }
      .result.pass {
        border-left-color: var(--lx-accent);
      }
      .result.fail {
        border-left-color: var(--lx-danger);
      }
      .result .verdict {
        margin: 0 0 0.4rem;
        color: var(--lx-text-body);
        font: 700 0.8rem var(--lx-font-mono, ui-monospace, monospace);
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      .result.pass .verdict {
        color: var(--lx-accent);
      }
      .result.fail .verdict {
        color: var(--lx-danger);
      }
      .result .detail {
        margin: 0;
        color: var(--lx-text-subtle);
        font-size: 0.8rem;
      }
      .result pre {
        margin: 0;
        color: var(--lx-text-body);
        white-space: pre-wrap;
        font: 400 0.78rem/1.5 var(--lx-font-mono, ui-monospace, monospace);
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
  private readonly markdown = inject(LessonMarkdownService);
  private readonly drafts = inject(CodeDraftStore);

  protected code: Record<string, string> = {};
  protected results: Record<string, ExerciseOutcome> = {};
  protected diagnostics: Record<string, Diagnostic[]> = {};
  protected enrolling: Record<string, boolean> = {};
  protected enrolError: Record<string, string> = {};
  protected busy: Record<string, boolean> = {};

  readonly trackId = this.route.snapshot.paramMap.get('trackId')!;
  readonly moduleId = this.route.snapshot.paramMap.get('moduleId')!;

  private readonly lesson$ = this.route.paramMap.pipe(
    switchMap((params) =>
      this.data.lesson(params.get('trackId')!, params.get('lessonId')!)
    ),
    tap((lesson) =>
      lesson.exercises.forEach((exercise) => {
        // A saved draft wins over the starter, so navigating away and back
        // does not throw away what the learner was in the middle of writing.
        this.code[exercise.id] ??=
          this.drafts.read(exercise.id) ?? exercise.starterCode;
      })
    )
  );

  /** Pushed after a passing submit so the solved badges update immediately. */
  private readonly progressReload$ = new BehaviorSubject<void>(undefined);

  private readonly progress$ = this.progressReload$.pipe(
    switchMap(() => this.data.myProgress())
  );

  readonly vm$ = combineLatest([this.lesson$, this.progress$]).pipe(
    map(([lesson, progress]) => {
      const solved = new Set(
        progress.flatMap((entry) => entry.completedExerciseIds)
      );
      return {
        lesson,
        // Rendered once per lesson rather than on every change detection
        // pass. Bound as a plain string so Angular sanitizes it on both the
        // server and the browser.
        content: this.markdown.render(lesson.content),
        solved,
        solvedCount: lesson.exercises.filter((exercise) =>
          solved.has(exercise.id)
        ).length,
        lessonCompleted: Boolean(
          progress.find((entry) => entry.lessonId === lesson.lesson.id)
            ?.completed
        ),
        // Carried through so marking a lesson read does not wipe the
        // exercises already solved in it, or the points earned for them.
        recorded: progress.find((entry) => entry.lessonId === lesson.lesson.id),
      };
    })
  );

  protected marking = false;
  protected markError = '';

  /** Marks already returned, per activity. */
  protected marks: Record<string, AnswerMark> = {};
  protected answering = '';
  protected answerErrors: Record<string, string> = {};

  /**
   * Answers an activity the author set and shows what it was marked.
   *
   * The mark is whatever the server returned. Nothing is decided here: a
   * client that graded its own answers would be a client that could award
   * itself anything.
   */
  protected answerActivity(activityId: string, submission: unknown): void {
    this.answering = activityId;
    this.answerErrors = { ...this.answerErrors, [activityId]: '' };
    this.data.answerActivity(activityId, submission).subscribe({
      next: (result) => {
        this.answering = '';
        this.marks = { ...this.marks, [activityId]: result };
        this.progressReload$.next();
      },
      error: (failure: unknown) => {
        this.answering = '';
        this.answerErrors = {
          ...this.answerErrors,
          [activityId]:
            failure instanceof NotSignedInError
              ? 'Sign in to answer.'
              : failure instanceof NotEnrolledError
              ? 'Enrol in this course to answer.'
              : 'Could not send that just now.',
        };
      },
    });
  }

  /**
   * Records, or un-records, that this lesson has been read.
   *
   * Nothing else is sent. The server carries forward whatever was already
   * earned; this used to pass the points back and they were written verbatim,
   * which meant anyone could name their own score.
   */
  protected markRead(
    vm: { lesson: { lesson: { id: string } } },
    completed: boolean
  ): void {
    this.marking = true;
    this.markError = '';
    this.data.markLesson(vm.lesson.lesson.id, completed).subscribe({
      next: () => {
        this.marking = false;
        this.progressReload$.next();
      },
      error: (failure: unknown) => {
        this.marking = false;
        this.markError =
          failure instanceof NotSignedInError
            ? 'Sign in to keep your progress.'
            : failure instanceof NotEnrolledError
            ? 'Enrol in this course to keep your progress.'
            : 'Could not save that just now.';
      },
    });
  }

  /** How many hints the learner has asked for, per exercise. */
  protected shownHints: Record<string, number> = {};

  protected revealedHints(exercise: Exercise): string[] {
    return exercise.hints.slice(0, this.shownHints[exercise.id] ?? 0);
  }

  protected hasMoreHints(exercise: Exercise): boolean {
    return (this.shownHints[exercise.id] ?? 0) < exercise.hints.length;
  }

  protected remainingHints(exercise: Exercise): number {
    return exercise.hints.length - (this.shownHints[exercise.id] ?? 0);
  }

  protected revealHint(exercise: Exercise): void {
    if (!this.hasMoreHints(exercise)) return;
    this.shownHints[exercise.id] = (this.shownHints[exercise.id] ?? 0) + 1;
  }

  protected run(exercise: Exercise): void {
    this.busy[exercise.id] = true;
    this.data.run(exercise.id, this.codeFor(exercise)).subscribe({
      next: (result) => {
        this.results[exercise.id] = {
          output: result.output,
          errors: result.errors,
        };
        this.diagnostics[exercise.id] = parseCompilerErrors(result.errors);
        this.busy[exercise.id] = false;
      },
      error: (error) => this.fail(exercise, error, 'run'),
    });
  }

  protected submit(exercise: Exercise): void {
    this.busy[exercise.id] = true;
    this.data.submit(exercise.id, this.codeFor(exercise)).subscribe({
      next: (result) => {
        this.results[exercise.id] = {
          output: result.output,
          errors: result.errors,
          passed: result.passed,
          awardedPoints: result.awardedPoints,
        };
        this.diagnostics[exercise.id] = parseCompilerErrors(result.errors);
        this.busy[exercise.id] = false;
        if (result.passed) this.progressReload$.next();
      },
      error: (error) => this.fail(exercise, error, 'submit'),
    });
  }

  /**
   * Enrols, then runs the submission the learner already asked for.
   *
   * They pressed Submit and got asked to enrol. Making them press Submit again
   * afterwards would be a second ask for a decision they just made.
   */
  protected enrolThenRetry(exercise: Exercise, offeringId: string): void {
    if (this.enrolling[offeringId]) return;
    this.enrolling[offeringId] = true;
    this.enrolError[offeringId] = '';

    this.data.enrol(offeringId).subscribe({
      next: () => {
        this.enrolling[offeringId] = false;
        delete this.results[exercise.id];
        this.progressReload$.next();
        this.submit(exercise);
      },
      error: (error: Error) => {
        this.enrolling[offeringId] = false;
        this.enrolError[offeringId] = error?.message ?? 'Could not enrol';
      },
    });
  }

  /**
   * Output to show under a result. Joining lives here rather than in the
   * template because the template is a tagged string, so an escape like \n
   * would already be a real newline by the time Angular parsed it.
   */
  protected transcript(result: ExerciseOutcome): string {
    return result.output || result.errors.join('\n') || 'No output';
  }

  /** Records an edit and keeps a draft of it for next time. */
  protected onCodeChange(exercise: Exercise, next: string): void {
    this.code[exercise.id] = next;
    if (next === exercise.starterCode) {
      this.drafts.clear(exercise.id);
      return;
    }
    this.drafts.write(exercise.id, next);
  }

  protected isEdited(exercise: Exercise): boolean {
    return this.codeFor(exercise) !== exercise.starterCode;
  }

  protected resetCode(exercise: Exercise): void {
    this.code[exercise.id] = exercise.starterCode;
    this.drafts.clear(exercise.id);
    this.diagnostics[exercise.id] = [];
  }

  private codeFor(exercise: Exercise): string {
    return this.code[exercise.id] ?? exercise.starterCode;
  }

  private fail(
    exercise: Exercise,
    error: unknown,
    action: 'run' | 'submit'
  ): void {
    this.busy[exercise.id] = false;
    this.diagnostics[exercise.id] = [];
    if (error instanceof NotEnrolledError) {
      this.results[exercise.id] = {
        output: '',
        errors: [],
        needsEnrolmentIn: error.offeringId,
      };
      return;
    }
    if (error instanceof NotSignedInError) {
      this.results[exercise.id] = {
        output: '',
        errors: [],
        needsSignIn: true,
        needsSignInFor: action,
      };
      return;
    }
    this.results[exercise.id] = {
      output: '',
      errors: [(error as Error)?.message ?? 'Code could not run'],
    };
  }
}

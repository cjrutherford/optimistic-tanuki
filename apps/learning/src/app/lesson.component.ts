import { Component, inject } from '@angular/core';
import { AsyncPipe, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  BehaviorSubject,
  combineLatest,
  distinctUntilChanged,
  map,
  shareReplay,
  switchMap,
  tap,
} from 'rxjs';
import { ButtonComponent, BadgeComponent } from '@optimistic-tanuki/common-ui';
import {
  ActivityAnswerComponent,
  AnswerMark,
  CodeActivityResult,
  EnrolmentGateComponent,
  LessonCompletionComponent,
  LessonProseComponent,
} from '@optimistic-tanuki/learning-ui';
import { LearningLayoutComponent } from './learning-layout.component';
import { LessonMarkdownService } from './lesson-markdown.service';
import { CodeEditorComponent } from './code-editor.component';
import { CodeDraftStore } from './code-draft.store';
import { addOfferingToLearningReturnTo } from './route-return';
import { Diagnostic, parseCompilerErrors } from './code-diagnostics';
import {
  Exercise,
  LearningDataService,
  LessonProgress,
  NotEnrolledError,
  NotSignedInError,
  TestResultItem,
} from './learning-data.service';

interface ExerciseOutcome {
  output: string;
  errors: string[];
  /** Absent for a plain run, which never judges the answer. */
  passed?: boolean;
  awardedPoints?: number;
  testsPassed?: boolean;
  testResults?: TestResultItem[];
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
  template: `<learning-layout
    [trackId]="trackId()"
    [offeringId]="effectiveOfferingId()"
    ><ng-container *ngIf="vm$ | async as vm"
      ><a
        [routerLink]="['/module', trackId(), moduleId()]"
        [queryParams]="
          effectiveOfferingId() ? { offeringId: effectiveOfferingId() } : null
        "
        class="back"
        >← Module</a
      >
      <header>
        <small>Lesson</small>
        <h1>{{ vm.lesson.lesson.title }}</h1>
      </header>
      <div class="lesson-grid">
        <article class="reading">
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
              [mark]="
                activity.type === 'code.run' ? null : marks[activity.id] ?? null
              "
              [busy]="answering === activity.id"
              [error]="answerErrors[activity.id] ?? ''"
              [enrolling]="
                activityOfferingId(activity.id)
                  ? enrolling[activityOfferingId(activity.id)!] ?? false
                  : false
              "
              [enrolError]="
                activityOfferingId(activity.id)
                  ? enrolError[activityOfferingId(activity.id)!] ?? ''
                  : ''
              "
              [code]="activityCode[activity.id] ?? activity.starterCode ?? ''"
              [codeResult]="activityResults[activity.id] ?? null"
              (answer)="answerActivity(activity.id, $event)"
              (runCode)="runActivity(activity.id, $event)"
              (submitCode)="submitActivity(activity.id, $event)"
              (enrol)="enrolActivityThenRetry(activity.id, $event)"
            >
              @if (activity.type === 'code.run') {
              <learning-code-editor
                [code]="activityCode[activity.id] ?? activity.starterCode ?? ''"
                (codeChange)="onActivityCodeChange(activity.id, $event)"
                [language]="activity.languageId ?? 'typescript'"
                [diagnostics]="activityDiagnostics[activity.id] ?? []"
                [label]="activity.prompt + ' code'"
              ></learning-code-editor>
              }
            </otlearn-activity-answer>
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
        </article>
        <aside aria-label="Practice exercises">
          <div class="practice-head">
            <span>Practice</span>
            <span
              class="practice-count"
              role="status"
              aria-live="polite"
              [attr.aria-label]="
                vm.solvedCount +
                ' of ' +
                vm.lesson.exercises.length +
                ' exercises solved'
              "
            >
              <span class="counter-led" aria-hidden="true"></span>
              <span class="counter-value"
                >{{ vm.solvedCount }}/{{ vm.lesson.exercises.length }}</span
              >
              <span class="counter-label">solved</span>
            </span>
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
            <div
              class="actions"
              [attr.aria-busy]="busy[exercise.id] ? 'true' : null"
            >
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
              <span class="working" role="status" aria-live="polite"
                >Running…</span
              >
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
                <span class="result-beacon" aria-hidden="true">PASS</span>
                Passed@if (result.awardedPoints) {, +{{ result.awardedPoints }}
                points }
              </p>
              } @else if (result.passed === false) {
              <p class="verdict">
                <span class="result-beacon" aria-hidden="true">FAIL</span>
                Not passed yet
              </p>
              } @if (result.testResults && result.testResults.length > 0) {
              <div class="test-suite-results">
                @for (t of result.testResults; track t.name) {
                <div
                  class="test-item"
                  [class.pass]="t.passed"
                  [class.fail]="!t.passed"
                >
                  <div class="test-item-header">
                    <span class="test-status-badge">{{
                      t.passed ? 'PASS' : 'FAIL'
                    }}</span>
                    <span class="test-name">{{ t.name }}</span>
                  </div>
                  @if (!t.passed && t.error) {
                  <p class="test-error">{{ t.error }}</p>
                  }
                </div>
                }
              </div>
              } @if (result.errors.length) {
              <div class="result-stream diagnostics-stream">
                <span class="stream-label">Compiler / runtime diagnostics</span>
                <pre>{{
                  result.errors.join(
                    '
'
                  )
                }}</pre>
              </div>
              } @if (result.output) {
              <div class="result-stream output-stream">
                <span class="stream-label">Program output</span>
                <pre>{{ result.output }}</pre>
              </div>
              } @if ( !result.errors.length && !result.output &&
              !result.testResults?.length ) {
              <div class="result-stream">
                <span class="stream-label">Run result</span>
                <pre>{{ transcript(result) }}</pre>
              </div>
              } }
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
      .back:hover {
        color: var(--lx-accent);
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
        max-width: 16ch;
        font-size: clamp(2.1rem, 5vw, 4.6rem);
        letter-spacing: -0.06em;
        line-height: 0.92;
        text-wrap: balance;
      }
      .lesson-grid {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(330px, 0.85fr);
        align-items: start;
        gap: 1.2rem;
      }
      /*
        A grid item defaults to min-width:auto, which means it refuses to
        shrink below its widest content. Without this a long line of code
        made the whole page scroll sideways on a phone.
      */
      .reading,
      aside {
        min-width: 0;
        border: var(--lx-border-width) var(--lx-border-style)
          var(--lx-border-strong);
        border-radius: var(--lx-radius);
        background-color: var(--lx-surface);
        background-image: var(--lx-surface-texture);
        box-shadow: var(--lx-shadow-card);
      }
      .reading {
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
        padding-top: 1.25rem;
        border-top: var(--lx-border-width) var(--lx-border-style)
          var(--lx-border-soft);
      }
      .activities h2 {
        margin: 0;
        color: var(--lx-text);
        font: var(--lx-btn-weight) 0.78rem/1 var(--lx-font-mono, monospace);
        letter-spacing: 0.1em;
        font-size: 1rem;
        text-transform: var(--lx-btn-transform, uppercase);
      }
      aside {
        position: relative;
        padding: 1.1rem;
      }
      .practice-head {
        display: flex;
        position: sticky;
        z-index: 2;
        top: 0;
        justify-content: space-between;
        align-items: center;
        gap: 0.8rem;
        margin: -1.1rem -1.1rem 0;
        padding: 1rem 1.1rem 0.85rem;
        padding-bottom: 1rem;
        border-bottom: var(--lx-border-width) var(--lx-border-style)
          var(--lx-border-soft);
        background-color: var(--lx-surface);
        background-image: var(--lx-surface-texture);
        box-shadow: var(--lx-shadow-sm);
      }
      .practice-count {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        min-height: 1.75rem;
        padding: 0.2rem 0.5rem 0.2rem 0.4rem;
        border: var(--lx-border-width) var(--lx-border-style)
          var(--lx-border-accent);
        border-radius: var(--lx-radius);
        background: var(--lx-surface-active);
        color: var(--lx-text);
        box-shadow: var(--lx-shadow-control);
        font: var(--lx-btn-weight) 0.68rem/1 var(--lx-font-mono, monospace);
        letter-spacing: 0.04em;
        text-transform: var(--lx-btn-transform, uppercase);
      }
      .counter-led {
        display: inline-block;
        width: 0.48rem;
        height: 0.48rem;
        border: var(--lx-border-width) var(--lx-border-style) var(--lx-bg);
        border-radius: 50%;
        background: var(--lx-accent);
        box-shadow: var(--lx-shadow-sm);
      }
      .counter-value {
        color: var(--lx-on-surface-active);
        font-size: 0.76rem;
      }
      .counter-label {
        color: var(--lx-text-muted);
      }
      .exercise {
        padding: 1.2rem 0;
        border-bottom: var(--lx-border-width) var(--lx-border-style)
          var(--lx-border-soft);
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
        border: var(--lx-border-width) var(--lx-border-style)
          var(--lx-border-strong);
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
        border: var(--lx-border-width) dashed var(--lx-border-strong);
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
        outline: var(--lx-border-width) solid var(--lx-focus);
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
        padding-top: 0.75rem;
        border-top: var(--lx-border-width) dashed var(--lx-border-soft);
      }
      .actions otui-button {
        min-width: 7rem;
        --personality-button-font-weight: var(--lx-btn-weight);
        --personality-button-text-transform: var(--lx-btn-transform);
        --personality-button-radius: var(--lx-radius);
        --personality-border-width: var(--lx-border-width);
        --personality-border-style: var(--lx-border-style);
        --personality-box-shadow: var(--lx-shadow-control);
        --shadow-lg: var(--lx-shadow-control);
        --shadow-sm: var(--lx-shadow-sm);
        --personality-transition: var(--lx-btn-transition);
      }
      .working {
        display: inline-flex;
        align-items: center;
        min-height: 2rem;
        padding: 0 0.55rem;
        border-left: var(--lx-border-width) var(--lx-border-style)
          var(--lx-accent);
        background: var(--lx-surface-hover);
        color: var(--lx-text-subtle);
        font: 700 0.68rem/1 var(--lx-font-mono, monospace);
        font-size: 0.8rem;
        text-transform: var(--lx-btn-transform, uppercase);
      }
      .reset {
        min-height: 2rem;
        padding: 0.4rem 0.7rem;
        border: var(--lx-border-width) var(--lx-border-style)
          var(--lx-border-soft);
        border-radius: var(--lx-radius, 2px);
        background: var(--lx-surface);
        color: var(--lx-text-muted);
        font: var(--lx-btn-weight) 0.68rem/1 var(--lx-font-mono, monospace);
        text-transform: var(--lx-btn-transform, uppercase);
        box-shadow: var(--lx-shadow-sm);
        cursor: pointer;
        transition: var(--lx-btn-transition);
      }
      .reset:hover {
        border-color: var(--lx-border-strong);
        background: var(--lx-surface-hover);
        color: var(--lx-text);
        box-shadow: var(--lx-shadow-control);
        transform: translateY(-1px);
      }
      .reset:active {
        box-shadow: var(--lx-shadow-inset);
        transform: translate(1px, 1px);
      }
      .reset:focus-visible {
        outline: var(--lx-border-width) solid var(--lx-focus);
        outline-offset: 2px;
      }
      .result {
        margin: 1rem 0 0;
        padding: 0.8rem;
        border: var(--lx-border-width) var(--lx-border-style)
          var(--lx-border-strong);
        border-left-width: calc(var(--lx-border-width) + 2px);
        border-radius: var(--lx-radius);
        background-color: var(--lx-code);
        background-image: var(--lx-surface-texture);
        color: var(--lx-code-text);
        box-shadow: var(--lx-shadow-inset);
      }
      .result.pass {
        border-left-color: var(--lx-accent);
      }
      .result.fail {
        border-left-color: var(--lx-danger);
      }
      .result .verdict {
        display: flex;
        align-items: center;
        gap: 0.55rem;
        margin: 0 0 0.65rem;
        color: var(--lx-code-text);
        font: var(--lx-btn-weight) 0.78rem/1 var(--lx-font-mono, monospace);
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      .result.pass .verdict {
        color: var(--lx-status-pass-on-code);
      }
      .result.fail .verdict {
        color: var(--lx-status-fail-on-code);
      }
      .result-beacon {
        display: inline-flex;
        align-items: center;
        min-height: 1.3rem;
        padding: 0.15rem 0.35rem;
        border: var(--lx-border-width) var(--lx-border-style) currentColor;
        border-radius: var(--lx-radius);
        font-size: 0.58rem;
        letter-spacing: 0.08em;
      }
      .result .detail {
        margin: 0;
        color: var(--lx-text-muted);
        font-size: 0.8rem;
      }

      .test-suite-results {
        display: grid;
        gap: 0.4rem;
        margin: 0.6rem 0;
      }
      .test-item {
        padding: 0.5rem 0.6rem;
        border-radius: var(--lx-radius, 3px);
        background: var(--lx-surface);
        border: var(--lx-border-width) var(--lx-border-style)
          var(--lx-border-soft);
        box-shadow: var(--lx-shadow-sm);
        font-size: 0.8rem;
      }
      .test-item.pass {
        border-left: calc(var(--lx-border-width) + 1px) var(--lx-border-style)
          var(--lx-accent);
      }
      .test-item.fail {
        border-left: calc(var(--lx-border-width) + 1px) var(--lx-border-style)
          var(--lx-danger);
      }
      .test-item-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .test-status-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 2.45rem;
        min-height: 1.2rem;
        padding: 0.1rem 0.25rem;
        border: var(--lx-border-width) var(--lx-border-style) currentColor;
        border-radius: var(--lx-radius);
        font: var(--lx-btn-weight) 0.56rem/1 var(--lx-font-mono, monospace);
        letter-spacing: 0.04em;
      }
      .test-item.pass .test-status-badge {
        color: var(--lx-accent);
      }
      .test-item.fail .test-status-badge {
        color: var(--lx-danger);
      }
      .test-name {
        font-weight: 600;
        color: var(--lx-text);
        font-family: var(--lx-font-mono, ui-monospace, monospace);
        font-size: 0.78rem;
      }
      .test-error {
        margin: 0.45rem 0 0 3.1rem;
        color: var(--lx-danger);
        font-size: 0.76rem;
        font-family: var(--lx-font-mono, ui-monospace, monospace);
        white-space: pre-wrap;
      }

      .result-stream {
        display: grid;
        gap: 0.35rem;
        margin-top: 0.7rem;
        padding-top: 0.6rem;
        border-top: var(--lx-border-width) var(--lx-border-style)
          var(--lx-border-soft);
      }
      .stream-label {
        color: var(--lx-text-muted);
        font: var(--lx-btn-weight) 0.6rem/1 var(--lx-font-mono, monospace);
        letter-spacing: 0.08em;
        text-transform: var(--lx-btn-transform, uppercase);
      }
      .result pre {
        margin: 0;
        color: var(--lx-code-text);
        white-space: pre-wrap;
        font: 400 0.78rem/1.5 var(--lx-font-mono, ui-monospace, monospace);
      }
      @media (max-width: 850px) {
        .lesson-grid {
          grid-template-columns: 1fr;
        }
        .practice-head {
          position: static;
          margin: -1.1rem -1.1rem 0;
        }
      }
      @media (max-width: 520px) {
        .reading {
          padding: 1rem 0.9rem 1.5rem;
        }
        aside {
          padding: 1rem 0.9rem;
        }
        .practice-head {
          margin: -1rem -0.9rem 0;
          padding-inline: 0.9rem;
        }
        .actions otui-button {
          flex: 1 1 8rem;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .reset,
        .practice-count {
          transition: none;
        }
      }
    `,
  ],
})
export class LessonComponent {
  private readonly data = inject(LearningDataService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly markdown = inject(LessonMarkdownService);
  private readonly drafts = inject(CodeDraftStore);

  protected code: Record<string, string> = {};
  protected results: Record<string, ExerciseOutcome> = {};
  protected diagnostics: Record<string, Diagnostic[]> = {};
  protected enrolling: Record<string, boolean> = {};
  protected enrolError: Record<string, string> = {};
  protected busy: Record<string, boolean> = {};

  private routeGeneration = 0;
  private readonly routeState$ = combineLatest([
    this.route.paramMap,
    this.route.queryParamMap,
  ]).pipe(
    map(([params, query]) => ({
      trackId: params.get('trackId') ?? '',
      moduleId: params.get('moduleId') ?? '',
      lessonId: params.get('lessonId') ?? '',
      offeringId: query.get('offeringId') ?? '',
    })),
    distinctUntilChanged(
      (left, right) =>
        left.trackId === right.trackId &&
        left.moduleId === right.moduleId &&
        left.lessonId === right.lessonId &&
        left.offeringId === right.offeringId
    ),
    tap(() => this.resetRouteState()),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  readonly trackId = toSignal(
    this.routeState$.pipe(map((state) => state.trackId)),
    {
      initialValue: this.route.snapshot.paramMap.get('trackId') ?? '',
    }
  );
  readonly moduleId = toSignal(
    this.routeState$.pipe(map((state) => state.moduleId)),
    {
      initialValue: this.route.snapshot.paramMap.get('moduleId') ?? '',
    }
  );
  private readonly lesson$ = this.routeState$.pipe(
    switchMap((state) => {
      const generation = this.routeGeneration;
      return this.data
        .lesson(
          state.trackId,
          state.lessonId,
          state.offeringId || undefined,
          state.moduleId || undefined
        )
        .pipe(
          tap((lesson) => {
            if (generation !== this.routeGeneration) return;
            lesson.exercises.forEach((exercise) => {
              // A saved draft wins over the starter, so navigating away and
              // back does not throw away what the learner was writing.
              this.code[exercise.id] ??=
                this.drafts.read(exercise.id) ?? exercise.starterCode;
            });
          })
        );
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  readonly effectiveOfferingId = toSignal(
    combineLatest([this.routeState$, this.lesson$]).pipe(
      map(([state, lesson]) => state.offeringId || lesson.offeringId || '')
    ),
    {
      initialValue: this.route.snapshot.queryParamMap.get('offeringId') ?? '',
    }
  );

  /** Pushed after a passing submit so the solved badges update immediately. */
  private readonly progressReload$ = new BehaviorSubject<void>(undefined);

  private readonly progress$ = this.progressReload$.pipe(
    switchMap(() => this.data.myProgress())
  );

  readonly vm$ = combineLatest([
    this.lesson$,
    this.progress$,
    this.routeState$,
  ]).pipe(
    map(([lesson, progress, routeState]) => {
      const selectedOfferingId = routeState.offeringId || lesson.offeringId;
      const scopedProgress = progress.filter(
        (entry) =>
          !selectedOfferingId || entry.offeringId === selectedOfferingId
      );
      const solved = new Set(
        scopedProgress.flatMap((entry) => entry.completedExerciseIds)
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
          scopedProgress.find((entry) => entry.lessonId === lesson.lesson.id)
            ?.completed
        ),
        // Carried through so marking a lesson read does not wipe the
        // exercises already solved in it, or the points earned for them.
        recorded: scopedProgress.find(
          (entry) => entry.lessonId === lesson.lesson.id
        ),
      };
    })
  );

  protected marking = false;
  protected markError = '';

  /** Marks already returned, per activity. */
  protected marks: Record<string, AnswerMark> = {};
  protected answering = '';
  protected answerErrors: Record<string, string> = {};
  protected activityCode: Record<string, string> = {};
  protected activityResults: Record<string, CodeActivityResult> = {};
  protected activityDiagnostics: Record<string, Diagnostic[]> = {};
  protected pendingActivityAction: Record<string, 'run' | 'submit'> = {};

  /**
   * Answers an activity the author set and shows what it was marked.
   *
   * The mark is whatever the server returned. Nothing is decided here: a
   * client that graded its own answers would be a client that could award
   * itself anything.
   */
  protected answerActivity(activityId: string, submission: unknown): void {
    const generation = this.routeGeneration;
    this.answering = activityId;
    this.answerErrors = { ...this.answerErrors, [activityId]: '' };
    const offeringId = this.effectiveOfferingId();
    const request = offeringId
      ? this.data.answerActivity(activityId, submission, offeringId)
      : this.data.answerActivity(activityId, submission);
    request.subscribe({
      next: (result) => {
        if (generation !== this.routeGeneration) return;
        this.answering = '';
        this.marks = { ...this.marks, [activityId]: result };
        this.progressReload$.next();
      },
      error: (failure: unknown) => {
        if (generation !== this.routeGeneration) return;
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

  protected onActivityCodeChange(activityId: string, code: string): void {
    this.activityCode[activityId] = code;
    this.activityDiagnostics[activityId] = [];
  }

  protected activityOfferingId(_activityId: string): string {
    return this.effectiveOfferingId();
  }

  protected enrolActivityThenRetry(
    activityId: string,
    offeringId: string
  ): void {
    this.enrolling[offeringId] = true;
    this.enrolError[offeringId] = '';
    this.data.enrol(offeringId).subscribe({
      next: () => {
        this.enrolling[offeringId] = false;
        const code = this.activityCode[activityId] ?? '';
        const action = this.pendingActivityAction[activityId];
        delete this.pendingActivityAction[activityId];
        if (action === 'run') this.runActivity(activityId, code);
        else this.submitActivity(activityId, code);
      },
      error: () => {
        this.enrolling[offeringId] = false;
        this.enrolError[offeringId] = 'Could not enrol just now.';
      },
    });
  }

  protected runActivity(activityId: string, code: string): void {
    const generation = this.routeGeneration;
    this.activityCode[activityId] = code;
    this.answering = activityId;
    this.answerErrors = { ...this.answerErrors, [activityId]: '' };
    const offeringId = this.effectiveOfferingId();
    const request = offeringId
      ? this.data.run(activityId, code, offeringId)
      : this.data.run(activityId, code);
    request.subscribe({
      next: (result) => {
        if (generation !== this.routeGeneration) return;
        this.answering = '';
        delete this.pendingActivityAction[activityId];
        this.activityResults = {
          ...this.activityResults,
          [activityId]: {
            output: result.output,
            errors: result.errors,
            testsPassed: result.testsPassed,
          },
        };
        this.activityDiagnostics = {
          ...this.activityDiagnostics,
          [activityId]: parseCompilerErrors(result.errors),
        };
      },
      error: (failure: unknown) => {
        if (generation !== this.routeGeneration) return;
        this.answering = '';
        this.activityResults = {
          ...this.activityResults,
          [activityId]: {
            output: '',
            errors: [],
            needsSignIn: failure instanceof NotSignedInError,
            needsSignInFor: 'run',
            needsEnrolmentIn:
              failure instanceof NotEnrolledError
                ? failure.offeringId || offeringId
                : undefined,
          },
        };
        if (failure instanceof NotEnrolledError) {
          this.pendingActivityAction[activityId] = 'run';
        }
      },
    });
  }

  protected submitActivity(activityId: string, code: string): void {
    const generation = this.routeGeneration;
    this.activityCode[activityId] = code;
    this.answering = activityId;
    this.answerErrors = { ...this.answerErrors, [activityId]: '' };
    const offeringId = this.effectiveOfferingId();
    const request = offeringId
      ? this.data.answerActivity(activityId, code, offeringId)
      : this.data.answerActivity(activityId, code);
    request.subscribe({
      next: (result) => {
        if (generation !== this.routeGeneration) return;
        this.answering = '';
        delete this.pendingActivityAction[activityId];
        const passed =
          result.passed ??
          (result.maxScore !== undefined &&
            result.score !== undefined &&
            result.score === result.maxScore);
        this.activityResults = {
          ...this.activityResults,
          [activityId]: {
            output: result.output ?? '',
            errors: result.errors ?? [],
            passed,
            testsPassed: result.testsPassed,
            awardedPoints: result.awardedPoints,
          },
        };
        this.activityDiagnostics = {
          ...this.activityDiagnostics,
          [activityId]: parseCompilerErrors(result.errors ?? []),
        };
        this.progressReload$.next();
      },
      error: (failure: unknown) => {
        if (generation !== this.routeGeneration) return;
        this.answering = '';
        this.activityResults = {
          ...this.activityResults,
          [activityId]: {
            output: '',
            errors: [],
            needsSignIn: failure instanceof NotSignedInError,
            needsSignInFor: 'submit',
            needsEnrolmentIn:
              failure instanceof NotEnrolledError
                ? failure.offeringId || offeringId
                : undefined,
          },
        };
        if (failure instanceof NotEnrolledError) {
          this.pendingActivityAction[activityId] = 'submit';
        }
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
    const generation = this.routeGeneration;
    this.marking = true;
    this.markError = '';
    const offeringId = this.effectiveOfferingId();
    const request = offeringId
      ? this.data.markLesson(vm.lesson.lesson.id, completed, offeringId)
      : this.data.markLesson(vm.lesson.lesson.id, completed);
    request.subscribe({
      next: () => {
        if (generation !== this.routeGeneration) return;
        this.marking = false;
        this.progressReload$.next();
      },
      error: (failure: unknown) => {
        if (generation !== this.routeGeneration) return;
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
    const generation = this.routeGeneration;
    this.busy[exercise.id] = true;
    this.data.run(exercise.id, this.codeFor(exercise)).subscribe({
      next: (result) => {
        if (generation !== this.routeGeneration) return;
        this.results[exercise.id] = {
          output: result.output,
          errors: result.errors,
          testsPassed: result.testsPassed,
          testResults: result.testResults,
        };
        this.diagnostics[exercise.id] = parseCompilerErrors(result.errors);
        this.busy[exercise.id] = false;
      },
      error: (error) => {
        if (generation !== this.routeGeneration) return;
        this.fail(exercise, error, 'run');
      },
    });
  }

  protected submit(exercise: Exercise): void {
    const generation = this.routeGeneration;
    this.busy[exercise.id] = true;
    const offeringId = this.effectiveOfferingId();
    const request = offeringId
      ? this.data.submit(exercise.id, this.codeFor(exercise), offeringId)
      : this.data.submit(exercise.id, this.codeFor(exercise));
    request.subscribe({
      next: (result) => {
        if (generation !== this.routeGeneration) return;
        this.results[exercise.id] = {
          output: result.output,
          errors: result.errors,
          passed: result.passed,
          awardedPoints: result.awardedPoints,
          testsPassed: result.testsPassed,
          testResults: result.testResults,
        };
        this.diagnostics[exercise.id] = parseCompilerErrors(result.errors);
        this.busy[exercise.id] = false;
        if (result.passed) this.progressReload$.next();
      },
      error: (error) => {
        if (generation !== this.routeGeneration) return;
        this.fail(exercise, error, 'submit');
      },
    });
  }

  /**
   * Enrols, then runs the submission the learner already asked for.
   *
   * They pressed Submit and got asked to enrol. Making them press Submit again
   * afterwards would be a second ask for a decision they just made.
   */
  protected enrolThenRetry(exercise: Exercise, offeringId: string): void {
    const generation = this.routeGeneration;
    if (this.enrolling[offeringId]) return;
    this.enrolling[offeringId] = true;
    this.enrolError[offeringId] = '';

    this.data.enrol(offeringId).subscribe({
      next: () => {
        if (generation !== this.routeGeneration) return;
        this.enrolling[offeringId] = false;
        delete this.results[exercise.id];
        this.progressReload$.next();
        this.submit(exercise);
      },
      error: (error: Error & { status?: number }) => {
        if (generation !== this.routeGeneration) return;
        this.enrolling[offeringId] = false;
        if (error?.status === 401) {
          // Do not retry a mutation after sign-in. Return to this exact lesson
          // so the learner can make the enrolment decision once authenticated.
          this.router.navigate(['/sign-in'], {
            queryParams: {
              returnTo: addOfferingToLearningReturnTo(
                this.router.url,
                this.effectiveOfferingId()
              ),
            },
          });
          return;
        }
        this.enrolError[offeringId] =
          error?.status === 409
            ? 'You are already enrolled. Refresh this lesson, then continue.'
            : error?.message ?? 'Could not enrol';
      },
    });
  }

  /**
   * Output to show under a result. Joining lives here rather than in the
   * template because the template is a tagged string, so an escape like \n
   * would already be a real newline by the time Angular parsed it.
   */
  protected transcript(result: ExerciseOutcome): string {
    if (
      result.testResults &&
      result.testResults.length > 0 &&
      !result.output &&
      result.errors.length === 0
    ) {
      return '';
    }
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
        // Some gateway error serializers omit the offering id. The lesson
        // route already carries the selected offering, so keep the enrolment
        // invitation actionable instead of rendering an empty result well.
        needsEnrolmentIn: error.offeringId || this.effectiveOfferingId(),
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

  private resetRouteState(): void {
    this.routeGeneration += 1;
    this.code = {};
    this.results = {};
    this.diagnostics = {};
    this.enrolling = {};
    this.enrolError = {};
    this.busy = {};
    this.marking = false;
    this.markError = '';
    this.marks = {};
    this.answering = '';
    this.answerErrors = {};
    this.activityCode = {};
    this.activityResults = {};
    this.activityDiagnostics = {};
    this.pendingActivityAction = {};
    this.shownHints = {};
  }
}

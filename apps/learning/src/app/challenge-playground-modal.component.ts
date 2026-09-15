import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { CodeEditorComponent } from './code-editor.component';
import { CodeDraftStore } from './code-draft.store';
import { Diagnostic, parseCompilerErrors } from './code-diagnostics';
import {
  ChallengeListItem,
  LearningDataService,
  NotEnrolledError,
  NotSignedInError,
  SubmitResult,
  TestResultItem,
} from './learning-data.service';
import {
  addOfferingToLearningReturnTo,
  normalizeLearningReturnTo,
} from './route-return';

interface ModalOutcome {
  output: string;
  errors: string[];
  passed?: boolean;
  awardedPoints?: number;
  testsPassed?: boolean;
  testResults?: TestResultItem[];
  needsSignIn?: boolean;
  needsEnrolmentIn?: string;
}

const DIALOG_FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const CHALLENGE_FILE_EXTENSIONS: Record<string, string> = {
  typescript: 'ts',
  javascript: 'js',
  go: 'go',
  cpp: 'cpp',
  rust: 'rs',
};

export function challengeFileName(languageId: string): string {
  const normalized = languageId.trim().toLowerCase();
  return `main.${CHALLENGE_FILE_EXTENSIONS[normalized] ?? 'txt'}`;
}

@Component({
  selector: 'learning-playground-modal',
  standalone: true,
  imports: [CommonModule, CodeEditorComponent, RouterLink, CdkTrapFocus],
  template: `
    <div class="modal-backdrop" (click)="onBackdropClick($event)">
      <div
        class="modal-dialog"
        role="dialog"
        #dialog
        cdkTrapFocus
        [cdkTrapFocusAutoCapture]="false"
        aria-modal="true"
        [attr.aria-labelledby]="'challenge-modal-title'"
        tabindex="-1"
      >
        <header class="modal-header">
          <div class="header-left">
            <div class="meta-row">
              <span class="chip track-chip">{{
                challenge.trackDisplayName || 'Go'
              }}</span>
              <span
                class="chip difficulty"
                [attr.data-diff]="challenge.difficulty"
              >
                {{ challenge.difficulty }}
              </span>
              <span class="chip points">+{{ challenge.points }} pts</span>
              @if (isSolved) {
              <span class="chip solved-badge">✓ Solved</span>
              }
            </div>
            <h2 id="challenge-modal-title" class="title">
              {{ challenge.title }}
            </h2>
          </div>
          <div class="header-actions">
            <button
              type="button"
              class="btn-visit"
              (click)="onVisitLesson()"
              title="Open full lesson"
            >
              Go to Lesson →
            </button>
            <button
              type="button"
              #closeButton
              class="btn-close"
              (click)="close.emit()"
              aria-label="Close playground"
            >
              ✕
            </button>
          </div>
        </header>

        <div class="modal-body">
          <div class="description-section">
            <p class="description-text">{{ challenge.description }}</p>
            <p class="access-note">
              Run and record this challenge with a signed-in learner enrolled in
              its course. Your draft stays in this browser until then.
            </p>
            @if (challenge.hints && challenge.hints.length > 0) {
            <div class="hints-box">
              <div class="hints-header">
                <div class="hints-label">
                  <span class="hints-icon">💡</span>
                  <span
                    >Progressive Hints ({{ revealedHints }}/{{
                      challenge.hints.length
                    }})</span
                  >
                </div>
                @if (revealedHints < challenge.hints.length) {
                <button
                  type="button"
                  class="btn-hint-reveal"
                  (click)="revealNextHint()"
                >
                  Reveal Hint {{ revealedHints + 1 }} →
                </button>
                } @else {
                <span class="all-revealed">All hints revealed</span>
                }
              </div>
              @if (revealedHints > 0) {
              <div class="hints-list">
                @for (hint of challenge.hints.slice(0, revealedHints); track
                $index) {
                <div class="hint-entry">
                  <span class="hint-index">0{{ $index + 1 }}</span>
                  <span class="hint-content">{{ hint }}</span>
                </div>
                }
              </div>
              }
            </div>
            }
          </div>

          <div class="editor-section">
            <div class="editor-toolbar">
              <span class="file-tab">
                <span class="file-dot"></span>
                <span>{{ fileName }}</span>
              </span>
              <button
                type="button"
                class="btn-reset"
                (click)="resetStarterCode()"
                title="Reset editor back to starter code"
              >
                Reset Code
              </button>
            </div>

            <learning-code-editor
              [code]="code"
              (codeChange)="onCodeChanged($event)"
              [language]="challenge.languageId"
              [diagnostics]="diagnostics"
            ></learning-code-editor>

            <div class="action-bar">
              <div class="shortcut-tip">
                <kbd>Ctrl</kbd> + <kbd>Enter</kbd> to run
              </div>
              <button
                type="button"
                class="btn-run"
                [disabled]="running"
                (click)="runCode()"
              >
                @if (running) {
                <span class="spinner-sm"></span>
                <span>Evaluating…</span>
                } @else {
                <span>⚡ Run & Test Code</span>
                }
              </button>
            </div>

            @if (outcome; as res) {
            <div class="outcome-panel">
              @if (res.passed) {
              <div class="banner-success">
                <span class="banner-icon">✓</span>
                <span class="banner-text"
                  >All assertions passed! (+{{
                    res.awardedPoints || challenge.points
                  }}
                  pts)</span
                >
              </div>
              } @else if (res.needsSignIn) {
              <div class="banner-error">
                <span class="banner-icon">!</span>
                <span class="banner-text"
                  >Please sign in to run and record challenges.</span
                >
              </div>
              <a
                class="outcome-link"
                routerLink="/sign-in"
                [queryParams]="{ returnTo: returnTo }"
                >Sign in to continue</a
              >
              } @else if (res.needsEnrolmentIn) {
              <div class="banner-error">
                <span class="banner-icon">!</span>
                <span class="banner-text"
                  >Please enroll in this course offering to submit
                  solutions.</span
                >
              </div>
              <a
                class="outcome-link"
                [routerLink]="['/course', res.needsEnrolmentIn]"
                >Open the course and enrol</a
              >
              } @else if (res.errors && res.errors.length > 0) {
              <div class="banner-error">
                <span class="banner-icon">✕</span>
                <span class="banner-text">Evaluation failed</span>
              </div>
              } @if (res.testResults && res.testResults.length > 0) {
              <div class="test-suite">
                @for (t of res.testResults; track t.name) {
                <div
                  class="test-item"
                  [class.pass]="t.passed"
                  [class.fail]="!t.passed"
                >
                  <div class="test-row">
                    <span class="test-badge">{{ t.passed ? '✓' : '✕' }}</span>
                    <span class="test-name">{{ t.name }}</span>
                  </div>
                  @if (!t.passed && t.error) {
                  <p class="test-error">{{ t.error }}</p>
                  }
                </div>
                }
              </div>
              } @if (transcript(res)) {
              <pre class="transcript">{{ transcript(res) }}</pre>
              }
            </div>
            }
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .modal-backdrop {
        position: fixed;
        inset: 0;
        z-index: 1000;
        background: color-mix(in srgb, var(--lx-bg) 82%, transparent);
        backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
      }
      .modal-dialog {
        background: var(--lx-surface);
        background-image: var(--lx-surface-texture);
        border: var(--lx-border-width) var(--lx-border-style)
          var(--lx-border-strong);
        border-radius: var(--lx-radius);
        box-shadow: var(--lx-shadow-card);
        width: 100%;
        max-width: min(960px, 100%);
        max-height: min(90vh, 54rem);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        color: var(--lx-text-body);
        animation: modalScaleIn var(--animation-duration-fast, 100ms)
          var(--animation-easing, steps(2));
      }
      @keyframes modalScaleIn {
        from {
          opacity: 0;
          transform: scale(0.97) translateY(6px);
        }
        to {
          opacity: 1;
          transform: scale(1) translateY(0);
        }
      }
      .modal-header {
        padding: 0.9rem 1.4rem;
        border-bottom: var(--lx-border-width) var(--lx-border-style)
          var(--lx-border);
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        background: var(--lx-well);
        gap: 1rem;
      }
      .meta-row {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        margin-bottom: 0.35rem;
      }
      .chip {
        font: 700 0.65rem var(--lx-font-mono, monospace);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        padding: 0.12rem 0.45rem;
        border-radius: var(--lx-radius);
        border-width: var(--lx-border-width);
        border-style: var(--lx-border-style);
      }
      .chip.track-chip {
        color: var(--lx-accent);
        background: var(--lx-inline-code);
        border-color: var(--lx-border-accent);
      }
      .chip.difficulty[data-diff='easy'] {
        background: var(--lx-inline-code);
        color: var(--lx-accent);
        border-color: var(--lx-border-accent);
      }
      .chip.difficulty[data-diff='medium'] {
        background: color-mix(in srgb, var(--lx-warn) 12%, transparent);
        color: var(--lx-warn);
        border-color: var(--lx-warn);
      }
      .chip.difficulty[data-diff='hard'] {
        background: color-mix(in srgb, var(--lx-danger) 12%, transparent);
        color: var(--lx-danger);
        border-color: var(--lx-danger);
      }
      .chip.points {
        background: var(--lx-code);
        color: var(--lx-text-subtle);
        border-color: var(--lx-border-soft);
      }
      .chip.solved-badge {
        background: var(--lx-inline-code);
        color: var(--lx-accent);
        border-color: var(--lx-accent);
      }
      .title {
        margin: 0;
        font-family: var(--lx-font-heading);
        font-size: 1.25rem;
        font-weight: 700;
        color: var(--lx-text);
        letter-spacing: 0.02em;
      }
      .header-actions {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .btn-visit {
        padding: 0.35rem 0.75rem;
        background: transparent;
        border: var(--lx-border-width) var(--lx-border-style) var(--lx-border);
        color: var(--lx-text-muted);
        border-radius: var(--lx-radius);
        font: var(--lx-btn-weight) 0.7rem var(--lx-font-mono, monospace);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        cursor: pointer;
        box-shadow: var(--lx-shadow-control);
        transition: var(--lx-btn-transition);
      }
      .btn-visit:hover {
        color: var(--lx-text);
        border-color: var(--lx-border-strong);
        background: var(--lx-surface-hover);
      }
      .btn-close {
        background: transparent;
        border: var(--lx-border-width) var(--lx-border-style) var(--lx-border);
        color: var(--lx-text-muted);
        font: var(--lx-btn-weight) 0.85rem var(--lx-font-mono, monospace);
        cursor: pointer;
        padding: 0.25rem 0.55rem;
        border-radius: var(--lx-radius);
        box-shadow: var(--lx-shadow-control);
        transition: var(--lx-btn-transition);
      }
      .btn-close:hover {
        background: var(--lx-surface-hover);
        color: var(--lx-danger);
        border-color: var(--lx-danger);
      }
      .btn-visit:active,
      .btn-close:active {
        transform: translate(1px, 1px);
        box-shadow: var(--lx-shadow-inset);
      }
      .btn-visit:focus-visible,
      .btn-close:focus-visible,
      .btn-hint-reveal:focus-visible,
      .btn-reset:focus-visible,
      .btn-run:focus-visible,
      .outcome-link:focus-visible {
        outline: var(--lx-border-width) solid var(--lx-focus);
        outline-offset: 2px;
      }

      .modal-body {
        display: flex;
        flex-direction: column;
        overflow-y: auto;
      }
      .description-section {
        padding: 0.9rem 1.4rem;
        background: var(--lx-code);
        border-bottom: var(--lx-border-width) var(--lx-border-style)
          var(--lx-border-strong);
      }
      .description-text {
        margin: 0;
        font: 0.8rem/1.55 var(--lx-font-mono, monospace);
        color: var(--lx-text-body);
      }
      .access-note {
        margin: 0.65rem 0 0;
        color: var(--lx-text-muted);
        font: 0.7rem/1.5 var(--lx-font-mono, monospace);
      }
      .hints-box {
        margin-top: 0.75rem;
        border: var(--lx-border-width) var(--lx-border-style)
          var(--lx-border-soft);
        background: var(--lx-well);
        border-radius: var(--lx-radius);
        overflow: hidden;
      }
      .hints-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.45rem 0.85rem;
        background: var(--lx-surface);
        border-bottom: var(--lx-border-width) var(--lx-border-style)
          var(--lx-border-soft);
        font: 700 0.68rem var(--lx-font-mono, monospace);
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .hints-label {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        color: var(--lx-warn);
      }
      .hints-icon {
        font-size: 0.85rem;
      }
      .btn-hint-reveal {
        background: var(--lx-inline-code);
        color: var(--lx-warn);
        border: var(--lx-border-width) var(--lx-border-style) var(--lx-warn);
        font: var(--lx-btn-weight) 0.65rem var(--lx-font-mono, monospace);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        border-radius: var(--lx-radius);
        padding: 0.2rem 0.6rem;
        cursor: pointer;
        box-shadow: var(--lx-shadow-control);
        transition: var(--lx-btn-transition);
      }
      .btn-hint-reveal:hover {
        box-shadow: var(--lx-shadow-card);
      }
      .btn-hint-reveal:active {
        transform: translate(1px, 1px);
        box-shadow: var(--lx-shadow-inset);
      }
      .all-revealed {
        font-size: 0.65rem;
        color: var(--lx-text-faint);
      }
      .hints-list {
        display: flex;
        flex-direction: column;
      }
      .hint-entry {
        display: flex;
        align-items: flex-start;
        gap: 0.6rem;
        padding: 0.45rem 0.85rem;
        border-bottom: var(--lx-border-width) dashed var(--lx-border-soft);
        font: 0.78rem var(--lx-font-mono, monospace);
        color: var(--lx-text-body);
      }
      .hint-entry:last-child {
        border-bottom: none;
      }
      .hint-index {
        display: inline-grid;
        min-width: 1.4rem;
        min-height: 1.4rem;
        place-items: center;
        border: var(--lx-border-width) var(--lx-border-style) var(--lx-accent);
        border-radius: 50%;
        background: var(--lx-inline-code);
        color: var(--lx-accent);
        font-weight: 700;
        font-size: 0.7rem;
      }
      .hint-content {
        flex: 1;
      }

      .editor-section {
        display: flex;
        flex-direction: column;
        background: var(--lx-code);
      }
      .editor-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.35rem 1rem;
        background: var(--lx-well);
        border-bottom: var(--lx-border-width) var(--lx-border-style)
          var(--lx-border-soft);
      }
      .file-tab {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        font: 700 0.68rem var(--lx-font-mono, monospace);
        color: var(--lx-accent);
        letter-spacing: 0.05em;
      }
      .file-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--lx-accent);
      }
      .btn-reset {
        background: transparent;
        border: var(--lx-border-width) var(--lx-border-style)
          var(--lx-border-soft);
        color: var(--lx-text-muted);
        font: var(--lx-btn-weight) 0.65rem var(--lx-font-mono, monospace);
        letter-spacing: 0.05em;
        text-transform: uppercase;
        padding: 0.2rem 0.55rem;
        border-radius: var(--lx-radius);
        cursor: pointer;
        box-shadow: var(--lx-shadow-sm);
        transition: var(--lx-btn-transition);
      }
      .btn-reset:hover {
        color: var(--lx-text);
        border-color: var(--lx-border);
        box-shadow: var(--lx-shadow-control);
      }
      .btn-reset:active {
        transform: translate(1px, 1px);
        box-shadow: var(--lx-shadow-inset);
      }
      .action-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.6rem 1rem;
        background: var(--lx-well);
        border-top: var(--lx-border-width) var(--lx-border-style)
          var(--lx-border-soft);
      }
      .shortcut-tip {
        font: 0.7rem var(--lx-font-mono, monospace);
        color: var(--lx-text-faint);
      }
      .shortcut-tip kbd {
        background: var(--lx-code);
        border: var(--lx-border-width) var(--lx-border-style)
          var(--lx-border-strong);
        border-radius: var(--lx-radius);
        padding: 0.1rem 0.3rem;
        font-family: inherit;
        color: var(--lx-text-muted);
      }
      .btn-run {
        padding: 0.5rem 1.25rem;
        background: var(--lx-accent);
        color: var(--lx-bg);
        border: var(--lx-border-width) var(--lx-border-style) var(--lx-accent);
        border-radius: var(--lx-radius);
        font: var(--lx-btn-weight) 0.72rem var(--lx-font-mono, monospace);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        box-shadow: var(--lx-shadow-control);
        transition: var(--lx-btn-transition);
      }
      .btn-run:hover:not(:disabled) {
        box-shadow: var(--lx-shadow-card);
      }
      .btn-run:active:not(:disabled) {
        transform: translate(1px, 1px);
        box-shadow: var(--lx-shadow-inset);
      }
      .btn-run:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .spinner-sm {
        width: 12px;
        height: 12px;
        border: 2px solid color-mix(in srgb, currentColor 20%, transparent);
        border-top-color: currentColor;
        border-radius: 50%;
        animation: spin 0.6s linear infinite;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      .outcome-panel {
        padding: 0.85rem 1.25rem;
        background: var(--lx-code);
        border-top: var(--lx-border-width) var(--lx-border-style)
          var(--lx-border-strong);
        box-shadow: var(--lx-shadow-inset);
        max-height: 220px;
        overflow-y: auto;
      }
      .banner-success {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        background: color-mix(in srgb, var(--lx-accent) 8%, transparent);
        border: var(--lx-border-width) var(--lx-border-style) var(--lx-accent);
        color: var(--lx-accent);
        font: 700 0.75rem var(--lx-font-mono, monospace);
        letter-spacing: 0.05em;
        text-transform: uppercase;
        padding: 0.55rem 0.85rem;
        border-radius: var(--lx-radius);
        margin-bottom: 0.6rem;
      }
      .banner-error {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        background: color-mix(in srgb, var(--lx-danger) 8%, transparent);
        border: var(--lx-border-width) var(--lx-border-style) var(--lx-danger);
        color: var(--lx-danger);
        font: 700 0.75rem var(--lx-font-mono, monospace);
        letter-spacing: 0.05em;
        text-transform: uppercase;
        padding: 0.55rem 0.85rem;
        border-radius: var(--lx-radius);
        margin-bottom: 0.6rem;
      }
      .banner-icon {
        font-weight: 900;
      }
      .test-suite {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        margin-bottom: 0.6rem;
      }
      .test-item {
        padding: 0.4rem 0.65rem;
        border-radius: var(--lx-radius);
        background: var(--lx-well);
        border: var(--lx-border-width) var(--lx-border-style)
          var(--lx-border-soft);
        font: 0.75rem var(--lx-font-mono, monospace);
      }
      .test-item.pass {
        border-left: calc(var(--lx-border-width) + 1px) var(--lx-border-style)
          var(--lx-accent);
      }
      .test-item.fail {
        border-left: calc(var(--lx-border-width) + 1px) var(--lx-border-style)
          var(--lx-danger);
        background: color-mix(in srgb, var(--lx-danger) 5%, transparent);
      }
      .test-row {
        display: flex;
        align-items: center;
        gap: 0.45rem;
      }
      .test-badge {
        font-weight: 900;
        font-size: 0.75rem;
      }
      .test-item.pass .test-badge {
        color: var(--lx-accent);
      }
      .test-item.fail .test-badge {
        color: var(--lx-danger);
      }
      .test-name {
        color: var(--lx-text);
        font-weight: 700;
      }
      .test-error {
        margin: 0.3rem 0 0 1.2rem;
        font: 0.72rem var(--lx-font-mono, monospace);
        color: var(--lx-danger);
        white-space: pre-wrap;
      }
      .transcript {
        margin: 0;
        padding: 0.5rem;
        background: var(--lx-well);
        border: var(--lx-border-width) var(--lx-border-style)
          var(--lx-border-soft);
        border-radius: var(--lx-radius);
        color: var(--lx-code-text);
        font: 0.72rem var(--lx-font-mono, monospace);
        white-space: pre-wrap;
        box-shadow: var(--lx-shadow-inset);
      }
      .outcome-link {
        display: inline-flex;
        margin: 0 0 0.7rem;
        color: var(--lx-accent);
        font: var(--lx-btn-weight) 0.72rem/1.3 var(--lx-font-mono, monospace);
        letter-spacing: 0.04em;
        text-transform: var(--lx-btn-transform, uppercase);
      }
      @media (max-width: 680px) {
        .modal-backdrop {
          align-items: flex-start;
          padding: 0.5rem;
        }
        .modal-dialog {
          max-height: calc(100dvh - 1rem);
        }
        .modal-header {
          padding: 0.8rem;
        }
        .description-section {
          padding: 0.8rem;
        }
        .header-actions {
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        .btn-visit {
          max-width: 8.5rem;
          white-space: normal;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .modal-dialog,
        .btn-visit,
        .btn-close,
        .btn-hint-reveal,
        .btn-reset,
        .btn-run {
          animation: none;
          transition: none;
        }
      }
    `,
  ],
})
export class ChallengePlaygroundModalComponent implements OnInit, OnDestroy {
  @Input({ required: true }) challenge!: ChallengeListItem;
  @Input() trackId = '';
  @Output() close = new EventEmitter<void>();
  @Output() solved = new EventEmitter<string>();
  @Output() visitLesson = new EventEmitter<ChallengeListItem>();

  private readonly dataService = inject(LearningDataService);
  private readonly drafts = inject(CodeDraftStore);
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef<HTMLElement>);

  @ViewChild('closeButton')
  private readonly closeButton?: ElementRef<HTMLButtonElement>;
  @ViewChild('dialog')
  private readonly dialog?: ElementRef<HTMLElement>;

  code = '';
  diagnostics: Diagnostic[] = [];
  outcome: ModalOutcome | null = null;
  running = false;
  revealedHints = 0;
  private readonly isolatedBackground: Array<{
    element: HTMLElement;
    inert: string | null;
    ariaHidden: string | null;
  }> = [];

  get fileName(): string {
    return challengeFileName(this.challenge?.languageId ?? '');
  }

  get returnTo(): string {
    return addOfferingToLearningReturnTo(
      normalizeLearningReturnTo(this.router.url),
      this.challenge?.offeringId
    );
  }

  get isSolved(): boolean {
    return !!this.challenge?.solved || !!this.outcome?.passed;
  }

  ngOnInit(): void {
    this.isolateBackground();
    if (!this.challenge) return;
    const draft = this.drafts.read(this.challenge.id);
    this.code = draft !== null ? draft : this.challenge.starterCode || '';
  }

  ngOnDestroy(): void {
    for (const entry of this.isolatedBackground.reverse()) {
      if (entry.inert === null) {
        entry.element.removeAttribute('inert');
      } else {
        entry.element.setAttribute('inert', entry.inert);
      }
      if (entry.ariaHidden === null) {
        entry.element.removeAttribute('aria-hidden');
      } else {
        entry.element.setAttribute('aria-hidden', entry.ariaHidden);
      }
    }
    this.isolatedBackground.length = 0;
  }

  ngAfterViewInit(): void {
    queueMicrotask(() => this.closeButton?.nativeElement.focus());
  }

  private isolateBackground(): void {
    if (typeof document === 'undefined') return;

    const host = this.host.nativeElement;
    let branch: HTMLElement = host;
    const isolate = (element: Element): void => {
      if (!(element instanceof HTMLElement)) return;
      // An owner-managed drawer may already be inert while it is closed.
      // Leave that state alone so its owner can reopen it before focus
      // restoration rather than restoring a stale modal snapshot.
      if (element.hasAttribute('inert')) return;
      if (this.isolatedBackground.some((entry) => entry.element === element)) {
        return;
      }
      this.isolatedBackground.push({
        element,
        inert: element.getAttribute('inert'),
        ariaHidden: element.getAttribute('aria-hidden'),
      });
      element.setAttribute('inert', '');
      element.setAttribute('aria-hidden', 'true');
    };

    while (branch.parentElement) {
      const parent = branch.parentElement;
      for (const sibling of Array.from(parent.children)) {
        if (sibling !== branch) isolate(sibling);
      }
      if (parent === document.body) break;
      branch = parent;
    }
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(event: Event): void {
    event.preventDefault();
    this.close.emit();
  }

  @HostListener('keydown', ['$event'])
  onDialogKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      event.stopPropagation();
      if (!this.running) this.runCode();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = Array.from(
      this.dialog?.nativeElement.querySelectorAll<HTMLElement>(
        DIALOG_FOCUSABLE_SELECTOR
      ) ?? []
    );
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  onCodeChanged(newCode: string): void {
    this.code = newCode;
    if (this.challenge) {
      this.drafts.write(this.challenge.id, newCode);
    }
  }

  resetStarterCode(): void {
    if (this.challenge) {
      this.code = this.challenge.starterCode || '';
      this.drafts.write(this.challenge.id, this.code);
      this.diagnostics = [];
      this.outcome = null;
    }
  }

  revealNextHint(): void {
    if (
      this.challenge?.hints &&
      this.revealedHints < this.challenge.hints.length
    ) {
      this.revealedHints++;
    }
  }

  runCode(): void {
    if (!this.challenge || this.running) return;
    this.running = true;
    this.diagnostics = [];
    this.outcome = null;

    const request = this.challenge.offeringId
      ? this.dataService.submit(
          this.challenge.id,
          this.code,
          this.challenge.offeringId
        )
      : this.dataService.submit(this.challenge.id, this.code);
    request.subscribe({
      next: (res: SubmitResult) => {
        this.running = false;
        this.outcome = res;
        this.diagnostics = parseCompilerErrors(res.errors || []);

        if (res.passed) {
          this.challenge.solved = true;
          this.solved.emit(this.challenge.id);
        }
      },
      error: (err: unknown) => {
        this.running = false;
        if (err instanceof NotSignedInError) {
          this.outcome = {
            output: '',
            errors: ['Please sign in to run and record challenges.'],
            passed: false,
            needsSignIn: true,
          };
        } else if (err instanceof NotEnrolledError) {
          this.outcome = {
            output: '',
            errors: [
              'Please enroll in this course offering to submit solutions.',
            ],
            passed: false,
            needsEnrolmentIn: err.offeringId,
          };
        } else {
          const message =
            err instanceof Error ? err.message : 'Execution request failed';
          this.outcome = {
            output: '',
            errors: [message],
            passed: false,
          };
        }
      },
    });
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close.emit();
    }
  }

  onVisitLesson(): void {
    this.visitLesson.emit(this.challenge);
  }

  transcript(res: ModalOutcome): string {
    const parts: string[] = [];
    if (res.output && res.output.trim()) {
      parts.push(res.output.trim());
    }
    const errors = (res.errors ?? [])
      .filter((error) => error.trim())
      .join('\n');
    if (errors) {
      parts.push(`Errors:\n${errors}`);
    }
    return parts.join('\n');
  }
}

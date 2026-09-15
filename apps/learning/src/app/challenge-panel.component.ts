import {
  Component,
  DestroyRef,
  ElementRef,
  EventEmitter,
  HostListener,
  Injector,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
  afterNextRender,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ChallengeListItem,
  ChallengesResponse,
  LearningDataService,
} from './learning-data.service';
import { LearningAuthService } from './learning-auth.service';
import { ChallengePlaygroundModalComponent } from './challenge-playground-modal.component';
import { normalizeLearningReturnTo } from './route-return';

@Component({
  selector: 'learning-challenge-panel',
  standalone: true,
  imports: [RouterLink, ChallengePlaygroundModalComponent],
  template: `
    <div class="challenge-dock">
      <button
        type="button"
        #challengeToggle
        class="challenge-toggle"
        [attr.aria-expanded]="open()"
        [attr.inert]="selectedChallenge() ? '' : null"
        aria-controls="learning-challenges-panel"
        [attr.aria-label]="
          open() ? 'Close challenges panel' : 'Open challenges panel'
        "
        (click)="toggle()"
      >
        <span class="challenge-pull-tab" aria-hidden="true"></span>
        <span>Challenges</span>
        @if (response(); as loaded) {
        <span class="challenge-count" aria-label="available challenges">{{
          loaded.challenges.length
        }}</span>
        }
      </button>

      <aside
        #challengePanel
        id="learning-challenges-panel"
        class="challenge-panel"
        [class.is-open]="open()"
        [attr.aria-hidden]="!open()"
        [attr.inert]="open() ? null : ''"
        aria-labelledby="learning-challenges-heading"
      >
        <div class="challenge-panel-inner">
          <header class="challenge-panel-heading">
            <div>
              <p class="challenge-eyebrow">Practice bay</p>
              <h2 id="learning-challenges-heading">Challenges</h2>
            </div>
            <button
              type="button"
              class="challenge-dismiss"
              (click)="close(true)"
            >
              Close
            </button>
          </header>

          @if (loading()) {
          <div class="challenge-state" role="status" aria-live="polite">
            <span class="state-mark" aria-hidden="true">///</span>
            <strong>Loading challenges</strong>
            <p>Checking the practice board for available work.</p>
          </div>
          } @else if (error()) {
          <div class="challenge-state challenge-error" role="alert">
            <span class="state-mark" aria-hidden="true">!</span>
            <strong>Challenges could not be loaded</strong>
            <p>{{ error() }}</p>
            <button
              type="button"
              class="challenge-action challenge-retry"
              (click)="retry()"
            >
              Retry
            </button>
          </div>
          } @else if (response(); as loaded) { @if (loaded.challenges.length) {
          <div class="challenge-summary">
            <span>{{ loaded.trackDisplayName || 'Available practice' }}</span>
            <span>{{ loaded.challenges.length }} challenges</span>
          </div>
          <div class="challenge-list" aria-label="Available challenges">
            @for (challenge of loaded.challenges; track challenge.id) {
            <button
              type="button"
              class="challenge-card"
              [attr.data-challenge-id]="challenge.id"
              [class.is-solved]="challenge.solved"
              (click)="selectChallenge(challenge)"
              (keydown.enter)="
                $event.preventDefault(); selectChallenge(challenge)
              "
              (keydown.space)="
                $event.preventDefault(); selectChallenge(challenge)
              "
            >
              <span class="challenge-card-topline">
                <span class="challenge-track">{{
                  challenge.trackDisplayName
                }}</span>
                @if (challenge.solved) {
                <span class="challenge-solved">Solved</span>
                }
              </span>
              <span class="challenge-card-title">{{ challenge.title }}</span>
              <span class="challenge-card-lesson">{{
                challenge.lessonTitle
              }}</span>
              <span class="challenge-card-description">{{
                challenge.description
              }}</span>
              <span class="challenge-card-meta">
                <span>{{ challenge.difficulty }}</span>
                <span>{{ challenge.points }} pts</span>
                <span class="challenge-open">Open&nbsp;→</span>
              </span>
            </button>
            }
          </div>
          } @else {
          <div class="challenge-state challenge-empty">
            <span class="state-mark" aria-hidden="true">∅</span>
            <strong>No challenges unlocked yet</strong>
            @if (loaded.enrolledCount > 0) {
            <p>
              Published courses will add practice here as their challenges go
              live.
            </p>
            } @else {
            <p>
              Enrol in a course to unlock practice. You can browse every
              published course without signing in.
            </p>
            <div class="challenge-state-actions">
              <a
                class="challenge-action"
                routerLink="/courses"
                (click)="close()"
                >Browse courses</a
              >
              @if (!person()) {
              <a
                class="challenge-action challenge-action-secondary"
                routerLink="/sign-in"
                [queryParams]="{ returnTo: currentPath }"
                (click)="close()"
                >Sign in</a
              >
              }
            </div>
            }
          </div>
          } }
        </div>
      </aside>

      @if (selectedChallenge(); as challenge) {
      <learning-playground-modal
        [challenge]="challenge"
        (close)="closeModal()"
        (solved)="markSolved($event)"
        (visitLesson)="visitLesson($event)"
      ></learning-playground-modal>
      }
    </div>
  `,
  styles: [
    `
      .challenge-dock {
        position: relative;
        display: inline-flex;
      }
      .challenge-toggle {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        min-height: 2.35rem;
        padding: 0.45rem 0.7rem;
        border: var(--lx-border-width) var(--lx-border-style)
          var(--lx-border-soft);
        border-radius: var(--lx-radius);
        background: var(--lx-surface);
        color: var(--lx-text);
        font: var(--lx-btn-weight) 0.7rem/1 var(--lx-font-mono, monospace);
        letter-spacing: 0.08em;
        text-transform: var(--lx-btn-transform, uppercase);
        box-shadow: var(--lx-shadow-sm);
        cursor: pointer;
        transition: var(--lx-btn-transition);
      }
      .challenge-pull-tab {
        display: block;
        width: 0.9rem;
        height: 0.35rem;
        border: var(--lx-border-width) var(--lx-border-style) currentColor;
        border-bottom: 0;
        transform: translateY(-0.15rem);
      }
      .challenge-count {
        display: inline-grid;
        min-width: 1.25rem;
        min-height: 1.25rem;
        place-items: center;
        padding: 0 0.2rem;
        border: var(--lx-border-width) var(--lx-border-style) currentColor;
        border-radius: 999px;
        font-size: 0.62rem;
        line-height: 1;
      }
      .challenge-toggle:hover {
        border-color: var(--lx-accent);
        background: var(--lx-surface-hover);
      }
      .challenge-toggle:active,
      .challenge-toggle[aria-expanded='true'] {
        transform: translate(1px, 1px);
        background: var(--lx-accent);
        color: var(--lx-bg);
        box-shadow: var(--lx-shadow-inset);
      }
      .challenge-toggle:focus-visible,
      .challenge-dismiss:focus-visible,
      .challenge-action:focus-visible,
      .challenge-card:focus-visible {
        outline: var(--lx-border-width) solid var(--lx-focus);
        outline-offset: 2px;
      }
      .challenge-panel {
        position: absolute;
        z-index: 120;
        top: calc(100% + 0.55rem);
        right: 0;
        width: min(35rem, calc(100vw - 1rem));
        max-height: min(38rem, calc(100dvh - 5.25rem));
        overflow: hidden;
        visibility: hidden;
        opacity: 0;
        transform: translateY(-0.5rem);
        border: 0 var(--lx-border-style) var(--lx-border-soft);
        border-radius: var(--lx-radius);
        background-color: var(--lx-surface);
        background-image: var(--lx-surface-texture);
        color: var(--lx-text-body);
        box-shadow: none;
        pointer-events: none;
        transition: var(--lx-btn-transition);
      }
      .challenge-panel.is-open {
        visibility: visible;
        opacity: 1;
        transform: translateY(0);
        border-width: var(--lx-border-width);
        box-shadow: var(--lx-shadow-card);
        pointer-events: auto;
        transition-delay: 0s;
      }
      .challenge-panel-inner {
        max-height: min(38rem, calc(100dvh - 5.25rem));
        overflow-y: auto;
        overscroll-behavior: contain;
        padding: 1rem;
      }
      .challenge-panel-heading {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1rem;
        padding-bottom: 0.85rem;
        border-bottom: var(--lx-border-width) var(--lx-border-style)
          var(--lx-border-soft);
      }
      .challenge-eyebrow {
        margin: 0 0 0.25rem;
        color: var(--lx-accent);
        font: var(--lx-btn-weight) 0.65rem/1 var(--lx-font-mono, monospace);
        letter-spacing: 0.12em;
        text-transform: var(--lx-btn-transform, uppercase);
      }
      .challenge-panel h2 {
        margin: 0;
        color: var(--lx-text);
        font: var(--lx-btn-weight) 1.35rem/1 var(--lx-font-heading, inherit);
      }
      .challenge-dismiss {
        padding: 0.4rem 0.55rem;
        border: var(--lx-border-width) var(--lx-border-style) transparent;
        border-radius: var(--lx-radius);
        background: transparent;
        color: var(--lx-text-muted);
        font: var(--lx-btn-weight) 0.68rem/1 var(--lx-font-mono, monospace);
        letter-spacing: 0.05em;
        text-transform: var(--lx-btn-transform, uppercase);
        cursor: pointer;
        transition: var(--lx-btn-transition);
      }
      .challenge-dismiss:hover {
        border-color: var(--lx-border-soft);
        color: var(--lx-text);
        background: var(--lx-surface-hover);
      }
      .challenge-summary {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        padding: 0.85rem 0 0.55rem;
        color: var(--lx-text-subtle);
        font: 0.68rem/1.2 var(--lx-font-mono, monospace);
        letter-spacing: 0.06em;
        text-transform: var(--lx-btn-transform, uppercase);
      }
      .challenge-list {
        display: grid;
        gap: 0.6rem;
      }
      .challenge-card {
        display: grid;
        gap: 0.42rem;
        width: 100%;
        padding: 0.85rem;
        border: var(--lx-border-width) var(--lx-border-style)
          var(--lx-border-soft);
        border-radius: var(--lx-radius);
        background-color: var(--lx-well);
        background-image: var(--lx-surface-texture);
        color: var(--lx-text-body);
        text-align: left;
        box-shadow: var(--lx-shadow-sm);
        cursor: pointer;
        transition: var(--lx-btn-transition);
      }
      .challenge-card:hover,
      .challenge-card:focus-visible {
        border-color: var(--lx-accent);
        background-color: var(--lx-surface-hover);
        box-shadow: var(--lx-shadow-control);
        transform: translateY(-1px);
      }
      .challenge-card:active {
        transform: translate(1px, 1px);
        box-shadow: var(--lx-shadow-inset);
      }
      .challenge-card.is-solved {
        border-color: var(--lx-accent);
      }
      .challenge-card-topline,
      .challenge-card-meta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
      }
      .challenge-track,
      .challenge-card-meta,
      .challenge-solved {
        color: var(--lx-text-subtle);
        font: var(--lx-btn-weight) 0.64rem/1.2 var(--lx-font-mono, monospace);
        letter-spacing: 0.06em;
        text-transform: var(--lx-btn-transform, uppercase);
      }
      .challenge-solved {
        color: var(--lx-accent);
      }
      .challenge-card-title {
        color: var(--lx-text);
        font: var(--lx-btn-weight) 1rem/1.2 var(--lx-font-heading, inherit);
      }
      .challenge-card-lesson {
        color: var(--lx-text-muted);
        font-size: 0.78rem;
      }
      .challenge-card-description {
        display: -webkit-box;
        overflow: hidden;
        color: var(--lx-text-muted);
        font-size: 0.78rem;
        line-height: 1.45;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
      }
      .challenge-card-meta {
        justify-content: flex-start;
        color: var(--lx-text-subtle);
      }
      .challenge-open {
        margin-left: auto;
        color: var(--lx-accent);
      }
      .challenge-state {
        display: grid;
        gap: 0.5rem;
        justify-items: start;
        padding: 2rem 1rem 1rem;
      }
      .challenge-state strong {
        color: var(--lx-text);
        font: var(--lx-btn-weight) 0.9rem/1.3 var(--lx-font-heading, inherit);
      }
      .challenge-state p {
        max-width: 42ch;
        margin: 0;
        color: var(--lx-text-muted);
        font-size: 0.82rem;
        line-height: 1.55;
      }
      .state-mark {
        color: var(--lx-accent);
        font: var(--lx-btn-weight) 1rem/1 var(--lx-font-mono, monospace);
      }
      .challenge-error .state-mark {
        color: var(--lx-danger);
      }
      .challenge-action {
        display: inline-flex;
        align-items: center;
        min-height: 2.4rem;
        padding: 0.55rem 0.8rem;
        border: var(--lx-border-width) var(--lx-border-style) var(--lx-accent);
        border-radius: var(--lx-radius);
        background: var(--lx-accent);
        color: var(--lx-bg);
        box-shadow: var(--lx-shadow-control);
        font: var(--lx-btn-weight) 0.68rem/1 var(--lx-font-mono, monospace);
        letter-spacing: 0.06em;
        text-decoration: none;
        text-transform: var(--lx-btn-transform, uppercase);
        cursor: pointer;
        transition: var(--lx-btn-transition);
      }
      .challenge-action:hover {
        box-shadow: var(--lx-shadow-card);
      }
      .challenge-action:active {
        transform: translate(1px, 1px);
        box-shadow: var(--lx-shadow-inset);
      }
      .challenge-state-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.55rem;
      }
      .challenge-action-secondary {
        border-color: var(--lx-border-strong);
        background: var(--lx-surface-hover);
        color: var(--lx-text);
        box-shadow: var(--lx-shadow-sm);
      }
      @media (max-width: 760px) {
        .challenge-panel {
          position: fixed;
          top: calc(var(--learning-topbar-height, 4.25rem) + 0.55rem);
          right: 0.5rem;
          left: 0.5rem;
          width: auto;
          max-width: none;
          box-sizing: border-box;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .challenge-panel,
        .challenge-card,
        .challenge-toggle,
        .challenge-action,
        .challenge-dismiss {
          transition: none;
        }
      }
    `,
  ],
})
export class ChallengePanelComponent implements OnChanges {
  @Input() trackId = '';
  @Output() opened = new EventEmitter<void>();

  @ViewChild('challengeToggle')
  private readonly challengeToggle?: ElementRef<HTMLButtonElement>;
  @ViewChild('challengePanel')
  private readonly challengePanel?: ElementRef<HTMLElement>;

  readonly open = signal(false);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly response = signal<ChallengesResponse | null>(null);
  readonly selectedChallenge = signal<ChallengeListItem | null>(null);

  private readonly data = inject(LearningDataService);
  private readonly auth = inject(LearningAuthService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private hasLoaded = false;
  private focusAfterCloseId: string | null = null;
  private cancelFocusRestore: (() => void) | null = null;
  readonly person = toSignal(this.auth.me(), { initialValue: null });

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['trackId'] || changes['trackId'].firstChange) return;
    this.hasLoaded = false;
    this.response.set(null);
    this.error.set('');
    if (this.open()) this.load();
  }

  get currentPath(): string {
    return normalizeLearningReturnTo(this.router.url);
  }

  toggle(): void {
    if (this.open()) {
      this.close(true);
    } else {
      this.openPanel();
    }
  }

  openPanel(): void {
    this.open.set(true);
    this.opened.emit();
    if (!this.hasLoaded) this.load();
  }

  close(restoreFocus = false): void {
    const wasOpen = this.open();
    this.open.set(false);
    if (restoreFocus && wasOpen) {
      this.challengeToggle?.nativeElement.focus();
    }
  }

  retry(): void {
    this.load();
  }

  selectChallenge(challenge: ChallengeListItem): void {
    this.focusAfterCloseId = challenge.id;
    this.close();
    this.selectedChallenge.set(challenge);
  }

  closeModal(): void {
    const restoreId = this.focusAfterCloseId;
    this.cancelFocusRestore?.();
    const panel = this.challengePanel?.nativeElement;
    const transitionDuration = panel
      ? getComputedStyle(panel).transitionDuration
      : '';
    const waitForTransition = transitionDuration
      .split(',')
      .some((duration) => parseFloat(duration) > 0);
    this.restoreFocusAfterDrawerTransition(restoreId, waitForTransition);
    this.selectedChallenge.set(null);
    this.open.set(true);
  }

  markSolved(id: string): void {
    this.response.update((current) =>
      current
        ? {
            ...current,
            challenges: current.challenges.map((challenge) =>
              challenge.id === id ? { ...challenge, solved: true } : challenge
            ),
          }
        : current
    );
  }

  visitLesson(challenge: ChallengeListItem): void {
    this.closeModal();
    this.router.navigate(
      ['/module', challenge.trackId, challenge.moduleId, challenge.lessonId],
      challenge.offeringId
        ? { queryParams: { offeringId: challenge.offeringId } }
        : undefined
    );
  }

  @HostListener('document:keydown.escape', ['$event'])
  handleEscape(event: Event): void {
    if (event.defaultPrevented || this.selectedChallenge()) return;
    if (this.open()) this.close(true);
  }

  private load(): void {
    this.loading.set(true);
    this.error.set('');
    this.data
      .challenges(this.trackId || undefined)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.hasLoaded = true;
          this.response.set(response);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set(
            'The practice service did not answer. Check your connection and try again.'
          );
        },
      });
  }

  private restoreFocusAfterDrawerTransition(
    challengeId: string | null,
    waitForTransition: boolean
  ): void {
    const panel = this.challengePanel?.nativeElement;
    if (!panel) {
      this.challengeToggle?.nativeElement.focus();
      return;
    }

    let completed = false;
    const cleanup = () => {
      panel.removeEventListener('transitionend', onTransitionEnd);
      this.cancelFocusRestore = null;
    };
    const restore = () => {
      if (completed) return;
      completed = true;
      cleanup();
      const card = Array.from(
        panel.querySelectorAll<HTMLElement>('[data-challenge-id]')
      ).find(
        (candidate) =>
          candidate.getAttribute('data-challenge-id') === challengeId
      );
      if (card?.isConnected && !card.closest('[inert]')) {
        card.focus();
      } else {
        this.challengeToggle?.nativeElement.focus();
      }
      this.focusAfterCloseId = null;
    };
    const onTransitionEnd = (event: TransitionEvent) => {
      if (
        event.target === panel &&
        (event.propertyName === 'opacity' ||
          event.propertyName === 'visibility')
      ) {
        const styles = getComputedStyle(panel);
        if (styles.visibility !== 'hidden' && styles.opacity !== '0') {
          restore();
        }
      }
    };

    this.cancelFocusRestore = cleanup;
    panel.addEventListener('transitionend', onTransitionEnd);
    if (waitForTransition) return;
    afterNextRender(
      () => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const styles = getComputedStyle(panel);
            if (styles.visibility !== 'hidden' && styles.opacity !== '0') {
              restore();
            }
          });
        });
      },
      { injector: this.injector }
    );
  }
}

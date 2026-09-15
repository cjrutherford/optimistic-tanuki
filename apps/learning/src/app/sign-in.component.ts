import { Component, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import {
  LoginBlockComponent,
  RegisterBlockComponent,
} from '@optimistic-tanuki/auth-ui';
import { LoginType, RegisterSubmitType } from '@optimistic-tanuki/ui-models';
import { LearningLayoutComponent } from './learning-layout.component';
import { LearningAuthService } from './learning-auth.service';
import { normalizeLearningReturnTo } from './route-return';
export { normalizeLearningReturnTo };

/**
 * Signing in, and signing up.
 *
 * Reading stays open to everyone, so this is a destination rather than a
 * gate in front of the app. The account panel keeps the existing local review
 * auth flow in a presentation that makes the two paths easy to compare.
 */
@Component({
  selector: 'learning-sign-in',
  imports: [
    LearningLayoutComponent,
    LoginBlockComponent,
    RegisterBlockComponent,
  ],
  template: `<learning-layout>
    <div class="auth-page">
      <a [href]="safeReturnTo()" class="back">{{ backLabel() }}</a>

      <section
        class="auth-shell"
        aria-labelledby="auth-title"
        [attr.aria-busy]="pending()"
      >
        <header class="auth-header">
          <p class="eyebrow">Account / local review access</p>
          <h1 id="auth-title">
            {{ mode() === 'sign-in' ? 'Welcome back.' : 'Create an account.' }}
          </h1>
          <p class="lede">
            Reading is open to everyone. An account is for enrolling, keeping
            your progress, submitting work, and writing courses of your own.
          </p>
        </header>

        <div class="auth-tabs" role="tablist" aria-label="Account access">
          <button
            id="sign-in-tab"
            type="button"
            role="tab"
            aria-controls="sign-in-panel"
            [attr.aria-selected]="mode() === 'sign-in'"
            [class.active]="mode() === 'sign-in'"
            (click)="setMode('sign-in')"
          >
            Sign in
          </button>
          <button
            id="register-tab"
            type="button"
            role="tab"
            aria-controls="register-panel"
            [attr.aria-selected]="mode() === 'register'"
            [class.active]="mode() === 'register'"
            (click)="setMode('register')"
          >
            Register
          </button>
        </div>

        <div class="auth-workspace">
          @if (pending()) {
          <p class="busy-note" role="status" aria-live="polite">
            <span aria-hidden="true">///</span>
            {{
              mode() === 'sign-in'
                ? 'Checking your details…'
                : 'Creating your account…'
            }}
          </p>
          } @if (mode() === 'sign-in') {
          <section
            id="sign-in-panel"
            role="tabpanel"
            aria-labelledby="sign-in-tab"
          >
            <lib-login-block
              appId="learning"
              title="Welcome back"
              description="Sign in to enrol, keep your progress, and write courses of your own."
              [showHero]="false"
              [showOAuth]="false"
              [returnPath]="returnTo()"
              [pending]="pending()"
              [errorMessage]="error()"
              (submitEvent)="signIn($event)"
            ></lib-login-block>
            <p class="switch">
              No account yet?
              <button type="button" (click)="setMode('register')">
                Create one
              </button>
            </p>
          </section>
          } @else {
          <section
            id="register-panel"
            role="tabpanel"
            aria-labelledby="register-tab"
          >
            <lib-register-block
              registerHeader="Create an account"
              callToAction="Reading is open to everyone. An account is for keeping your progress and writing courses."
              [showHero]="false"
              [showOAuth]="false"
              [pending]="pending()"
              [errorMessage]="error()"
              (submitEvent)="register($event)"
            ></lib-register-block>
            <p class="switch">
              Already have one?
              <button type="button" (click)="setMode('sign-in')">
                Sign in
              </button>
            </p>
          </section>
          }
        </div>
      </section>
    </div>
  </learning-layout>`,
  styles: [
    `
      .auth-page {
        width: min(100%, 48rem);
        margin: 0 auto;
        padding: 0.25rem 0 3rem;
      }
      .back {
        display: inline-block;
        margin-bottom: 1rem;
        color: var(--lx-text-muted);
        font: var(--lx-btn-weight, 800) 0.72rem var(--lx-font-mono, monospace);
        letter-spacing: 0.04em;
        text-decoration: none;
        text-transform: var(--lx-btn-transform, uppercase);
        transition: var(--lx-btn-transition);
      }
      .back:hover {
        color: var(--lx-text);
      }
      .back:focus-visible {
        outline: var(--lx-border-width) solid var(--lx-focus);
        outline-offset: 3px;
      }
      .auth-shell {
        overflow: hidden;
        border: var(--lx-border-width) var(--lx-border-style)
          var(--lx-border-strong);
        border-radius: var(--lx-radius);
        background-color: var(--lx-surface);
        background-image: var(--lx-surface-texture);
        box-shadow: var(--lx-shadow-card);
      }
      .auth-header {
        padding: clamp(1.25rem, 4vw, 2.25rem);
        border-bottom: var(--lx-border-width) var(--lx-border-style)
          var(--lx-border-soft);
      }
      .eyebrow {
        margin: 0;
        color: var(--lx-accent);
        font: var(--lx-btn-weight, 800) 0.68rem var(--lx-font-mono, monospace);
        letter-spacing: 0.12em;
        text-transform: var(--lx-btn-transform, uppercase);
      }
      h1 {
        margin: 0.65rem 0 0.8rem;
        font-family: var(--lx-font-heading);
        font-size: clamp(2rem, 4vw, 3rem);
        line-height: 1.02;
        letter-spacing: -0.045em;
      }
      .lede {
        max-width: 54ch;
        margin: 0;
        color: var(--lx-text-muted);
        line-height: 1.65;
      }
      .auth-tabs {
        display: flex;
        gap: 0.35rem;
        padding: 0.7rem clamp(1rem, 3vw, 1.5rem) 0;
        border-bottom: var(--lx-border-width) var(--lx-border-style)
          var(--lx-border-soft);
      }
      .auth-tabs button {
        min-height: 2.75rem;
        padding: 0.65rem 0.9rem;
        border: var(--lx-border-width) var(--lx-border-style) transparent;
        border-bottom: 0;
        border-radius: var(--lx-radius) var(--lx-radius) 0 0;
        background: transparent;
        color: var(--lx-text-muted);
        font: var(--lx-btn-weight, 800) 0.72rem var(--lx-font-mono, monospace);
        letter-spacing: 0.08em;
        text-transform: var(--lx-btn-transform, uppercase);
        cursor: pointer;
        transition: var(--lx-btn-transition);
      }
      .auth-tabs button:hover {
        background: var(--lx-surface-hover);
        color: var(--lx-text);
      }
      .auth-tabs button.active {
        border-color: var(--lx-accent);
        background: var(--lx-surface-active);
        color: var(--lx-text);
        box-shadow: var(--lx-shadow-sm);
      }
      .auth-tabs button:focus-visible {
        outline: var(--lx-border-width) solid var(--lx-focus);
        outline-offset: -2px;
      }
      .auth-workspace {
        min-width: 0;
        padding: clamp(1rem, 3vw, 1.5rem);
        background: color-mix(in srgb, var(--lx-bg) 54%, transparent);
      }
      .busy-note {
        display: flex;
        align-items: center;
        gap: 0.55rem;
        margin: 0 0 1rem;
        padding: 0.65rem 0.75rem;
        border-left: calc(var(--lx-border-width) + 1px) var(--lx-border-style)
          var(--lx-accent);
        background: var(--lx-surface-active);
        color: var(--lx-text);
        font: var(--lx-btn-weight, 800) 0.68rem var(--lx-font-mono, monospace);
        letter-spacing: 0.04em;
        text-transform: var(--lx-btn-transform, uppercase);
      }
      .busy-note span {
        color: var(--lx-accent);
      }
      lib-login-block,
      lib-register-block {
        display: block;
        min-width: 0;
        --background: var(--lx-well);
        --foreground: var(--lx-text);
        --primary: var(--lx-accent);
        --complementary: var(--lx-border-strong);
        --error: var(--lx-danger);
        --border-radius-lg: var(--lx-radius);
        --border-radius-sm: var(--lx-radius);
        --gradient-border: var(--lx-accent);
      }
      .switch {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.6rem;
        margin: 1rem 0 0;
        color: var(--lx-text-muted);
        font-size: 0.9rem;
      }
      .switch button {
        min-height: 2.4rem;
        padding: 0.5rem 0.7rem;
        border: var(--lx-border-width) var(--lx-border-style)
          var(--lx-border-soft);
        border-radius: var(--lx-radius);
        background: var(--lx-surface);
        color: var(--lx-accent);
        font: var(--lx-btn-weight, 800) 0.7rem var(--lx-font-mono, monospace);
        letter-spacing: 0.04em;
        text-transform: var(--lx-btn-transform, uppercase);
        cursor: pointer;
        box-shadow: var(--lx-shadow-sm);
        transition: var(--lx-btn-transition);
      }
      .switch button:hover {
        background: var(--lx-surface-hover);
        border-color: var(--lx-accent);
      }
      .switch button:active {
        transform: translate(1px, 1px);
        box-shadow: var(--lx-shadow-inset);
      }
      .switch button:focus-visible {
        outline: var(--lx-border-width) solid var(--lx-focus);
        outline-offset: 2px;
      }
      @media (max-width: 480px) {
        .auth-page {
          padding-bottom: 2rem;
        }
        .auth-header {
          padding: 1.15rem;
        }
        .auth-workspace {
          padding: 0.75rem;
        }
        .auth-tabs {
          padding-inline: 0.75rem;
        }
        .auth-tabs button {
          flex: 1 1 0;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .back,
        .auth-tabs button,
        .switch button {
          transition: none;
        }
      }
    `,
  ],
})
export class SignInComponent {
  private readonly auth = inject(LearningAuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly sanitizer = inject(DomSanitizer);

  /**
   * Where to put somebody back when they are done.
   *
   * Only a path on this site is accepted. Taking the parameter at face value
   * would let a link off the site be handed to a person who has just typed a
   * password, which is the standard shape of an open redirect.
   */
  readonly returnTo = computed(() =>
    normalizeLearningReturnTo(this.returnToParam())
  );
  readonly safeReturnTo = computed<SafeUrl>(() =>
    this.sanitizer.bypassSecurityTrustUrl(this.returnTo())
  );

  readonly backLabel = computed(() =>
    this.returnTo() === '/courses' ? '← Catalog' : '← Back'
  );

  private readonly returnToParam = toSignal(
    this.route.queryParamMap.pipe(
      map((params) => params.get('returnTo') ?? '')
    ),
    {
      initialValue: this.route.snapshot.queryParamMap.get('returnTo') ?? '',
    }
  );

  readonly mode = signal<'sign-in' | 'register'>('sign-in');
  readonly pending = signal(false);
  readonly error = signal('');

  setMode(mode: 'sign-in' | 'register'): void {
    if (this.pending()) return;
    this.error.set('');
    this.mode.set(mode);
  }

  signIn(credentials: LoginType): void {
    this.pending.set(true);
    this.error.set('');
    this.auth.login(credentials.email, credentials.password).subscribe({
      next: () => this.done(),
      error: (failure: { status?: number }) => {
        this.pending.set(false);
        this.error.set(
          failure?.status === 401 || failure?.status === 500
            ? 'That email and password do not match an account.'
            : 'Could not sign in just now. Try again.'
        );
      },
    });
  }

  register(input: RegisterSubmitType): void {
    this.pending.set(true);
    this.error.set('');
    this.auth.register(input).subscribe({
      // Registering does not sign anyone in, so this signs them in with what
      // they just typed rather than asking for it a second time.
      next: () => this.signIn({ email: input.email, password: input.password }),
      error: (failure: { status?: number; error?: { message?: string } }) => {
        this.pending.set(false);
        this.error.set(
          failure?.status === 409
            ? 'There is already an account with that email.'
            : failure?.error?.message ??
                'Could not create the account. Try again.'
        );
      },
    });
  }

  private done(): void {
    this.pending.set(false);
    // Back where they were if that is known, and otherwise the catalog rather
    // than the landing page: somebody who has just signed in has already been
    // sold, and sending them back to the pitch would be making the argument
    // twice.
    this.router.navigateByUrl(this.returnTo());
  }
}

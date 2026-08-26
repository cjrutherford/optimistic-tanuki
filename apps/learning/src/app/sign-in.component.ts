import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  LoginBlockComponent,
  RegisterBlockComponent,
} from '@optimistic-tanuki/auth-ui';
import { LoginType, RegisterSubmitType } from '@optimistic-tanuki/ui-models';
import { LearningLayoutComponent } from './learning-layout.component';
import { LearningAuthService } from './learning-auth.service';

/**
 * Signing in, and signing up.
 *
 * The app told people to sign in from three different places and had nowhere
 * for them to do it: enrolling, saving progress and writing a course all need
 * a session, and none of them could be reached.
 *
 * Reading stays open to everyone, so this is a destination rather than a gate
 * in front of the app.
 */
@Component({
  selector: 'learning-sign-in',
  imports: [
    LearningLayoutComponent,
    LoginBlockComponent,
    RegisterBlockComponent,
    RouterLink,
  ],
  template: `<learning-layout>
    <a routerLink="/courses" class="back">← Catalog</a>

    <header>
      <p class="eyebrow">Account</p>
      <h1>
        {{ mode() === 'sign-in' ? 'Welcome back.' : 'Create an account.' }}
      </h1>
      <p class="lede">
        Reading is open to everyone. An account is for enrolling, keeping your
        progress, and writing courses of your own.
      </p>
    </header>

    @if (mode() === 'sign-in') {
    <lib-login-block
      appId="learning"
      title="Welcome back"
      description="Sign in to enrol, keep your progress, and write courses of your own."
      [showHero]="false"
      [showOAuth]="false"
      [pending]="pending()"
      [errorMessage]="error()"
      (submitEvent)="signIn($event)"
    ></lib-login-block>
    <p class="switch">
      No account yet?
      <button type="button" (click)="mode.set('register')">Create one</button>
    </p>
    } @else {
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
      <button type="button" (click)="mode.set('sign-in')">Sign in</button>
    </p>
    }
  </learning-layout>`,
  styles: [
    `
      .back {
        display: inline-block;
        margin-bottom: 1.25rem;
        color: var(--lx-text-muted);
        font-size: 0.85rem;
        text-decoration: none;
      }
      .eyebrow {
        margin: 0;
        color: var(--lx-accent);
        font: 700 0.7rem var(--lx-font-mono, ui-monospace, monospace);
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }
      h1 {
        margin: 0.6rem 0;
        font-size: clamp(2rem, 4vw, 3rem);
        line-height: 1;
        letter-spacing: -0.045em;
      }
      .lede {
        max-width: 52ch;
        margin: 0 0 2rem;
        color: var(--lx-text-muted);
      }
      .switch {
        margin-top: 1.25rem;
        color: var(--lx-text-muted);
        font-size: 0.9rem;
      }
      .switch button {
        border: 0;
        background: transparent;
        color: var(--lx-accent);
        font: inherit;
        text-decoration: underline;
        cursor: pointer;
      }
    `,
  ],
})
export class SignInComponent {
  private readonly auth = inject(LearningAuthService);
  private readonly router = inject(Router);

  readonly mode = signal<'sign-in' | 'register'>('sign-in');
  readonly pending = signal(false);
  readonly error = signal('');

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
    // The catalog rather than the landing page: somebody who has just signed
    // in has already been sold, and sending them back to the pitch would be
    // making the argument twice.
    this.router.navigateByUrl('/courses');
  }
}

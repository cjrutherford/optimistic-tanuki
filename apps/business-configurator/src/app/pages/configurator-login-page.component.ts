import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { normalizeAuthReturnTo } from '@optimistic-tanuki/auth-ui';
import { AuthStateService } from '../state/auth-state.service';
import { ReturnIntentService } from '../state/return-intent.service';

const CONFIGURATOR_FALLBACK = '/';
const SERVER_ORIGIN = 'http://business-configurator.invalid';

function currentOrigin(): string {
  return typeof window !== 'undefined' && window.location.origin
    ? window.location.origin
    : SERVER_ORIGIN;
}

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <main class="auth-page" aria-labelledby="configurator-login-heading">
      <section class="auth-card">
        <p class="eyebrow">Configurator workspace</p>
        <h1 id="configurator-login-heading">Sign in to continue.</h1>
        <p>
          Sign in with your owner account to return to your workspace and its
          authoring tools.
        </p>
        <form (ngSubmit)="signIn()">
          <label>
            Email
            <input
              type="email"
              name="email"
              [(ngModel)]="email"
              autocomplete="username"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              name="password"
              [(ngModel)]="password"
              autocomplete="current-password"
              required
            />
          </label>
          @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
          }
          <button type="submit" [disabled]="loading()">
            {{ loading() ? 'Signing in…' : 'Sign in' }}
          </button>
        </form>
      </section>
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .auth-page {
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 1.5rem;
        color: var(--config-shell-foreground);
        background: var(--config-shell-bg-1);
      }
      .auth-card {
        width: min(100%, 30rem);
        padding: clamp(1.5rem, 4vw, 2.5rem);
        border: 1px solid
          color-mix(in srgb, var(--config-brand-gradient-from) 32%, transparent);
        background: var(--config-shell-bg-2);
        box-shadow: 0 1.5rem 3rem rgba(0, 0, 0, 0.2);
      }
      .eyebrow {
        margin: 0 0 0.75rem;
        color: var(--config-brand-gradient-from);
        font: 700 0.72rem/1.2 ui-monospace, SFMono-Regular, monospace;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
      h1 {
        margin: 0;
        font: 600 clamp(2.3rem, 7vw, 4rem) / 0.95 Georgia, serif;
        letter-spacing: -0.055em;
      }
      form {
        display: grid;
        gap: 1rem;
        margin-top: 1.5rem;
      }
      label {
        display: grid;
        gap: 0.4rem;
        font-weight: 700;
      }
      input {
        width: 100%;
        padding: 0.7rem 0.8rem;
        border: 1px solid
          color-mix(in srgb, var(--config-shell-foreground) 25%, transparent);
        color: inherit;
        background: transparent;
        font: inherit;
      }
      button {
        justify-self: start;
        border: 0;
        padding: 0.7rem 1rem;
        color: var(--config-brand-foreground);
        background: var(--config-brand-gradient-from);
        font-weight: 700;
        cursor: pointer;
      }
      button:disabled {
        opacity: 0.65;
        cursor: wait;
      }
      .error {
        margin: 0;
        color: var(--danger);
      }
    `,
  ],
})
export class ConfiguratorLoginPageComponent {
  private readonly auth = inject(AuthStateService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly returnIntent = inject(ReturnIntentService);

  email = '';
  password = '';
  readonly loading = signal(false);
  readonly error = signal('');

  signIn(): void {
    if (!this.email || !this.password) {
      return;
    }

    this.loading.set(true);
    this.error.set('');
    void this.auth
      .login({ email: this.email, password: this.password })
      .then(() => this.router.navigateByUrl(this.safeReturnUrl()))
      .catch(() =>
        this.error.set(
          'We could not sign you in. Check your details and try again.'
        )
      )
      .finally(() => this.loading.set(false));
  }

  private safeReturnUrl(): string {
    const storedReturnUrl = this.returnIntent.consume();
    const storedTarget = normalizeAuthReturnTo(storedReturnUrl, {
      currentOrigin: currentOrigin(),
    });
    if (storedTarget?.isCurrentOrigin) {
      return storedTarget.path;
    }

    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    const returnTarget = normalizeAuthReturnTo(returnUrl, {
      currentOrigin: currentOrigin(),
    });
    return returnTarget?.isCurrentOrigin
      ? returnTarget.path
      : CONFIGURATOR_FALLBACK;
  }
}

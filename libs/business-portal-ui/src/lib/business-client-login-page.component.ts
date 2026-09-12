import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  BusinessAuthService,
  injectSiteSlugSignal,
  normalizeBusinessReturnTo,
} from '@optimistic-tanuki/business-data-access';
import { ButtonComponent, CardComponent } from '@optimistic-tanuki/common-ui';
import { EmailAuthClientService } from '@optimistic-tanuki/auth-ui';

const CLIENT_AUTH_LOOP_PATHS = new Set([
  '/auth',
  '/login',
  '/register',
  '/owner/login',
  '/owner/register',
  '/client/login',
  '/client/register',
]);

function pathFromReturnUrl(returnUrl: string): string | null {
  try {
    return (
      decodeURIComponent(
        new URL(returnUrl, 'https://business-site.invalid').pathname
      ).replace(/\/+$/, '') || '/'
    );
  } catch {
    return null;
  }
}

function isSafeClientReturnUrl(
  returnUrl: string | null,
  siteSlug: string | null
): returnUrl is string {
  if (!returnUrl) return false;

  const path = pathFromReturnUrl(returnUrl);
  const clientPrefix = siteSlug ? `/sites/${siteSlug}/client` : '/client';

  return (
    !!path &&
    !CLIENT_AUTH_LOOP_PATHS.has(path) &&
    !/^\/sites\/[^/]+\/(?:owner|client)\/(?:login|register)$/.test(path) &&
    (path === clientPrefix || path.startsWith(`${clientPrefix}/`))
  );
}

@Component({
  selector: 'business-client-login-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent, CardComponent],
  template: `
    <section class="center">
      <otui-card class="form-card">
        <h2>Client login</h2>
        <form class="form" (ngSubmit)="login()">
          <label>
            Email
            <input
              type="email"
              [(ngModel)]="email"
              name="email"
              autocomplete="email"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              [(ngModel)]="password"
              name="password"
              autocomplete="current-password"
            />
          </label>
          @if (error()) {
          <p class="error">{{ error() }}</p>
          }
          <otui-button type="submit" variant="primary" [disabled]="loading()">
            {{ loading() ? 'Signing in…' : 'Sign in' }}
          </otui-button>
          <button type="button" (click)="requestEmail('magic-link')">
            Email me a magic link
          </button>
          <button type="button" (click)="requestEmail('password-reset')">
            Forgot password?
          </button>
          <button type="button" (click)="requestEmail('verification')">
            Resend verification
          </button>
          @if (emailStatus()) {
          <p role="status">{{ emailStatus() }}</p>
          }
        </form>
      </otui-card>
    </section>
  `,
  styles: [
    `
      .center {
        display: flex;
        justify-content: center;
        padding: 4rem 1rem;
      }
      .form-card {
        width: 100%;
        max-width: 420px;
      }
      h2 {
        margin: 0 0 1.25rem;
        font-family: var(--font-heading, system-ui);
        font-weight: 700;
      }
      .form {
        display: grid;
        gap: 1rem;
      }
      label {
        display: grid;
        gap: 0.35rem;
        font-size: 0.88rem;
        font-weight: 600;
      }
      input {
        font: inherit;
        padding: 0.8rem 0.9rem;
        border-radius: var(--personality-input-radius, 1rem);
        border: 1px solid var(--border);
        background: rgba(255, 255, 255, 0.04);
        color: inherit;
      }
      .error {
        color: var(--danger);
        margin: 0;
        font-size: 0.88rem;
      }
    `,
  ],
})
export class BusinessClientLoginPageComponent {
  private readonly auth = inject(BusinessAuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute, { optional: true });
  private readonly emailAuth = inject(EmailAuthClientService);

  email = '';
  password = '';
  readonly loading = signal(false);
  readonly error = signal('');
  readonly emailStatus = signal('');
  readonly siteSlug = injectSiteSlugSignal();

  requestEmail(
    purpose: 'verification' | 'magic-link' | 'password-reset'
  ): void {
    if (!this.email) {
      this.emailStatus.set('Enter your email address first.');
      return;
    }
    const returnPath = this.siteSlug()
      ? `/sites/${this.siteSlug()}/client/login`
      : '/client/login';
    this.emailAuth
      .request('business-site', this.email, purpose, returnPath)
      .subscribe({
        next: () =>
          this.emailStatus.set(
            'If that account exists, a secure email is on its way.'
          ),
        error: () =>
          this.emailStatus.set('Email could not be requested right now.'),
      });
  }

  private dashboardRoute(): string[] {
    const siteSlug = this.siteSlug();
    return siteSlug
      ? ['/sites', siteSlug, 'client', 'dashboard']
      : ['/client/dashboard'];
  }

  private clientReturnUrl(): string | null {
    const returnUrl = normalizeBusinessReturnTo(
      this.route?.snapshot.queryParamMap?.get('returnUrl')
    );
    const siteSlug = this.siteSlug();

    return isSafeClientReturnUrl(returnUrl, siteSlug) ? returnUrl : null;
  }

  private navigateAfterLogin(): void {
    const returnUrl = this.clientReturnUrl();
    if (returnUrl) {
      void this.router.navigateByUrl(returnUrl);
      return;
    }

    void this.router.navigate(this.dashboardRoute());
  }

  login(): void {
    this.loading.set(true);
    this.error.set('');
    this.auth.loginClient(this.email, this.password).subscribe({
      next: () => {
        this.loading.set(false);
        this.navigateAfterLogin();
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(
          err?.error?.message || err?.message || 'Invalid email or password.'
        );
      },
    });
  }
}

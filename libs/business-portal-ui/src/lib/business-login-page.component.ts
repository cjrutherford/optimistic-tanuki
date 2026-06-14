import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  BusinessApiService,
  BusinessAuthService,
  mergeBusinessSiteConfig,
} from '@optimistic-tanuki/business-data-access';
import { CardComponent } from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'business-login-page',
  standalone: true,
  imports: [CommonModule, FormsModule, CardComponent],
  template: `
    <div class="login-outer">
      <otui-card class="login-card">
        <div class="login-header">
          <span class="monogram">BO</span>
          <h1>Owner Login</h1>
          <p>
            Sign in to access your owner workspace, or switch to client mode.
          </p>
        </div>

        <div class="mode-switch" role="tablist" aria-label="Auth mode">
          <button
            type="button"
            data-auth-mode
            [class.active]="mode() === 'owner'"
            (click)="setMode('owner')"
          >
            Owner
          </button>
          <button
            type="button"
            data-auth-mode
            [class.active]="mode() === 'client'"
            (click)="setMode('client')"
          >
            Client
          </button>
        </div>

        <form class="login-form" (ngSubmit)="onSubmit()">
          <label>
            Email
            <input
              type="email"
              name="email"
              [(ngModel)]="email"
              autocomplete="username"
              required
              placeholder="owner@example.com"
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
              placeholder="••••••••"
            />
          </label>

          @if (errorMsg()) {
          <p class="error">{{ errorMsg() }}</p>
          }

          <button type="submit" class="otui-btn primary" [disabled]="loading()">
            @if (loading()) { Signing in… } @else { Sign In }
          </button>
        </form>
      </otui-card>
    </div>
  `,
  styles: [
    `
      .login-outer {
        min-height: 80vh;
        display: grid;
        place-items: center;
        padding: 2rem 1rem;
      }

      .login-card {
        width: min(420px, 100%);
      }

      .login-header {
        text-align: center;
        margin-bottom: 2rem;
      }

      .monogram {
        display: inline-grid;
        place-items: center;
        width: 3.5rem;
        height: 3.5rem;
        border-radius: var(--personality-border-radius, 1rem);
        font-weight: 800;
        font-size: 1.25rem;
        color: white;
        background: linear-gradient(
          135deg,
          var(--primary, #1f7a63),
          color-mix(in srgb, var(--primary, #1f7a63) 55%, #0f172a)
        );
        margin-bottom: 1rem;
      }

      h1 {
        font-size: 1.5rem;
        margin: 0 0 0.4rem;
        font-family: 'Instrument Serif', serif;
        font-weight: 400;
      }

      p {
        color: var(--muted, #6b7280);
        margin: 0;
        font-size: 0.9rem;
      }

      .login-form {
        display: grid;
        gap: 1.1rem;
      }

      .mode-switch {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.45rem;
        margin-bottom: 1rem;
        padding: 0.35rem;
        border-radius: 999px;
        background: color-mix(in srgb, var(--primary, #1f7a63) 8%, white);
      }

      .mode-switch button {
        border: none;
        background: transparent;
        border-radius: 999px;
        padding: 0.65rem 0.9rem;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
        color: var(--muted, #6b7280);
      }

      .mode-switch button.active {
        background: white;
        color: var(--foreground, #0f172a);
        box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
      }

      label {
        display: grid;
        gap: 0.4rem;
        font-size: 0.85rem;
        font-weight: 500;
        color: var(--foreground, #0f172a);
      }

      input {
        padding: 0.65rem 0.9rem;
        border: var(--personality-border-width, 1px) solid
          var(--border, #e2e8f0);
        border-radius: var(--personality-border-radius, 0.5rem);
        background: var(--surface, #fff);
        color: var(--foreground, #0f172a);
        font-size: 0.95rem;
        transition: border-color 160ms ease;
        width: 100%;
        box-sizing: border-box;
      }

      input:focus {
        outline: none;
        border-color: var(--primary, #1f7a63);
        box-shadow: 0 0 0 3px
          color-mix(in srgb, var(--primary, #1f7a63) 18%, transparent);
      }

      .error {
        color: var(--destructive, #dc2626);
        font-size: 0.85rem;
        margin: 0;
        padding: 0.6rem 0.9rem;
        border-radius: 0.4rem;
        background: color-mix(
          in srgb,
          var(--destructive, #dc2626) 8%,
          transparent
        );
      }

      .otui-btn {
        padding: 0.7rem 1.5rem;
        border-radius: var(--personality-button-radius, 999px);
        border: none;
        cursor: pointer;
        font-size: 0.95rem;
        font-weight: 600;
        transition: background 160ms ease;
      }

      .otui-btn.primary {
        background: var(--primary, #1f7a63);
        color: white;
      }

      .otui-btn.primary:hover:not(:disabled) {
        background: color-mix(in srgb, var(--primary, #1f7a63) 88%, black);
      }

      .otui-btn:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
    `,
  ],
})
export class BusinessLoginPageComponent {
  private readonly auth = inject(BusinessAuthService);
  private readonly api = inject(BusinessApiService);
  private readonly router = inject(Router);

  email = '';
  password = '';
  readonly mode = signal<'owner' | 'client'>('owner');
  loading = signal(false);
  errorMsg = signal('');

  setMode(mode: 'owner' | 'client'): void {
    this.mode.set(mode);
    this.errorMsg.set('');

    if (mode === 'client') {
      void this.router.navigate(['/client/login']);
    }
  }

  onSubmit(): void {
    if (!this.email || !this.password) return;
    if (this.mode() === 'client') {
      void this.router.navigate(['/client/login']);
      return;
    }

    this.loading.set(true);
    this.errorMsg.set('');

    this.auth.loginAndExchange(this.email, this.password).subscribe({
      next: () => {
        this.api.getSiteConfig().subscribe({
          next: (response) => {
            const config = mergeBusinessSiteConfig(response?.config);
            this.loading.set(false);
            void this.router.navigate([
              config.site.onboardingCompletedAt
                ? '/owner/dashboard'
                : '/owner/onboarding',
            ]);
          },
          error: () => {
            this.loading.set(false);
            void this.router.navigate(['/owner/onboarding']);
          },
        });
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMsg.set(
          err?.error?.message ||
            err?.message ||
            'Login failed. Please try again.'
        );
      },
    });
  }
}

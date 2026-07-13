import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Routes } from '@angular/router';
import { EmailAuthClientService } from '../services/email-auth.service';

export function parseEmailActionToken(fragment: string): string {
  return new URLSearchParams(fragment.replace(/^#/, '')).get('token') || '';
}

export function emailAuthRoutes(storageKey: string): Routes {
  return [
    {
      path: 'auth/verify',
      component: EmailActionComponent,
      data: { purpose: 'verification', storageKey },
    },
    {
      path: 'auth/magic-link',
      component: EmailActionComponent,
      data: { purpose: 'magic-link', storageKey },
    },
    {
      path: 'auth/reset-password',
      component: EmailActionComponent,
      data: { purpose: 'password-reset', storageKey },
    },
  ];
}

@Component({
  selector: 'lib-email-action',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <main class="email-action-shell">
      <section class="email-action-card" aria-live="polite">
        <p class="eyebrow">Secure account access</p>
        <h1>{{ heading }}</h1>
        <p>{{ message }}</p>

        @if (purpose === 'password-reset' && token && state === 'ready') {
        <form [formGroup]="resetForm" (ngSubmit)="submitReset()">
          <label
            >New password<input
              type="password"
              formControlName="password"
              autocomplete="new-password"
          /></label>
          <label
            >Confirm password<input
              type="password"
              formControlName="confirmation"
              autocomplete="new-password"
          /></label>
          <button type="submit">Reset password</button>
        </form>
        } @else if (token && state === 'ready') {
        <button type="button" (click)="confirm()">Continue securely</button>
        }
      </section>
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100%;
      }
      .email-action-shell {
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 2rem;
        background: radial-gradient(
          circle at top left,
          color-mix(in srgb, currentColor 8%, transparent),
          transparent 42%
        );
      }
      .email-action-card {
        width: min(34rem, 100%);
        padding: clamp(1.5rem, 5vw, 3rem);
        border: 1px solid color-mix(in srgb, currentColor 22%, transparent);
        border-radius: 1rem;
        background: color-mix(in srgb, Canvas 94%, transparent);
        box-shadow: 0 1.5rem 4rem
          color-mix(in srgb, currentColor 12%, transparent);
      }
      .eyebrow {
        font-size: 0.75rem;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        opacity: 0.68;
      }
      h1 {
        margin: 0.4rem 0 1rem;
        font-size: clamp(2rem, 7vw, 3.5rem);
        line-height: 0.98;
      }
      form,
      label {
        display: grid;
        gap: 0.55rem;
      }
      form {
        gap: 1rem;
        margin-top: 1.5rem;
      }
      input {
        min-height: 2.75rem;
        border: 1px solid currentColor;
        border-radius: 0.45rem;
        padding: 0.65rem 0.8rem;
        font: inherit;
      }
      button {
        margin-top: 1rem;
        min-height: 2.75rem;
        border: 0;
        border-radius: 999px;
        padding: 0.7rem 1.2rem;
        background: currentColor;
        color: Canvas;
        cursor: pointer;
        font: inherit;
        font-weight: 700;
      }
    `,
  ],
})
export class EmailActionComponent implements OnInit {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly emailAuth = inject(EmailAuthClientService);
  private readonly fb = inject(FormBuilder);

  purpose: 'verification' | 'magic-link' | 'password-reset' = 'verification';
  token = '';
  state: 'ready' | 'pending' | 'success' | 'error' = 'ready';
  message = 'Review this secure request before continuing.';
  resetForm = this.fb.group({ password: [''], confirmation: [''] });

  get heading() {
    if (this.state === 'success') return 'You’re all set';
    if (this.state === 'error') return 'This link could not be used';
    if (this.purpose === 'password-reset') return 'Choose a new password';
    if (this.purpose === 'magic-link') return 'Sign in without a password';
    return 'Verify your email';
  }

  ngOnInit() {
    this.purpose = this.route.snapshot.data['purpose'] || 'verification';
    if (!isPlatformBrowser(this.platformId)) return;
    this.token = parseEmailActionToken(window.location.hash);
    if (!this.token) {
      this.state = 'error';
      this.message = 'The secure token is missing from this link.';
    }
  }

  confirm() {
    if (!this.token || this.purpose === 'password-reset') return;
    this.state = 'pending';
    this.message = 'Confirming your request…';
    this.emailAuth.confirmLogin(this.purpose, this.token).subscribe({
      next: (result) => {
        const storageKey =
          this.route.snapshot.data['storageKey'] || 'auth_token';
        localStorage.setItem(storageKey, result.data.newToken);
        this.state = 'success';
        this.message =
          'Your email is verified and your secure session is ready.';
        const path =
          result.returnPath?.startsWith('/') &&
          !result.returnPath.startsWith('//')
            ? result.returnPath
            : '/';
        void this.router.navigateByUrl(path);
      },
      error: () => {
        this.state = 'error';
        this.message =
          'This link is invalid, expired, or has already been used.';
      },
    });
  }

  submitReset() {
    const { password = '', confirmation = '' } = this.resetForm.getRawValue();
    this.state = 'pending';
    this.emailAuth
      .resetPassword(this.token, password || '', confirmation || '')
      .subscribe({
        next: () => {
          this.state = 'success';
          this.message =
            'Your password was reset. Sign in again on every device.';
        },
        error: () => {
          this.state = 'error';
          this.message =
            'This link is invalid, expired, or the passwords do not meet policy.';
        },
      });
  }
}

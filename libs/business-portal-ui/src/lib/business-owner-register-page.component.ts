import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  BusinessApiService,
  BusinessAuthService,
} from '@optimistic-tanuki/business-data-access';
import { ButtonComponent, CardComponent } from '@optimistic-tanuki/common-ui';
import { EMPTY, catchError, switchMap } from 'rxjs';

@Component({
  selector: 'business-owner-register-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ButtonComponent,
    CardComponent,
  ],
  template: `
    <section class="center">
      <otui-card class="form-card">
        <h2>Claim your owner workspace</h2>
        <p class="lede">
          New business owners can create an account here. Existing clients can
          use the same email and password to add owner access.
        </p>
        <form class="form" (ngSubmit)="register()">
          <label>
            First name
            <input [(ngModel)]="fn" name="fn" autocomplete="given-name" />
          </label>
          <label>
            Last name
            <input [(ngModel)]="ln" name="ln" autocomplete="family-name" />
          </label>
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
              autocomplete="new-password"
            />
          </label>
          <label>
            Confirm password
            <input
              type="password"
              [(ngModel)]="confirm"
              name="confirm"
              autocomplete="new-password"
            />
          </label>
          <label>
            What are you building?
            <textarea [(ngModel)]="bio" name="bio"></textarea>
          </label>
          @if (message()) {
          <p class="success">{{ message() }}</p>
          } @if (error()) {
          <p class="error">{{ error() }}</p>
          }
          <otui-button type="submit" variant="primary" [disabled]="loading()">
            {{ loading() ? 'Opening workspace…' : 'Create owner account' }}
          </otui-button>
          <a [routerLink]="loginRoute()">Already have an account? Sign in</a>
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
        max-width: 480px;
      }
      .lede {
        margin: 0 0 1rem;
        color: var(--muted);
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
      input,
      textarea {
        font: inherit;
        padding: 0.8rem 0.9rem;
        border-radius: var(--personality-input-radius, 1rem);
        border: 1px solid var(--border);
        background: rgba(255, 255, 255, 0.04);
        color: inherit;
      }
      textarea {
        min-height: 100px;
      }
      .error,
      .success {
        margin: 0;
        font-size: 0.88rem;
      }
      .error {
        color: var(--danger);
      }
      .success {
        color: var(--primary);
      }
    `,
  ],
})
export class BusinessOwnerRegisterPageComponent {
  private readonly auth = inject(BusinessAuthService);
  private readonly api = inject(BusinessApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute, { optional: true });

  fn = '';
  ln = '';
  email = '';
  password = '';
  confirm = '';
  bio = '';
  readonly loading = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  readonly siteSlug = this.route?.snapshot.paramMap.get('siteSlug') ?? null;

  loginRoute(): string[] {
    return this.siteSlug
      ? ['/sites', this.siteSlug, 'owner', 'login']
      : ['/auth'];
  }

  private ownerDestination(onboardingCompletedAt?: string | null): string[] {
    const route = onboardingCompletedAt ? 'dashboard' : 'onboarding';
    return this.siteSlug
      ? ['/sites', this.siteSlug, 'owner', route]
      : ['/owner', route];
  }

  register(): void {
    this.loading.set(true);
    this.error.set('');
    this.message.set('');

    this.auth
      .registerOwner({
        fn: this.fn,
        ln: this.ln,
        email: this.email,
        password: this.password,
        confirm: this.confirm,
        bio: this.bio,
      })
      .pipe(
        switchMap(() => this.auth.loginAndExchange(this.email, this.password)),
        catchError((err) => {
          if (this.isExistingAccountError(err)) {
            return this.auth.loginAndExchange(this.email, this.password);
          }
          throw err;
        }),
        switchMap(() => this.auth.claimOwnerAccess()),
        switchMap(() => this.api.getSiteConfig()),
        catchError((err) => {
          this.loading.set(false);
          this.error.set(
            err?.error?.message || err?.message || 'Registration failed.'
          );
          return EMPTY;
        })
      )
      .subscribe((siteConfig) => {
        this.loading.set(false);
        this.message.set('Owner workspace ready. Redirecting…');
        const onboardingCompletedAt =
          siteConfig.config?.site?.onboardingCompletedAt;
        void this.router.navigate(this.ownerDestination(onboardingCompletedAt));
      });
  }

  private isExistingAccountError(err: unknown): boolean {
    const message =
      (err as { error?: { message?: string }; message?: string })?.error
        ?.message ||
      (err as { message?: string })?.message ||
      '';
    return message.toLowerCase().includes('already exists');
  }
}

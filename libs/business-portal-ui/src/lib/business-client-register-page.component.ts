import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  BusinessApiService,
  BusinessAuthService,
} from '@optimistic-tanuki/business-data-access';
import { ButtonComponent, CardComponent } from '@optimistic-tanuki/common-ui';
import { of, switchMap } from 'rxjs';

@Component({
  selector: 'business-client-register-page',
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
        <h2>Create account</h2>
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
            What brings you here?
            <textarea [(ngModel)]="bio" name="bio"></textarea>
          </label>
          @if (message()) {
          <p class="success">{{ message() }}</p>
          } @if (error()) {
          <p class="error">{{ error() }}</p>
          }
          <otui-button type="submit" variant="primary" [disabled]="loading()">
            {{ loading() ? 'Creating account…' : 'Create account' }}
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
        max-width: 460px;
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
        color: var(--destructive, #e11d48);
      }
      .success {
        color: var(--primary, #1f7a63);
      }
    `,
  ],
})
export class BusinessClientRegisterPageComponent {
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
      ? ['/sites', this.siteSlug, 'client', 'login']
      : ['/client/login'];
  }

  dashboardRoute(): string[] {
    return this.siteSlug
      ? ['/sites', this.siteSlug, 'client', 'dashboard']
      : ['/client/dashboard'];
  }

  register(): void {
    this.loading.set(true);
    this.error.set('');
    this.message.set('');

    this.auth
      .registerClient({
        fn: this.fn,
        ln: this.ln,
        email: this.email,
        password: this.password,
        confirm: this.confirm,
        bio: this.bio,
      })
      .pipe(
        switchMap(() => this.auth.loginClient(this.email, this.password)),
        switchMap((clientUser) =>
          this.siteSlug
            ? this.api.createLeadIntake({
                siteSlug: this.siteSlug,
                userId: clientUser.userId,
                profileId: clientUser.profileId,
                name: `${this.fn} ${this.ln}`.trim(),
                email: this.email,
                goal: this.bio || 'New client registration',
                context: 'Hosted business registration',
              })
            : of(clientUser)
        )
      )
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.message.set('Account created and linked. Opening your portal…');
          void this.router.navigate(this.dashboardRoute());
        },
        error: (err) => {
          this.loading.set(false);
          this.error.set(
            err?.error?.message || err?.message || 'Registration failed.'
          );
        },
      });
  }
}

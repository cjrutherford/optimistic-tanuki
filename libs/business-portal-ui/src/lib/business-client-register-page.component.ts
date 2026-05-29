import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { BusinessAuthService } from '@optimistic-tanuki/business-data-access';
import { ButtonComponent, CardComponent } from '@optimistic-tanuki/common-ui';

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
          <a [routerLink]="['/client/login']"
            >Already have an account? Sign in</a
          >
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
  private readonly router = inject(Router);

  fn = '';
  ln = '';
  email = '';
  password = '';
  confirm = '';
  bio = '';
  readonly loading = signal(false);
  readonly error = signal('');
  readonly message = signal('');

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
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.message.set('Account created. Sign in to continue.');
          void this.router.navigate(['/client/login']);
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

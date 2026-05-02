import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TrainerAuthService } from '@optimistic-tanuki/trainer-data-access';
import { ButtonComponent, CardComponent } from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'trainer-client-login-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent, CardComponent],
  template: `
    <section class="center">
      <otui-card class="form-card">
        <h2>Client login</h2>
        <form class="form" (ngSubmit)="login()">
          <label>
            Email
            <input type="email" [(ngModel)]="email" name="email" autocomplete="email" />
          </label>
          <label>
            Password
            <input type="password" [(ngModel)]="password" name="password" autocomplete="current-password" />
          </label>
          @if (error()) {
            <p class="error">{{ error() }}</p>
          }
          <otui-button type="submit" variant="primary" [disabled]="loading()">
            {{ loading() ? 'Signing in\u2026' : 'Sign in' }}
          </otui-button>
        </form>
      </otui-card>
    </section>
  `,
  styles: [`
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
      background: rgba(255,255,255,0.04);
      color: inherit;
    }
    .error {
      color: var(--destructive, #e11d48);
      margin: 0;
      font-size: 0.88rem;
    }
  `],
})
export class TrainerClientLoginPageComponent {
  private readonly auth = inject(TrainerAuthService);
  private readonly router = inject(Router);

  email = '';
  password = '';
  readonly loading = signal(false);
  readonly error = signal('');

  login(): void {
    this.loading.set(true);
    this.error.set('');
    this.auth.loginClient(this.email, this.password).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/client/dashboard']);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Invalid email or password.');
      },
    });
  }
}

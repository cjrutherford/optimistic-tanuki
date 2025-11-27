import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

import { CardComponent } from '@optimistic-tanuki/common-ui';
import { TextInputComponent } from '@optimistic-tanuki/form-ui';
import { AuthStateService } from '../../auth-state.service';

@Component({
  selector: 'dh-login-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    CardComponent,
    TextInputComponent,
  ],
  template: `
    <div class="login-container">
      <otui-card class="login-card">
        <h1>Sign In</h1>
        <p class="subtitle">Sign in to access blog editing features</p>

        <div *ngIf="error" class="error-message">
          {{ error }}
        </div>

        <form (ngSubmit)="onSubmit($event)">
          <div class="form-group">
            <label for="username">Username or Email</label>
            <lib-text-input
              id="username"
              [(ngModel)]="username"
              name="username"
              placeholder="Enter your username"
              [type]="'text'"
            ></lib-text-input>
          </div>

          <div class="form-group">
            <label for="password">Password</label>
            <lib-text-input
              id="password"
              [(ngModel)]="password"
              name="password"
              placeholder="Enter your password"
              [type]="'password'"
            ></lib-text-input>
          </div>

          <div class="actions">
            <button type="submit" class="submit-button" [disabled]="loading">
              {{ loading ? 'Signing in...' : 'Sign In' }}
            </button>
          </div>
        </form>

        <div class="footer-links">
          <a routerLink="/">Back to Home</a>
        </div>
      </otui-card>
    </div>
  `,
  styles: [`
    .login-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
      background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
    }

    .login-card {
      width: 100%;
      max-width: 400px;
      padding: 2rem;
    }

    h1 {
      margin: 0 0 0.5rem 0;
      color: var(--foreground, #333);
      text-align: center;
    }

    .subtitle {
      text-align: center;
      color: var(--foreground-secondary, #666);
      margin-bottom: 2rem;
    }

    .error-message {
      background: #fee;
      border: 1px solid #fcc;
      color: #c00;
      padding: 0.75rem 1rem;
      border-radius: 4px;
      margin-bottom: 1rem;
      text-align: center;
    }

    .form-group {
      margin-bottom: 1.5rem;
    }

    .form-group label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 500;
      color: var(--foreground, #333);
    }

    .actions {
      margin-top: 2rem;
      text-align: center;
    }

    .submit-button {
      width: 100%;
      padding: 0.75rem 1.5rem;
      font-size: 1rem;
      font-weight: 500;
      color: white;
      background: var(--accent, #007acc);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      transition: background 0.2s ease;
    }

    .submit-button:hover:not(:disabled) {
      background: var(--accent-dark, #005999);
    }

    .submit-button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .footer-links {
      margin-top: 1.5rem;
      text-align: center;
    }

    .footer-links a {
      color: var(--accent, #007acc);
      text-decoration: none;
    }

    .footer-links a:hover {
      text-decoration: underline;
    }
  `],
})
export class LoginPageComponent {
  private authState: AuthStateService = inject(AuthStateService);
  private router: Router = inject(Router);

  username = '';
  password = '';
  loading = false;
  error: string | null = null;

  async onSubmit(event?: Event): Promise<void> {
    if (event) {
      event.preventDefault();
    }
    
    if (!this.username || !this.password) {
      this.error = 'Please enter both username and password.';
      return;
    }

    this.loading = true;
    this.error = null;

    try {
      await this.authState.login({
        username: this.username,
        password: this.password,
      });
      
      // Redirect to blog page after successful login
      this.router.navigate(['/blog']);
    } catch (err: any) {
      this.error = err?.message || 'Login failed. Please check your credentials.';
    } finally {
      this.loading = false;
    }
  }
}

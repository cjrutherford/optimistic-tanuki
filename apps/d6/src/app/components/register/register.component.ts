import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthenticationService } from '../../services/authentication.service';
import { RegisterRequest } from '../../types';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="register-container">
      <div class="register-card">
        <h1>Create Account</h1>
        <p class="subtitle">Start your wellness journey today</p>

        <form (ngSubmit)="onSubmit()">
          <div class="form-group">
            <label for="email">Email</label>
            <input
              type="email"
              id="email"
              [(ngModel)]="credentials.email"
              name="email"
              required
              placeholder="Enter your email"
            />
          </div>

          <div class="form-group">
            <label for="password">Password</label>
            <input
              type="password"
              id="password"
              [(ngModel)]="credentials.password"
              name="password"
              required
              minlength="8"
              placeholder="Create a password (min 8 characters)"
            />
          </div>

          <div class="form-group">
            <label for="confirmPassword">Confirm Password</label>
            <input
              type="password"
              id="confirmPassword"
              [(ngModel)]="confirmPassword"
              name="confirmPassword"
              required
              placeholder="Confirm your password"
            />
          </div>

          @if (error()) {
            <div class="error-message">{{ error() }}</div>
          }

          <button type="submit" [disabled]="loading()" class="submit-btn">
            @if (loading()) {
              <span class="spinner"></span>
              Creating account...
            } @else {
              Create Account
            }
          </button>
        </form>

        <p class="footer-text">
          Already have an account? <a routerLink="/login">Sign in</a>
        </p>
      </div>
    </div>
  `,
  styles: [`
    .register-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 1rem;
    }

    .register-card {
      background: white;
      border-radius: 1rem;
      padding: 2.5rem;
      width: 100%;
      max-width: 400px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
    }

    h1 {
      font-size: 1.75rem;
      font-weight: 700;
      color: #1a202c;
      margin-bottom: 0.5rem;
      text-align: center;
    }

    .subtitle {
      color: #718096;
      text-align: center;
      margin-bottom: 2rem;
    }

    .form-group {
      margin-bottom: 1.25rem;
    }

    label {
      display: block;
      font-size: 0.875rem;
      font-weight: 500;
      color: #4a5568;
      margin-bottom: 0.5rem;
    }

    input {
      width: 100%;
      padding: 0.75rem 1rem;
      border: 2px solid #e2e8f0;
      border-radius: 0.5rem;
      font-size: 1rem;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    input:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    .error-message {
      background: #fed7d7;
      color: #c53030;
      padding: 0.75rem 1rem;
      border-radius: 0.5rem;
      font-size: 0.875rem;
      margin-bottom: 1rem;
    }

    .submit-btn {
      width: 100%;
      padding: 0.875rem;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 0.5rem;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .submit-btn:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
    }

    .submit-btn:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }

    .spinner {
      display: inline-block;
      width: 1rem;
      height: 1rem;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-right: 0.5rem;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .footer-text {
      text-align: center;
      margin-top: 1.5rem;
      color: #718096;
    }

    .footer-text a {
      color: #667eea;
      font-weight: 500;
      text-decoration: none;
    }

    .footer-text a:hover {
      text-decoration: underline;
    }
  `]
})
export class RegisterComponent {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthenticationService);

  credentials: RegisterRequest = {
    email: '',
    password: ''
  };
  confirmPassword = '';

  loading = signal(false);
  error = signal<string | null>(null);

  onSubmit(): void {
    if (!this.credentials.email || !this.credentials.password) {
      this.error.set('Please fill in all fields');
      return;
    }

    if (this.credentials.password !== this.confirmPassword) {
      this.error.set('Passwords do not match');
      return;
    }

    if (this.credentials.password.length < 8) {
      this.error.set('Password must be at least 8 characters');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.authService.register(this.credentials).subscribe({
      next: () => {
        this.router.navigate(['/login']);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.message || 'Registration failed. Please try again.');
      }
    });
  }
}

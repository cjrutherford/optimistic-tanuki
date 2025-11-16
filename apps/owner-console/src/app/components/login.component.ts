import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { LoginBlockComponent } from '@optimistic-tanuki/auth-ui';
import { AuthService } from '../services/auth.service';
import { LoginType } from '@optimistic-tanuki/ui-models';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    LoginBlockComponent,
  ],
  template: `
    <div class="login-container">
      <lib-login-block
        title="Owner Console"
        description="Sign in to manage users, roles, and permissions"
        [heroSrc]="'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=2070'"
        [heroAlt]="'Owner Console'"
        (submitEvent)="onLogin($event)"
      ></lib-login-block>
      <div class="register-link">
        <a routerLink="/register">Don't have an account? Register as Owner</a>
      </div>
      <div *ngIf="error" class="error-message">{{ error }}</div>
    </div>
  `,
  styles: [
    `
      .login-container {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
        padding: 2rem;
      }

      lib-login-block {
        width: 100%;
        max-width: 800px;
      }

      .error-message {
        color: #f44336;
        margin-top: 1rem;
        font-size: 0.875rem;
        text-align: center;
      }

      .register-link {
        margin-top: 1rem;
        text-align: center;
      }

      .register-link a {
        color: #667eea;
        text-decoration: none;
      }

      .register-link a:hover {
        text-decoration: underline;
      }
    `,
  ],
})
export class LoginComponent {
  error = '';

  constructor(private authService: AuthService, private router: Router) {}

  onLogin(loginData: LoginType): void {
    this.error = '';

    this.authService.login(loginData.email, loginData.password, loginData.mfa).subscribe({
      next: () => {
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.error = err.error?.message || 'Login failed. Please try again.';
      },
    });
  }
}

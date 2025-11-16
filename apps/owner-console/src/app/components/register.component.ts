import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { RegisterBlockComponent } from '@optimistic-tanuki/auth-ui';
import { AuthService } from '../services/auth.service';
import { RegisterSubmitType } from '@optimistic-tanuki/ui-models';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    RegisterBlockComponent,
  ],
  template: `
    <div class="register-container">
      <lib-register-block
        registerHeader="Owner Console Registration"
        callToAction="Create an owner account with full administrative access to all apps"
        registerButtonText="Register as Owner"
        [heroSource]="'https://images.unsplash.com/photo-1551434678-e076c223a692?q=80&w=2070'"
        (submitEvent)="onRegister($event)"
      ></lib-register-block>
      <div class="login-link">
        <a routerLink="/login">Already have an account? Login</a>
      </div>
      <div *ngIf="error" class="error-message">{{ error }}</div>
      <div *ngIf="success" class="success-message">{{ success }}</div>
    </div>
  `,
  styles: [
    `
      .register-container {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
        padding: 2rem;
      }

      lib-register-block {
        width: 100%;
        max-width: 800px;
      }

      .error-message {
        color: #f44336;
        margin-top: 1rem;
        font-size: 0.875rem;
        text-align: center;
      }

      .success-message {
        color: #4caf50;
        margin-top: 1rem;
        font-size: 0.875rem;
        text-align: center;
      }

      .login-link {
        margin-top: 1rem;
        text-align: center;
      }

      .login-link a {
        color: #667eea;
        text-decoration: none;
      }

      .login-link a:hover {
        text-decoration: underline;
      }
    `,
  ],
})
export class RegisterComponent {
  error = '';
  success = '';

  constructor(private authService: AuthService, private router: Router) {}

  onRegister(registerData: RegisterSubmitType): void {
    this.error = '';
    this.success = '';

    this.authService.register(
      registerData.email,
      registerData.firstName,
      registerData.lastName,
      registerData.password,
      registerData.confirmation,
      registerData.bio
    ).subscribe({
      next: () => {
        this.success = 'Registration successful! Redirecting to dashboard...';
        setTimeout(() => {
          this.router.navigate(['/dashboard']);
        }, 2000);
      },
      error: (err) => {
        this.error = err.error?.message || 'Registration failed. Please try again.';
      },
    });
  }
}

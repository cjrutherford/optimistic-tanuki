import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { RegisterBlockComponent } from '@optimistic-tanuki/auth-ui';
import { RegisterSubmitType, submitTypeToRegisterRequest } from '@optimistic-tanuki/ui-models';
import { AuthenticationService } from '../../services/authentication.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, RegisterBlockComponent],
  template: `
    <div class="register-page">
      <lib-register-block
        registerHeader="Join Towne Square"
        callToAction="Create an account to join local communities"
        (submitEvent)="onRegister($event)"
      ></lib-register-block>
      @if (error) {
        <p class="error-message" role="alert">{{ error }}</p>
      }
      <p class="login-link">
        Already have an account?
        <a href="/login">Sign in</a>
      </p>
    </div>
  `,
  styles: [`
    .register-page {
      max-width: 480px;
      margin: 48px auto;
      padding: 0 16px;
    }
    .error-message {
      color: var(--error, #d32f2f);
      text-align: center;
      margin-top: 12px;
    }
    .login-link {
      text-align: center;
      margin-top: 16px;
      font-size: 0.9rem;
      a {
        color: var(--primary, #3f51b5);
        font-weight: 600;
        text-decoration: none;
        &:hover { text-decoration: underline; }
      }
    }
  `],
})
export class RegisterComponent {
  private authService = inject(AuthenticationService);
  private router = inject(Router);

  error: string | null = null;

  async onRegister(data: RegisterSubmitType): Promise<void> {
    this.error = null;
    if (data.password !== data.confirmation) {
      this.error = 'Passwords do not match.';
      return;
    }
    try {
      await new Promise<void>((resolve, reject) => {
        this.authService.register(submitTypeToRegisterRequest(data)).subscribe({
          next: () => resolve(),
          error: (err: unknown) => reject(err),
        });
      });
      this.router.navigate(['/login']);
    } catch {
      this.error = 'Registration failed. Please try again.';
    }
  }
}

import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { LoginBlockComponent } from '@optimistic-tanuki/auth-ui';
import { LoginType } from '@optimistic-tanuki/ui-models';
import { AuthStateService } from '../../services/auth-state.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, LoginBlockComponent, RouterModule],
  template: `
    <div class="login-page">
      <lib-login-block
        title="Welcome to Towne Square"
        description="Sign in to join communities and connect with your neighbors."
        (submitEvent)="onLogin($event)"
      ></lib-login-block>
      @if (error) {
        <p class="error-message" role="alert">{{ error }}</p>
      }
      <p class="register-link">
        Don't have an account?
        <a routerLink="/register">Create one</a>
      </p>
    </div>
  `,
  styles: [`
    .login-page {
      max-width: 480px;
      margin: 48px auto;
      padding: 0 16px;
    }
    .error-message {
      color: var(--error, #d32f2f);
      text-align: center;
      margin-top: 12px;
    }
    .register-link {
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
export class LoginComponent {
  private authState = inject(AuthStateService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  error: string | null = null;

  async onLogin(credentials: LoginType): Promise<void> {
    this.error = null;
    try {
      await this.authState.login(credentials.email, credentials.password);
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/';
      this.router.navigateByUrl(returnUrl);
    } catch {
      this.error = 'Invalid email or password. Please try again.';
    }
  }
}

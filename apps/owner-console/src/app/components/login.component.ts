import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import {
  LoginBlockComponent,
  OAuthProviderEvent,
  OAuthService,
} from '@optimistic-tanuki/auth-ui';
import { AuthService } from '../services/auth.service';
import { LoginType } from '@optimistic-tanuki/ui-models';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, RouterModule, LoginBlockComponent],
  template: `
    <div class="login-container">
      <lib-login-block
        title="Owner Console"
        description="Sign in to manage users, roles, and permissions"
        [heroSrc]="
          'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=2070'
        "
        [heroAlt]="'Owner Console'"
        (submitEvent)="onLogin($event)"
        (oauthProviderSelected)="onOAuthProvider($event)"
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
export class LoginComponent implements OnInit {
  error = '';
  private oauthService: OAuthService;

  constructor(
    private authService: AuthService,
    private router: Router,
    private http: HttpClient
  ) {
    this.oauthService = new OAuthService(this.http, '/api');
  }

  ngOnInit(): void {
    this.loadOAuthConfig();
  }

  private async loadOAuthConfig(): Promise<void> {
    try {
      const domain = window.location.hostname;
      const config: any = await this.http.get(`/api/oauth/config?domain=${encodeURIComponent(domain)}`).toPromise();
      if (config) {
        this.oauthService.configureProviders(config);
      }
    } catch (e) {
      // Config endpoint might not exist, continue with defaults
      console.log('OAuth config not loaded from server, using defaults');
    }
  }

  onLogin(loginData: LoginType): void {
    this.error = '';

    this.authService.login(loginData.email, loginData.password).subscribe({
      next: () => {
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.error = err.error?.message || 'Login failed. Please try again.';
      },
    });
  }

  async onOAuthProvider(event: OAuthProviderEvent): Promise<void> {
    this.error = '';

    try {
      const result = await this.oauthService.initiateOAuthLogin(
        event.provider,
        'owner-console'
      );

      if (result.success && result.token) {
        // Store the token and navigate to dashboard
        this.authService.setToken(result.token);
        this.router.navigate(['/dashboard']);
      } else if (result.needsRegistration && result.userData) {
        // Handle auto-registration for new OAuth users
        const names = result.userData.displayName.split(' ');
        const firstName = names[0] || '';
        const lastName = names.slice(1).join(' ') || '';

        // Auto-complete registration
        const regResult = await this.oauthService.completeOAuthRegistration(
          result.userData.provider,
          result.userData.providerUserId,
          result.userData.email,
          firstName,
          lastName,
          '' // code is already exchanged
        );

        if (regResult.success && regResult.token) {
          this.authService.setToken(regResult.token);
          this.router.navigate(['/dashboard']);
        } else {
          this.error =
            regResult.error || 'Registration failed. Please try again.';
        }
      } else {
        this.error = result.error || 'OAuth login failed. Please try again.';
      }
    } catch (err: any) {
      this.error = err.message || 'OAuth login failed. Please try again.';
    }
  }
}

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
    <section class="auth-shell">
      <div class="auth-story">
        <p class="eyebrow">Owner Console</p>
        <h1>Platform-wide authority starts here.</h1>
        <p class="lede">
          Sign in to govern scopes, assign roles, and control operational access
          across the platform.
        </p>
      </div>
      <div class="auth-panel">
        <lib-login-block
          title="Owner Console"
          description="Sign in to manage users, roles, and permissions."
          [heroSrc]="'/tempest-in-a-teacup.png'"
          [heroAlt]="'Owner Console illustration'"
          (submitEvent)="onLogin($event)"
          (oauthProviderSelected)="onOAuthProvider($event)"
        ></lib-login-block>
        <div class="register-link">
          <a routerLink="/register">Don't have an account? Register as Owner</a>
        </div>
        <div *ngIf="error" class="error-message">{{ error }}</div>
      </div>
    </section>
  `,
  styles: [
    `
      // .auth-shell {
      //   display: grid;
      //   grid-template-columns: minmax(0, 28rem) minmax(20rem, 34rem);
      //   gap: 3rem;
      //   align-items: center;
      //   justify-content: center;
      //   min-height: 100vh;
      //   padding: 2rem 1.25rem 3rem;
      //   background: radial-gradient(
      //       circle at top left,
      //       rgba(102, 126, 234, 0.2),
      //       transparent 24rem
      //     ),
      //     radial-gradient(
      //       circle at bottom right,
      //       rgba(118, 75, 162, 0.18),
      //       transparent 24rem
      //     ),
      //     linear-gradient(180deg, #111827 0%, #1f2937 100%);
      // }

      .auth-story {
        display: grid;
        gap: 1rem;
        color: #f3f4f6;
      }

      .eyebrow {
        margin: 0;
        font-size: 0.8rem;
        font-weight: 800;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: #a5b4fc;
      }

      h1 {
        margin: 0;
        font-size: clamp(2.4rem, 5vw, 4.2rem);
        line-height: 0.95;
        letter-spacing: -0.05em;
      }

      .lede {
        margin: 0;
        color: rgba(243, 244, 246, 0.8);
        line-height: 1.7;
      }

      .auth-panel {
        display: grid;
        gap: 0.9rem;
      }

      .error-message {
        color: #f44336;
        margin-top: 1rem;
        font-size: 0.875rem;
        text-align: center;
      }

      .register-link {
        text-align: center;
      }

      .register-link a {
        color: #667eea;
        text-decoration: none;
      }

      .register-link a:hover {
        text-decoration: underline;
      }

      // @media (max-width: 960px) {
      //   .auth-shell {
      //     grid-template-columns: 1fr;
      //   }
      // }
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
      const config: any = await this.http
        .get(`/api/oauth/config?domain=${encodeURIComponent(domain)}`)
        .toPromise();
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

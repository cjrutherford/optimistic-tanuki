import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import {
  RegisterBlockComponent,
  OAuthProviderEvent,
  OAuthService,
} from '@optimistic-tanuki/auth-ui';
import { AuthService } from '../services/auth.service';
import { RegisterSubmitType } from '@optimistic-tanuki/ui-models';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, RouterModule, RegisterBlockComponent],
  template: `
    <section class="auth-shell">
      <div class="auth-story">
        <p class="eyebrow">Owner Console</p>
        <h1>Provision the operator account that controls the stack.</h1>
        <p class="lede">
          Registration here is for platform operators who need role assignment,
          permissions control, and full administrative access.
        </p>
      </div>
      <div class="auth-panel">
        <lib-register-block
          registerHeader="Owner Console Registration"
          callToAction="Create an owner account with full administrative access to all apps."
          registerButtonText="Register as Owner"
          [heroSource]="'/tempest-in-a-teacup.png'"
          (submitEvent)="onRegister($event)"
          (oauthProviderSelected)="onOAuthProvider($event)"
        ></lib-register-block>
        <div class="login-link">
          <a routerLink="/login">Already have an account? Login</a>
        </div>
        <div *ngIf="oauthConfigMessage" class="info-message">
          {{ oauthConfigMessage }}
        </div>
        <div *ngIf="error" class="error-message">{{ error }}</div>
        <div *ngIf="success" class="success-message">{{ success }}</div>
      </div>
    </section>
  `,
  styles: [
    `
      .auth-shell {
        display: grid;
        grid-template-columns: minmax(0, 28rem) minmax(20rem, 35rem);
        gap: 3rem;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        padding: 2rem 1.25rem 3rem;
        background: radial-gradient(
            circle at top left,
            rgba(244, 114, 182, 0.18),
            transparent 24rem
          ),
          radial-gradient(
            circle at bottom right,
            rgba(45, 212, 191, 0.16),
            transparent 24rem
          ),
          linear-gradient(180deg, #111827 0%, #1f2937 100%);
      }

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
        padding: 1.25rem;
        border-radius: 1.5rem;
        background: rgba(17, 24, 39, 0.44);
        border: 1px solid rgba(148, 163, 184, 0.18);
        backdrop-filter: blur(14px);
      }

      .error-message,
      .success-message,
      .info-message {
        margin-top: 0.25rem;
        padding: 0.85rem 1rem;
        border-radius: 0.9rem;
        font-size: 0.875rem;
        line-height: 1.5;
      }

      .error-message {
        color: #fecaca;
        background: rgba(185, 28, 28, 0.22);
        border: 1px solid rgba(248, 113, 113, 0.28);
      }

      .success-message {
        color: #bbf7d0;
        background: rgba(21, 128, 61, 0.22);
        border: 1px solid rgba(74, 222, 128, 0.24);
      }

      .info-message {
        color: #fce7f3;
        background: rgba(157, 23, 77, 0.24);
        border: 1px solid rgba(244, 114, 182, 0.26);
      }

      .login-link {
        text-align: center;
      }

      .login-link a {
        color: #f9a8d4;
        text-decoration: none;
      }

      .login-link a:hover {
        text-decoration: underline;
      }

      @media (max-width: 960px) {
        .auth-shell {
          grid-template-columns: 1fr;
          align-items: start;
          padding-top: 3rem;
        }
      }
    `,
  ],
})
export class RegisterComponent implements OnInit {
  error = '';
  success = '';
  oauthConfigMessage = '';
  private oauthService: OAuthService;
  private http = inject(HttpClient);

  constructor(private authService: AuthService, private router: Router) {
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
      this.oauthConfigMessage = '';
    } catch (e) {
      this.oauthConfigMessage =
        'OAuth provider configuration is unavailable right now. Use direct registration until providers are configured.';
    }
  }

  onRegister(registerData: RegisterSubmitType): void {
    this.error = '';
    this.success = '';

    this.authService
      .register(
        registerData.email,
        registerData.firstName,
        registerData.lastName,
        registerData.password,
        registerData.confirmation,
        registerData.bio
      )
      .subscribe({
        next: () => {
          this.success = 'Registration successful! Redirecting to dashboard...';
          setTimeout(() => {
            this.router.navigate(['/dashboard']);
          }, 2000);
        },
        error: (err) => {
          this.error =
            err.error?.message || 'Registration failed. Please try again.';
        },
      });
  }

  async onOAuthProvider(event: OAuthProviderEvent): Promise<void> {
    this.error = '';
    this.success = '';

    try {
      const result = await this.oauthService.initiateOAuthLogin(
        event.provider,
        'owner-console'
      );

      if (result.success && result.token) {
        this.authService.setToken(result.token);
        this.success = 'Registration and login successful! Redirecting...';
        setTimeout(() => {
          this.router.navigate(['/dashboard']);
        }, 1500);
      } else if (result.needsRegistration && result.userData) {
        // Handle auto-registration for new OAuth users
        const names = result.userData.displayName.split(' ');
        const firstName = names[0] || '';
        const lastName = names.slice(1).join(' ') || '';

        const regResult = await this.oauthService.completeOAuthRegistration(
          result.userData.provider,
          result.userData.providerUserId,
          result.userData.email,
          firstName,
          lastName,
          ''
        );

        if (regResult.success && regResult.token) {
          this.authService.setToken(regResult.token);
          this.success = 'Registration and login successful! Redirecting...';
          setTimeout(() => {
            this.router.navigate(['/dashboard']);
          }, 1500);
        } else {
          this.error =
            regResult.error || 'Registration failed. Please try again.';
        }
      } else {
        this.error =
          result.error || 'OAuth registration failed. Please try again.';
      }
    } catch (err: any) {
      this.error =
        err.message || 'OAuth registration failed. Please try again.';
    }
  }
}

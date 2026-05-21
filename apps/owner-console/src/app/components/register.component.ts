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
            rgba(102, 126, 234, 0.2),
            transparent 24rem
          ),
          radial-gradient(
            circle at bottom right,
            rgba(118, 75, 162, 0.18),
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
        text-align: center;
      }

      .login-link a {
        color: #667eea;
        text-decoration: none;
      }

      .login-link a:hover {
        text-decoration: underline;
      }

      @media (max-width: 960px) {
        .auth-shell {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class RegisterComponent implements OnInit {
  error = '';
  success = '';
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
    } catch (e) {
      console.log('OAuth config not loaded from server, using defaults');
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

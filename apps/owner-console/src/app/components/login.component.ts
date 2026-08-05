import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import {
  LoginBlockComponent,
  OAuthProviderEvent,
  OAuthService,
} from '@optimistic-tanuki/auth-ui';
import { AuthService } from '../services/auth.service';
import { LoginType } from '@optimistic-tanuki/ui-models';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

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
          appId="owner-console"
          title="Owner Console"
          description="Sign in to manage users, roles, and permissions."
          [heroSrc]="'/tempest-in-a-teacup.png'"
          [heroAlt]="'Owner Console illustration'"
          (submitEvent)="onLogin($event)"
          (oauthProviderSelected)="onOAuthProvider($event)"
        ></lib-login-block>
        <div *ngIf="provisioningMessage" class="info-message" role="status">
          {{ provisioningMessage }}
        </div>
        <div *ngIf="oauthConfigMessage" class="info-message" role="status">
          {{ oauthConfigMessage }}
        </div>
        <div *ngIf="error" class="error-message" role="alert">{{ error }}</div>
      </div>
    </section>
  `,
  styles: [
    `
      .auth-shell {
        display: grid;
        grid-template-columns: minmax(0, 28rem) minmax(20rem, 34rem);
        gap: 3rem;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        padding: 2rem 1.25rem 3rem;
        background: radial-gradient(
            circle at top left,
            color-mix(in srgb, var(--accent, var(--primary)) 18%, transparent),
            transparent 24rem
          ),
          radial-gradient(
            circle at bottom right,
            color-mix(in srgb, var(--info) 16%, transparent),
            transparent 24rem
          ),
          linear-gradient(
            180deg,
            color-mix(in srgb, var(--background, #0f172a) 76%, black) 0%,
            color-mix(
                in srgb,
                var(--background, #162033) 68%,
                var(--primary, #1d4ed8)
              )
              100%
          );
      }

      .auth-story {
        display: grid;
        gap: 1rem;
        color: var(--foreground, #f3f4f6);
      }

      .eyebrow {
        margin: 0;
        font-size: 0.8rem;
        font-weight: 800;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: color-mix(in srgb, var(--info) 58%, var(--foreground));
      }

      h1 {
        margin: 0;
        font-size: clamp(2.4rem, 5vw, 4.2rem);
        line-height: 0.95;
        letter-spacing: -0.05em;
      }

      .lede {
        margin: 0;
        color: color-mix(in srgb, var(--foreground, #f3f4f6) 82%, transparent);
        line-height: 1.7;
      }

      .auth-panel {
        display: grid;
        gap: 0.9rem;
        padding: 1.25rem;
        border-radius: 1.5rem;
        background: color-mix(
          in srgb,
          var(--surface, #ffffff) 30%,
          transparent
        );
        border: 1px solid
          color-mix(in srgb, var(--border-color, #94a3b8) 34%, transparent);
        backdrop-filter: blur(14px);
      }

      .error-message,
      .info-message {
        margin-top: 0.25rem;
        padding: 0.85rem 1rem;
        border-radius: 0.9rem;
        font-size: 0.875rem;
        line-height: 1.5;
      }

      .error-message {
        color: color-mix(in srgb, var(--danger) 48%, white);
        background: color-mix(in srgb, var(--danger) 22%, transparent);
        border: 1px solid color-mix(in srgb, var(--danger) 30%, transparent);
      }

      .info-message {
        color: color-mix(in srgb, var(--info) 42%, white);
        background: color-mix(in srgb, var(--info) 20%, transparent);
        border: 1px solid color-mix(in srgb, var(--info) 28%, transparent);
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
export class LoginComponent implements OnInit {
  error = '';
  oauthConfigMessage = '';
  provisioningMessage = '';
  private oauthService: OAuthService;

  constructor(
    private authService: AuthService,
    private router: Router,
    private http: HttpClient,
    private route: ActivatedRoute
  ) {
    this.oauthService = new OAuthService(this.http, '/api');
  }

  ngOnInit(): void {
    if (this.route.snapshot.queryParams['provisioning'] === 'required') {
      this.provisioningMessage =
        'Owner accounts must be provisioned by an existing operator.';
    }
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
        'OAuth provider configuration is unavailable right now. Use email/password sign-in until providers are configured.';
    }
  }

  onLogin(loginData: LoginType): void {
    this.error = '';

    this.authService.login(loginData.email, loginData.password).subscribe({
      next: async () => {
        const sessionRestored = await firstValueFrom(
          this.authService.restoreSession()
        );
        if (!sessionRestored) {
          this.error =
            'Sign-in succeeded, but the session could not be restored. Please try again.';
          return;
        }
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
        'owner-console',
        true
      );

      if (result.success) {
        if (result.token) {
          this.authService.setToken(result.token);
        }
        await firstValueFrom(this.authService.restoreSession());
        this.router.navigate(['/dashboard']);
      } else if (result.needsRegistration && result.userData) {
        this.error =
          'This OAuth account is not authorized for the Owner Console. Ask an existing operator to have this account provisioned for access.';
      } else {
        this.error = result.error || 'OAuth login failed. Please try again.';
      }
    } catch (err: any) {
      this.error = err.message || 'OAuth login failed. Please try again.';
    }
  }
}

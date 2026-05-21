import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import {
  LoginBlockComponent,
  OAuthProviderEvent,
  OAuthService,
} from '@optimistic-tanuki/auth-ui';
import { LoginType } from '@optimistic-tanuki/ui-models';
import { AuthStateService } from '../../services/auth-state.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, LoginBlockComponent, RouterModule],
  template: `
    <section class="auth-shell">
      <div class="auth-story">
        <p class="eyebrow">Towne Square</p>
        <h1>Your city, your people, your next block-level update.</h1>
        <p class="lede">
          Sign in to join neighborhood conversations, browse local communities,
          and take part in the civic pulse around you.
        </p>
        <div class="story-card">
          <img
            src="assets/ts.png"
            alt="Towne Square neighborhood illustration"
          />
          <div>
            <strong>Live local.</strong>
            <span
              >Jump back into communities, events, classifieds, and city
              posts.</span
            >
          </div>
        </div>
      </div>
      <div class="auth-panel">
        <lib-login-block
          title="Welcome to Towne Square"
          description="Sign in to join communities and connect with your neighbors."
          heroSrc="assets/ts.png"
          heroAlt="Towne Square neighborhood illustration"
          (submitEvent)="onLogin($event)"
          (oauthProviderSelected)="onOAuthProvider($event)"
        ></lib-login-block>
        @if (error) {
        <p class="error-message" role="alert">{{ error }}</p>
        }
        <p class="register-link">
          Don't have an account?
          <a routerLink="/register">Create one</a>
        </p>
      </div>
    </section>
  `,
  styles: [
    `
      .auth-shell {
        min-height: 100vh;
        display: grid;
        grid-template-columns: minmax(0, 30rem) minmax(20rem, 34rem);
        gap: 2.5rem;
        align-items: center;
        justify-content: center;
        padding: 2rem 1rem 3rem;
        background: radial-gradient(
            circle at top right,
            rgba(47, 123, 255, 0.14),
            transparent 24rem
          ),
          linear-gradient(180deg, #f7fbff 0%, #edf6f2 100%);
      }
      .auth-story {
        display: grid;
        gap: 1rem;
        color: #163142;
      }
      .eyebrow {
        margin: 0;
        font-size: 0.8rem;
        font-weight: 800;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: #1d7a63;
      }
      h1 {
        margin: 0;
        font-size: clamp(2.2rem, 5vw, 4.1rem);
        line-height: 0.96;
        letter-spacing: -0.04em;
      }
      .lede {
        margin: 0;
        line-height: 1.7;
        color: rgba(22, 49, 66, 0.78);
      }
      .story-card {
        display: grid;
        grid-template-columns: 5.5rem 1fr;
        gap: 1rem;
        align-items: center;
        padding: 1rem;
        border-radius: 1.2rem;
        background: rgba(255, 255, 255, 0.72);
        border: 1px solid rgba(22, 49, 66, 0.08);
        box-shadow: 0 18px 36px rgba(44, 91, 87, 0.1);
      }
      .story-card img {
        width: 100%;
        border-radius: 1rem;
        background: #fff;
      }
      .story-card div {
        display: grid;
        gap: 0.35rem;
      }
      .story-card strong {
        font-size: 1rem;
      }
      .story-card span {
        color: rgba(22, 49, 66, 0.74);
        line-height: 1.5;
      }
      .auth-panel {
        display: grid;
        gap: 0.9rem;
      }
      .error-message {
        color: var(--error, #d32f2f);
        text-align: center;
        margin: 0;
      }
      .register-link {
        text-align: center;
        margin: 0;
        font-size: 0.9rem;
        a {
          color: var(--primary, #3f51b5);
          font-weight: 600;
          text-decoration: none;
          &:hover {
            text-decoration: underline;
          }
        }
      }
      @media (max-width: 960px) {
        .auth-shell {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class LoginComponent {
  private authState = inject(AuthStateService);
  private http = inject(HttpClient);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private oauthService = new OAuthService(this.http, '/api');

  error: string | null = null;

  constructor() {
    void this.loadOAuthConfig();
  }

  private async loadOAuthConfig(): Promise<void> {
    try {
      const config: any = await this.http.get('/api/oauth/config').toPromise();
      if (config) {
        this.oauthService.configureProviders(config);
      }
    } catch {
      // Keep default provider config when the endpoint is unavailable.
    }
  }

  async onLogin(credentials: LoginType): Promise<void> {
    this.error = null;
    try {
      await this.authState.login(credentials.email, credentials.password);
      const returnUrl =
        this.route.snapshot.queryParamMap.get('returnUrl') || '/';
      this.router.navigateByUrl(returnUrl);
    } catch {
      this.error = 'Invalid email or password. Please try again.';
    }
  }

  async onOAuthProvider(event: OAuthProviderEvent): Promise<void> {
    this.error = null;

    try {
      const result = await this.oauthService.initiateOAuthLogin(
        event.provider,
        'local-hub'
      );

      if (result.success && result.token) {
        this.authState.setToken(result.token);
        const returnUrl =
          this.route.snapshot.queryParamMap.get('returnUrl') || '/';
        await this.router.navigateByUrl(returnUrl);
        return;
      }

      if (result.needsRegistration && result.userData) {
        const names = result.userData.displayName.split(' ');
        const regResult = await this.oauthService.completeOAuthRegistration(
          result.userData.provider,
          result.userData.providerUserId,
          result.userData.email,
          names[0] || '',
          names.slice(1).join(' ') || '',
          ''
        );

        if (regResult.success && regResult.token) {
          this.authState.setToken(regResult.token);
          const returnUrl =
            this.route.snapshot.queryParamMap.get('returnUrl') || '/';
          await this.router.navigateByUrl(returnUrl);
          return;
        }

        this.error = regResult.error || 'OAuth login failed. Please try again.';
      }
    } catch {
      this.error = 'OAuth login failed. Please try again.';
    }
  }
}

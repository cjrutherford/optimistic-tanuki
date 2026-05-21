import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import {
  OAuthProviderEvent,
  OAuthService,
  RegisterBlockComponent,
} from '@optimistic-tanuki/auth-ui';
import {
  RegisterSubmitType,
  submitTypeToRegisterRequest,
} from '@optimistic-tanuki/ui-models';
import { AuthenticationService } from '../../services/authentication.service';
import { AuthStateService } from '../../services/auth-state.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, RegisterBlockComponent],
  template: `
    <section class="auth-shell">
      <div class="auth-story">
        <p class="eyebrow">Towne Square</p>
        <h1>Create your account and start showing up where you live.</h1>
        <p class="lede">
          Register once to join city communities, neighborhood groups, and local
          conversations across the Towne Square network.
        </p>
        <div class="story-card">
          <img
            src="assets/ts.png"
            alt="Towne Square neighborhood illustration"
          />
          <div>
            <strong>Plug into the block.</strong>
            <span
              >Find nearby people, local listings, and conversations that feel
              grounded.</span
            >
          </div>
        </div>
      </div>
      <div class="auth-panel">
        <lib-register-block
          registerHeader="Join Towne Square"
          callToAction="Create an account to join local communities."
          heroSource="assets/ts.png"
          (submitEvent)="onRegister($event)"
          (oauthProviderSelected)="onOAuthProvider($event)"
        ></lib-register-block>
        @if (error) {
        <p class="error-message" role="alert">{{ error }}</p>
        }
        <p class="login-link">
          Already have an account?
          <a href="/login">Sign in</a>
        </p>
      </div>
    </section>
  `,
  styles: [
    `
      .auth-shell {
        min-height: 100vh;
        display: grid;
        grid-template-columns: minmax(0, 30rem) minmax(20rem, 35rem);
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
      .login-link {
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
export class RegisterComponent {
  private authService = inject(AuthenticationService);
  private authState = inject(AuthStateService);
  private http = inject(HttpClient);
  private router = inject(Router);
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

  async onOAuthProvider(event: OAuthProviderEvent): Promise<void> {
    this.error = null;

    try {
      const result = await this.oauthService.initiateOAuthLogin(
        event.provider,
        'local-hub'
      );

      if (result.success && result.token) {
        this.authState.setToken(result.token);
        await this.router.navigate(['/']);
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
          await this.router.navigate(['/']);
          return;
        }

        this.error =
          regResult.error || 'OAuth registration failed. Please try again.';
      }
    } catch {
      this.error = 'OAuth registration failed. Please try again.';
    }
  }
}

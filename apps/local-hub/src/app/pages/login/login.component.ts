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
    <div class="login-page">
      <lib-login-block
        title="Welcome to Towne Square"
        description="Sign in to join communities and connect with your neighbors."
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
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/';
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

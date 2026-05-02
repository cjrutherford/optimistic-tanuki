import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import {
  OAuthProviderEvent,
  OAuthService,
  RegisterBlockComponent,
} from '@optimistic-tanuki/auth-ui';
import { RegisterSubmitType, submitTypeToRegisterRequest } from '@optimistic-tanuki/ui-models';
import { AuthenticationService } from '../../services/authentication.service';
import { AuthStateService } from '../../services/auth-state.service';

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

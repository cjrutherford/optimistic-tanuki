import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import {
  LoginBlockComponent,
  OAuthProviderEvent,
  OAuthService,
} from '@optimistic-tanuki/auth-ui';
import { AuthenticationService } from '../../services/authentication.service';
import { AuthStateService } from '../../services/auth-state.service';

interface LoginType {
  email: string;
  password: string;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, LoginBlockComponent],
  template: `
    <div class="login-page">
      <lib-login-block
        [title]="'Welcome Back'"
        [description]="'Sign in to continue your wellness journey'"
        [heroSrc]="
          'https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=800&q=80'
        "
        [heroAlt]="'Wellness journey'"
        (submitEvent)="onLogin($event)"
        (oauthProviderSelected)="onOAuthProvider($event)"
      >
      </lib-login-block>

      @if (error()) {
      <div class="error-toast">
        {{ error() }}
      </div>
      }
    </div>
  `,
  styles: [
    `
      .login-page {
        min-height: 100vh;
        background: var(--background, #ffffff);
      }

      .error-toast {
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--error, #ef4444);
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 1000;
        animation: slideUp 0.3s ease;
      }

      @keyframes slideUp {
        from {
          opacity: 0;
          transform: translateX(-50%) translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
      }
    `,
  ],
})
export class LoginComponent {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthenticationService);
  private readonly authState = inject(AuthStateService);
  private readonly http = inject(HttpClient);
  private readonly oauthService = new OAuthService(this.http, '/api');

  error = signal<string | null>(null);

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

  onLogin(credentials: LoginType): void {
    this.error.set(null);

    this.authService.login(credentials).subscribe({
      next: (response) => {
        this.authService.setAuthToken(response.data.newToken);
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.error.set(err.error?.message || 'Login failed. Please try again.');
        // Auto-clear error after 5 seconds
        setTimeout(() => this.error.set(null), 5000);
      },
    });
  }

  async onOAuthProvider(event: OAuthProviderEvent): Promise<void> {
    this.error.set(null);

    try {
      const result = await this.oauthService.initiateOAuthLogin(
        event.provider,
        'd6'
      );

      if (result.success && result.token) {
        this.authState.setToken(result.token);
        await this.router.navigate(['/dashboard']);
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
          await this.router.navigate(['/dashboard']);
          return;
        }

        this.error.set(
          regResult.error || 'Registration failed. Please try again.'
        );
      }
    } catch (err: any) {
      this.error.set(err.error?.message || err.message || 'Login failed.');
    }
  }
}

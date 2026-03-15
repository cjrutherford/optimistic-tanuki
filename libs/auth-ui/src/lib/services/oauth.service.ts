import { Injectable, Inject, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, fromEvent, Subscription } from 'rxjs';
import { filter, take, timeout } from 'rxjs/operators';

export interface OAuthProviderConfig {
  clientId: string;
  redirectUri: string;
  scopes: string[];
  authorizationEndpoint: string;
  enabled: boolean;
}

export interface OAuthPopupResult {
  success: boolean;
  code?: string;
  state?: string;
  error?: string;
  errorDescription?: string;
}

export interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
}

export interface OAuthUserInfo {
  id: string;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  picture?: string;
}

export interface OAuthLoginResult {
  success: boolean;
  token?: string;
  needsRegistration?: boolean;
  userData?: {
    provider: string;
    providerUserId: string;
    email: string;
    displayName: string;
  };
  error?: string;
}

@Injectable({
  providedIn: 'root',
})
export class OAuthService {
  private popup: Window | null = null;
  private messageSubscription: Subscription | null = null;
  private readonly popupFeatures =
    'width=500,height=600,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes';

  // OAuth provider configurations - these would typically come from a config service
  private providerConfigs: Record<string, OAuthProviderConfig> = {
    google: {
      clientId: '',
      redirectUri: '',
      scopes: ['openid', 'email', 'profile'],
      authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      enabled: true,
    },
    github: {
      clientId: '',
      redirectUri: '',
      scopes: ['read:user', 'user:email'],
      authorizationEndpoint: 'https://github.com/login/oauth/authorize',
      enabled: true,
    },
    microsoft: {
      clientId: '',
      redirectUri: '',
      scopes: ['openid', 'email', 'profile', 'User.Read'],
      authorizationEndpoint:
        'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      enabled: true,
    },
    facebook: {
      clientId: '',
      redirectUri: '',
      scopes: ['email', 'public_profile'],
      authorizationEndpoint: 'https://www.facebook.com/v18.0/dialog/oauth',
      enabled: true,
    },
  };
  private readonly platformId: object = inject(PLATFORM_ID);

  constructor(
    private http: HttpClient,
    @Inject('API_BASE_URL') private apiBaseUrl: string,
  ) {
    if (isPlatformBrowser(this.platformId)) {
      Object.keys(this.providerConfigs).forEach(key => {
        this.providerConfigs[key].redirectUri = `${window.location.origin}/oauth/callback`;
      });
    }
  }

  /**
   * Configure OAuth providers with client IDs and settings
   */
  configureProviders(
    configs: Record<string, Partial<OAuthProviderConfig>>
  ): void {
    Object.keys(configs).forEach((provider) => {
      if (this.providerConfigs[provider]) {
        this.providerConfigs[provider] = {
          ...this.providerConfigs[provider],
          ...configs[provider],
        };
      }
    });
  }

  /**
   * Check if a provider is enabled and configured
   */
  isProviderEnabled(provider: string): boolean {
    const config = this.providerConfigs[provider];
    return config?.enabled && !!config?.clientId;
  }

  /**
   * Get list of enabled providers
   */
  getEnabledProviders(): string[] {
    return Object.keys(this.providerConfigs).filter((provider) =>
      this.isProviderEnabled(provider)
    );
  }

  /**
   * Initiate OAuth login with popup
   */
  initiateOAuthLogin(provider: string): Promise<OAuthLoginResult> {
    return new Promise((resolve, reject) => {
      const config = this.providerConfigs[provider];

      if (!config) {
        reject(new Error(`Unknown OAuth provider: ${provider}`));
        return;
      }

      if (!config.enabled) {
        reject(new Error(`OAuth provider ${provider} is not enabled`));
        return;
      }

      if (!config.clientId) {
        reject(new Error(`OAuth provider ${provider} is not configured`));
        return;
      }

      // Generate and store state parameter for CSRF protection
      const state = this.generateState();
      sessionStorage.setItem('oauth_state', state);
      sessionStorage.setItem('oauth_provider', provider);

      // Build authorization URL
      const authUrl = this.buildAuthorizationUrl(provider, config, state);

      // Open popup
      this.popup = window.open(authUrl, 'oauth-popup', this.popupFeatures);

      if (!this.popup) {
        reject(
          new Error(
            'Failed to open OAuth popup. Please check if popups are blocked.'
          )
        );
        return;
      }

      // Listen for messages from popup
      this.messageSubscription = fromEvent<MessageEvent>(window, 'message')
        .pipe(
          filter((event) => {
            // Only accept messages from our origin
            return event.origin === window.location.origin;
          }),
          filter((event) => {
            // Check if this is an OAuth callback message
            return event.data && event.data.type === 'oauth-callback';
          }),
          take(1),
          timeout(300000) // 5 minute timeout
        )
        .subscribe({
          next: async (event) => {
            this.closePopup();
            const result: OAuthPopupResult = event.data.payload;

            if (!result.success) {
              resolve({
                success: false,
                error: result.error || 'OAuth authentication failed',
              });
              return;
            }

            // Verify state matches
            const storedState = sessionStorage.getItem('oauth_state');
            if (result.state !== storedState) {
              resolve({
                success: false,
                error: 'Invalid state parameter. Possible CSRF attack.',
              });
              return;
            }

            // Clear stored state
            sessionStorage.removeItem('oauth_state');
            sessionStorage.removeItem('oauth_provider');

            // Call backend OAuth callback endpoint
            try {
              const loginResult = await this.handleOAuthCallback(
                provider,
                result.code!
              );
              resolve(loginResult);
            } catch (error: any) {
              resolve({
                success: false,
                error: error.message || 'Failed to complete OAuth login',
              });
            }
          },
          error: (error) => {
            this.closePopup();
            sessionStorage.removeItem('oauth_state');
            sessionStorage.removeItem('oauth_provider');
            resolve({
              success: false,
              error: 'OAuth authentication timed out or was cancelled',
            });
          },
        });

      // Also poll to check if popup was closed manually
      const checkClosed = setInterval(() => {
        if (this.popup && this.popup.closed) {
          clearInterval(checkClosed);
          if (this.messageSubscription) {
            this.messageSubscription.unsubscribe();
            this.messageSubscription = null;
          }
          resolve({
            success: false,
            error: 'OAuth popup was closed before completing authentication',
          });
        }
      }, 500);
    });
  }

  /**
   * Build authorization URL for OAuth provider
   */
  private buildAuthorizationUrl(
    provider: string,
    config: OAuthProviderConfig,
    state: string
  ): string {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: config.scopes.join(' '),
      state: state,
    });

    // Add provider-specific parameters
    if (provider === 'google') {
      params.append('prompt', 'select_account');
    }

    return `${config.authorizationEndpoint}?${params.toString()}`;
  }

  /**
   * Handle OAuth callback by calling backend
   */
  private async handleOAuthCallback(
    provider: string,
    code: string
  ): Promise<OAuthLoginResult> {
    try {
      const response: any = await this.http
        .post(`${this.apiBaseUrl}/oauth/callback`, {
          provider,
          code,
          redirectUri: this.providerConfigs[provider].redirectUri,
        })
        .toPromise();

      if (response.code === 0 && response.data?.newToken) {
        return {
          success: true,
          token: response.data.newToken,
        };
      }

      // Check if user needs to complete registration
      if (response.code === 1 && response.data?.needsRegistration) {
        return {
          success: false,
          needsRegistration: true,
          userData: {
            provider: response.data.provider,
            providerUserId: response.data.providerUserId,
            email: response.data.email,
            displayName: response.data.displayName,
          },
        };
      }

      return {
        success: false,
        error: response.message || 'OAuth login failed',
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.error?.message || error.message || 'OAuth login failed',
      };
    }
  }

  /**
   * Complete registration for OAuth user
   */
  async completeOAuthRegistration(
    provider: string,
    providerUserId: string,
    email: string,
    firstName: string,
    lastName: string,
    code: string
  ): Promise<OAuthLoginResult> {
    try {
      // First, auto-register the user
      const regResponse: any = await this.http
        .post(`${this.apiBaseUrl}/authentication/register`, {
          email,
          fn: firstName,
          ln: lastName,
          password: '', // OAuth users don't have passwords initially
          confirm: '',
          bio: '',
        })
        .toPromise();

      if (regResponse.code !== 0) {
        return {
          success: false,
          error: regResponse.message || 'Registration failed',
        };
      }

      // Then link the OAuth provider and login
      const loginResponse: any = await this.http
        .post(`${this.apiBaseUrl}/oauth/callback`, {
          provider,
          code,
          redirectUri: this.providerConfigs[provider].redirectUri,
        })
        .toPromise();

      if (loginResponse.code === 0 && loginResponse.data?.newToken) {
        return {
          success: true,
          token: loginResponse.data.newToken,
        };
      }

      return {
        success: false,
        error:
          loginResponse.message ||
          'Failed to complete OAuth login after registration',
      };
    } catch (error: any) {
      return {
        success: false,
        error:
          error.error?.message ||
          error.message ||
          'Failed to complete registration',
      };
    }
  }

  /**
   * Close the OAuth popup window
   */
  private closePopup(): void {
    if (this.popup && !this.popup.closed) {
      this.popup.close();
    }
    this.popup = null;
    if (this.messageSubscription) {
      this.messageSubscription.unsubscribe();
      this.messageSubscription = null;
    }
  }

  /**
   * Generate random state parameter for CSRF protection
   */
  private generateState(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join(
      ''
    );
  }
}

export { OAuthService as AuthUiOAuthService };

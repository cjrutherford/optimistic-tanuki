import { Injectable, Inject, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { fromEvent, Subscription } from 'rxjs';
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
  token?: string;
  error?: string;
  errorDescription?: string;
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

export interface OAuthUserInfo {
  id: string;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  picture?: string;
}

@Injectable({
  providedIn: 'root',
})
export class OAuthService {
  private popup: Window | null = null;
  private messageSubscription: Subscription | null = null;
  private readonly popupFeatures =
    'width=500,height=600,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes';

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
    @Inject('API_BASE_URL') private apiBaseUrl: string
  ) {}

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

  isProviderEnabled(provider: string): boolean {
    const config = this.providerConfigs[provider];
    return config?.enabled && !!config?.clientId;
  }

  getEnabledProviders(): string[] {
    return Object.keys(this.providerConfigs).filter((provider) =>
      this.isProviderEnabled(provider)
    );
  }

  initiateOAuthLogin(
    provider: string,
    appScope?: string
  ): Promise<OAuthLoginResult> {
    return new Promise((resolve, reject) => {
      if (!isPlatformBrowser(this.platformId)) {
        reject(new Error('OAuth login is only available in the browser.'));
        return;
      }

      const config = this.providerConfigs[provider];
      if (!config) {
        reject(new Error(`Unknown OAuth provider: ${provider}`));
        return;
      }

      if (!config.enabled || !config.clientId) {
        reject(new Error(`OAuth provider ${provider} is not configured`));
        return;
      }

      const startUrl = this.buildStartUrl(provider, appScope);
      this.popup = window.open(startUrl, 'oauth-popup', this.popupFeatures);
      if (!this.popup) {
        reject(
          new Error(
            'Failed to open OAuth popup. Please check if popups are blocked.'
          )
        );
        return;
      }

      this.messageSubscription = fromEvent<MessageEvent>(window, 'message')
        .pipe(
          filter((event) => event.origin === window.location.origin),
          filter(
            (event) => event.data && event.data.type === 'oauth-callback'
          ),
          take(1),
          timeout(300000)
        )
        .subscribe({
          next: (event) => {
            this.closePopup();
            const result = event.data.payload as OAuthPopupResult;
            if (result.success && result.token) {
              resolve({ success: true, token: result.token });
              return;
            }

            resolve({
              success: false,
              error:
                result.errorDescription ||
                result.error ||
                'OAuth authentication failed',
            });
          },
          error: () => {
            this.closePopup();
            resolve({
              success: false,
              error: 'OAuth authentication timed out or was cancelled',
            });
          },
        });

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
      }, 1000);
    });
  }

  async completeOAuthRegistration(
    _provider?: string,
    _providerUserId?: string,
    _email?: string,
    _firstName?: string,
    _lastName?: string,
    _bio?: string
  ): Promise<OAuthLoginResult> {
    return {
      success: false,
      error:
        'OAuth registration is handled by the shared server callback and should not be called client-side.',
    };
  }

  private buildStartUrl(provider: string, appScope?: string): string {
    const startUrl = new URL(
      `${this.apiBaseUrl}/oauth/start/${encodeURIComponent(provider)}`,
      window.location.origin
    );
    startUrl.searchParams.set(
      'returnTo',
      `${window.location.origin}${window.location.pathname}${window.location.search}${window.location.hash}`
    );
    if (appScope?.trim()) {
      startUrl.searchParams.set('appScope', appScope.trim());
    }
    return startUrl.toString();
  }

  private closePopup(): void {
    if (this.messageSubscription) {
      this.messageSubscription.unsubscribe();
      this.messageSubscription = null;
    }
    if (this.popup && !this.popup.closed) {
      this.popup.close();
    }
    this.popup = null;
  }
}

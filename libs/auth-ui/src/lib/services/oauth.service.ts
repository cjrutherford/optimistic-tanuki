import { Injectable, Inject, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, fromEvent, Subscription } from 'rxjs';
import { filter, take, timeout } from 'rxjs/operators';

export interface OAuthProviderConfig {
  clientId: string;
  redirectUri: string;
  scopes: string[];
  authorizationEndpoint: string;
  enabled: boolean;
  /** Server-advertised origin of the shared callback proxy. */
  callbackOrigin?: string;
}

export interface OAuthPopupResult {
  success: boolean;
  token?: string;
  /** The gateway completed authentication using an HttpOnly session cookie. */
  session?: boolean;
  /** One-time grant to be redeemed by the initiating app's API origin. */
  callbackCode?: string;
  error?: string;
  errorDescription?: string;
}

export interface OAuthLoginResult {
  success: boolean;
  token?: string;
  /** The initiating app must restore its session before navigating. */
  session?: boolean;
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
    appScope?: string,
    cookieSession = false
  ): Promise<OAuthLoginResult> {
    return new Promise((resolve, reject) => {
      let checkClosed: ReturnType<typeof setInterval> | null = null;
      let closeGracePeriod: ReturnType<typeof setTimeout> | null = null;
      let sessionRecoveryPoll: ReturnType<typeof setInterval> | null = null;
      let settled = false;
      const finish = (result: OAuthLoginResult, closePopup = true): void => {
        if (settled) return;
        settled = true;
        if (checkClosed) clearInterval(checkClosed);
        if (closeGracePeriod) clearTimeout(closeGracePeriod);
        if (sessionRecoveryPoll) clearInterval(sessionRecoveryPoll);
        if (closePopup) this.closePopup();
        else if (this.messageSubscription) {
          this.messageSubscription.unsubscribe();
          this.messageSubscription = null;
          this.popup = null;
        }
        resolve(result);
      };
      const recoverCookieSession = (): void => {
        const checkSession = async (): Promise<void> => {
          if (settled) {
            if (sessionRecoveryPoll) clearInterval(sessionRecoveryPoll);
            return;
          }
          try {
            await firstValueFrom(
              this.http.get(`${this.apiBaseUrl}/authentication/session`, {
                withCredentials: true,
              })
            );
            finish({ success: true, session: true }, false);
          } catch {
            // The callback may still be redeeming its one-time grant. Keep
            // this recovery check scoped to this active popup attempt.
          }
        };

        sessionRecoveryPoll = setInterval(() => {
          void checkSession();
        }, 1000);
        void checkSession();
      };

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

      const callbackOrigin = this.resolveCallbackOrigin(config.callbackOrigin);

      // Subscribe before opening the popup. Providers can complete quickly
      // (and local/test providers often do), so opening first can lose the
      // callback's one-shot postMessage before this window is listening.
      this.messageSubscription = fromEvent<MessageEvent>(window, 'message')
        .pipe(
          filter((event) => event.origin === callbackOrigin),
          filter((event) => event.data && event.data.type === 'oauth-callback'),
          take(1),
          timeout(300000)
        )
        .subscribe({
          next: (event) => {
            const result = event.data.payload as OAuthPopupResult;
            if (result.success && result.callbackCode) {
              void firstValueFrom(
                this.http.post<{
                  token?: string;
                  session?: true;
                  returnOrigin?: string;
                }>(
                  `${this.apiBaseUrl}/oauth/callback/redeem`,
                  { callbackCode: result.callbackCode },
                  {
                    withCredentials: true,
                    ...(cookieSession
                      ? { headers: { 'X-ot-session-mode': 'cookie' } }
                      : {}),
                  }
                )
              )
                .then((redemption) => {
                  if (redemption.returnOrigin !== window.location.origin) {
                    finish({
                      success: false,
                      error: 'OAuth callback origin mismatch',
                    });
                    return;
                  }
                  finish({
                    success: true,
                    session: redemption.session === true,
                    ...(redemption.token ? { token: redemption.token } : {}),
                  });
                })
                .catch(() =>
                  finish({
                    success: false,
                    error: 'OAuth session could not be restored',
                  })
                );
              return;
            }
            if (result.success && (result.token || result.session)) {
              finish({
                success: true,
                token: result.token,
                session: result.session,
              });
              return;
            }

            if (result.success && result.session) {
              finish({ success: true, session: true });
              return;
            }

            finish({
              success: false,
              error:
                result.errorDescription ||
                result.error ||
                'OAuth authentication failed',
            });
          },
          error: () => {
            finish({
              success: false,
              error: 'OAuth authentication timed out or was cancelled',
            });
          },
        });

      const startUrl = this.buildStartUrl(provider, appScope, cookieSession);
      const popupName = `oauth-popup-${Date.now()}`;
      this.popup = window.open(startUrl, popupName, this.popupFeatures);
      if (!this.popup) {
        this.messageSubscription.unsubscribe();
        this.messageSubscription = null;
        reject(
          new Error(
            'Failed to open OAuth popup. Please check if popups are blocked.'
          )
        );
        return;
      }

      checkClosed = setInterval(() => {
        if (this.popup && this.popup.closed) {
          if (checkClosed) clearInterval(checkClosed);
          // Browsers can report a live cross-origin OAuth popup as closed
          // while it navigates back to this origin. Give its callback message
          // a chance to arrive before treating this as user cancellation.
          closeGracePeriod = setTimeout(() => {
            if (cookieSession) {
              // A cross-origin provider can falsely report this popup as
              // closed while the user is still authenticating. If it was a
              // real close and the callback redeemed the grant, recover the
              // cookie session without relying solely on postMessage.
              recoverCookieSession();
              return;
            }
            finish(
              {
                success: false,
                error:
                  'OAuth popup was closed before completing authentication',
              },
              false
            );
          }, 1500);
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

  private buildStartUrl(
    provider: string,
    appScope?: string,
    cookieSession = false
  ): string {
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
    if (cookieSession) {
      startUrl.searchParams.set('sessionMode', 'cookie');
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

  private resolveCallbackOrigin(configuredOrigin?: string): string {
    if (!configuredOrigin) return window.location.origin;
    try {
      return new URL(configuredOrigin).origin;
    } catch {
      return window.location.origin;
    }
  }
}

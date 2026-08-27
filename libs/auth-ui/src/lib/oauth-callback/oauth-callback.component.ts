import { Component, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { DOCUMENT, isPlatformBrowser, CommonModule } from '@angular/common';
import { ActivatedRoute, Route, Router } from '@angular/router';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'lib-oauth-callback',
  standalone: true,
  imports: [CommonModule],
  template: `
    <meta name="referrer" content="no-referrer" />
    <div class="oauth-callback-container">
      <div *ngIf="!error" class="loading">
        <h2>Completing authentication...</h2>
        <p>Please wait while we process your login.</p>
        <div class="spinner"></div>
      </div>
      <div *ngIf="error" class="error">
        <h2>Authentication Failed</h2>
        <p>{{ error }}</p>
        <p class="subtext">You can close this window and try again.</p>
      </div>
    </div>
  `,
  styles: [
    `
      .oauth-callback-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        padding: 20px;
        text-align: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
          Oxygen, Ubuntu, sans-serif;
      }

      .loading h2,
      .error h2 {
        margin: 0 0 10px;
        font-size: 24px;
      }

      .loading p,
      .error p {
        margin: 0 0 20px;
        color: var(--foreground-muted);
      }

      .error h2 {
        color: var(--danger);
      }

      .subtext {
        font-size: 14px;
        color: var(--foreground-muted);
      }

      .spinner {
        width: 40px;
        height: 40px;
        border: 3px solid var(--border);
        border-top-color: var(--primary);
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }

      @keyframes spin {
        0% {
          transform: rotate(0deg);
        }
        100% {
          transform: rotate(360deg);
        }
      }
    `,
  ],
})
export class OAuthCallbackComponent implements OnInit {
  error: string | null = null;
  private platformId = inject(PLATFORM_ID);
  private readonly router = inject(Router);
  private readonly apiBaseUrl =
    inject(API_BASE_URL, { optional: true }) ?? '/api';
  private readonly document = inject(DOCUMENT);
  private readonly http = inject(HttpClient, { optional: true });

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    // Parse query parameters from URL
    this.route.queryParams.subscribe(
      (params) => void this.handleParams(params)
    );
  }

  private async handleParams(
    params: Record<string, string | undefined>
  ): Promise<void> {
    const provider = this.route.snapshot.paramMap.get('provider');
    const callbackCode = params['callbackCode'];
    const returnTo = params['returnTo'];
    const code = params['code'];
    const state = params['state'];
    const error = params['error'];
    const errorDescription = params['error_description'];

    if (provider && (code || error)) {
      const query = new URLSearchParams(this.document.location.search);
      this.document.location.replace(
        `${this.apiBaseUrl}/oauth/callback/${encodeURIComponent(
          provider
        )}?${query.toString()}`
      );
      return;
    }

    if (error) {
      this.error = errorDescription || error;
      this.sendMessageToParent({
        type: 'oauth-callback',
        payload: {
          success: false,
          token: undefined,
          error: error,
          errorDescription: errorDescription,
        },
      });
      return;
    }

    if (!callbackCode) {
      this.error = 'No authentication callback code received';
      this.sendMessageToParent({
        type: 'oauth-callback',
        payload: {
          success: false,
          error: 'No authentication callback code received',
        },
      });
      return;
    }

    this.removeCallbackParametersFromHistory();
    this.sendMessageToParent(
      {
        type: 'oauth-callback',
        payload: {
          success: true,
          callbackCode,
        },
      },
      window.location.origin
    );

    if (!window.opener && returnTo) {
      try {
        const target = new URL(returnTo, window.location.origin);
        if (!this.http || !this.isTrustedReturnOrigin(target.origin)) return;
        const redemption = await firstValueFrom(
          this.http.post<{
            token?: string;
            session?: true;
            returnOrigin?: string;
          }>(
            new URL('/api/oauth/callback/redeem', target.origin).toString(),
            { callbackCode },
            {
              withCredentials: true,
              headers: { 'X-ot-session-mode': 'cookie' },
            }
          )
        );
        if (
          (redemption.session !== true && !redemption.token) ||
          redemption.returnOrigin !== target.origin
        ) {
          throw new Error('No authentication session received');
        }
        this.router.navigateByUrl(
          `${target.pathname}${target.search}${target.hash}`
        );
      } catch {
        // Non-popup callback fallback can remain on the status page.
      }
    }
  }

  private removeCallbackParametersFromHistory(): void {
    const location = this.document.location;
    const currentUrl = new URL(location?.href || window.location.href);
    currentUrl.search = '';
    window.history.replaceState(
      null,
      '',
      `${currentUrl.pathname}${currentUrl.hash}`
    );
  }

  private isTrustedReturnOrigin(origin: string | undefined): origin is string {
    if (!origin) return false;
    try {
      return new URL(origin).origin === origin;
    } catch {
      return false;
    }
  }

  private sendMessageToParent(
    message: any,
    targetOrigin = window.location.origin
  ): void {
    if (window.opener) {
      window.opener.postMessage(message, targetOrigin);
      // Close the popup after a short delay to allow the message to be processed
      setTimeout(() => {
        window.close();
      }, 1000);
    } else if (message?.payload?.success) {
      // Cookie-mode callers can restore the session after observing the popup
      // close even when browser cross-origin isolation removes window.opener.
      setTimeout(() => window.close(), 1000);
    } else if (!message?.payload?.success) {
      this.error ??= 'Unable to communicate with parent window';
    }
  }
}

export const oauthCallbackRoutes: readonly Route[] = [
  { path: 'oauth/callback', component: OAuthCallbackComponent },
  {
    path: 'oauth/callback/:provider',
    component: OAuthCallbackComponent,
  },
];

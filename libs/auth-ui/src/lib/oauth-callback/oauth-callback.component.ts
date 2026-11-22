import { Component, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { DOCUMENT, isPlatformBrowser, CommonModule } from '@angular/common';
import { ActivatedRoute, Route, Router } from '@angular/router';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { normalizeAuthReturnTo } from './oauth-return';
import { describeOAuthError } from './oauth-errors';
import {
  DateOfBirthStepComponent,
  DateOfBirthStepResult,
} from '../age-gate/date-of-birth-step.component';

type CallbackView =
  | 'working'
  | 'link'
  | 'age'
  | 'check-email'
  | 'guardian'
  | 'error';

interface PendingInfo {
  kind?: string;
  provider?: string;
  maskedEmail?: string;
  methods?: string[];
}

interface PendingGrant {
  callbackCode?: string;
  returnTo?: string;
  verificationRequired?: boolean;
  error?: string;
  attemptsRemaining?: number;
  data?: { guardianConsentPending?: boolean };
}

const MAX_LINK_ATTEMPTS = 5;

@Component({
  selector: 'lib-oauth-callback',
  standalone: true,
  imports: [CommonModule, FormsModule, DateOfBirthStepComponent],
  template: `
    <meta name="referrer" content="no-referrer" />
    <div class="oauth-callback-container">
      @switch (view) { @case ('working') {
      <div class="loading">
        <h2>Completing authentication...</h2>
        <p>Please wait while we process your login.</p>
        <div class="spinner"></div>
      </div>
      } @case ('link') {
      <section class="step" aria-labelledby="link-title">
        <h2 id="link-title">Link your {{ providerLabel }} account</h2>
        <p>
          An account already exists for
          <strong>{{ pendingInfo?.maskedEmail }}</strong
          >. Link {{ providerLabel }} to it?
        </p>
        <form (ngSubmit)="submitLink()">
          @if (linkMethod === 'password') {
          <label for="link-password">Password</label>
          <input
            id="link-password"
            name="password"
            type="password"
            autocomplete="current-password"
            required
            [(ngModel)]="password"
          />
          } @else if (!codeSent) {
          <p>We will email a 6-digit code to confirm this is your account.</p>
          <button type="button" [disabled]="busy" (click)="sendEmailCode()">
            Email me a code
          </button>
          } @else {
          <label for="link-code">6-digit code</label>
          <input
            id="link-code"
            name="emailCode"
            inputmode="numeric"
            autocomplete="one-time-code"
            maxlength="6"
            pattern="[0-9]{6}"
            required
            [(ngModel)]="emailCode"
          />
          } @if (stepError) {
          <p class="inline-error" role="alert">{{ stepError }}</p>
          } @if (linkMethod === 'password' || codeSent) {
          <button type="submit" [disabled]="busy">
            Link {{ providerLabel }}
          </button>
          } @if (canChooseMethod) {
          <button
            type="button"
            class="secondary"
            [disabled]="busy"
            (click)="
              chooseLinkMethod(
                linkMethod === 'password' ? 'email_code' : 'password'
              )
            "
          >
            {{
              linkMethod === 'password'
                ? 'Email me a code instead'
                : 'Use my password'
            }}
          </button>
          }
          <button
            type="button"
            class="secondary"
            [disabled]="busy"
            (click)="cancel()"
          >
            Cancel
          </button>
        </form>
      </section>
      } @case ('age') {
      <section class="step" aria-labelledby="age-title">
        <h2 id="age-title">One more step</h2>
        <p>
          Enter your date of birth to finish signing up with
          {{ providerLabel }}.
        </p>
        <lib-date-of-birth-step
          [pending]="busy"
          (submitted)="submitAge($event)"
        ></lib-date-of-birth-step>
        @if (stepError) {
        <p class="inline-error" role="alert">{{ stepError }}</p>
        }
        <button
          type="button"
          class="secondary"
          [disabled]="busy"
          (click)="cancel()"
        >
          Cancel
        </button>
      </section>
      } @case ('check-email') {
      <section class="step" role="status">
        <h2>Check your email</h2>
        <p>
          We sent a message to confirm your address. Open it, then sign in again
          to finish.
        </p>
        <button type="button" class="secondary" (click)="startOver()">
          Back to sign in
        </button>
      </section>
      } @case ('guardian') {
      <section class="step" role="status">
        <h2>Guardian permission needed</h2>
        <p>
          @if (guardianEmail) { We've emailed
          <strong>{{ guardianEmail }}</strong> to ask for permission. You'll be
          able to finish signing in once they approve. } @else { A parent or
          guardian must give permission before you can finish. }
        </p>
        <p>
          When they approve, follow the link in their confirmation to come back
          and sign in with {{ providerLabel }}.
        </p>
        <button type="button" class="secondary" (click)="startOver()">
          Back to sign in
        </button>
      </section>
      } @case ('error') {
      <div class="error">
        <h2>{{ errorView?.title || 'Authentication Failed' }}</h2>
        <p>{{ error }}</p>
        @if (errorView?.action) {
        <p class="subtext">{{ errorView?.action }}</p>
        } @if (errorView?.code) {
        <p class="subtext error-code">Code: {{ errorView?.code }}</p>
        } @if (showStartOver) {
        <button type="button" (click)="startOver()">Start over</button>
        } @else {
        <p class="subtext">You can close this window and try again.</p>
        }
      </div>
      } }
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
        font-family: var(
          --font-body,
          -apple-system,
          BlinkMacSystemFont,
          'Segoe UI',
          Roboto,
          Oxygen,
          Ubuntu,
          sans-serif
        );
      }

      .loading h2,
      .error h2 {
        margin: 0 0 10px;
        font-size: var(--type-h3, 24px);
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
        font-size: var(--type-small, 0.875rem);
        color: var(--foreground-muted);
      }

      .step {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        max-width: 24rem;
        width: 100%;
        text-align: left;
      }

      .step form {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      .step input {
        padding: 0.5rem 0.75rem;
        border: 1px solid var(--border);
        border-radius: var(--personality-input-radius, 4px);
        background: var(--background);
        color: var(--foreground);
        font: inherit;
      }

      .oauth-callback-container button {
        padding: 0.5rem 1rem;
        border: 1px solid var(--primary);
        border-radius: var(--personality-input-radius, 4px);
        background: var(--primary);
        color: var(--background);
        font: inherit;
        cursor: pointer;
      }

      .oauth-callback-container button.secondary {
        background: transparent;
        color: var(--primary);
      }

      .oauth-callback-container button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .inline-error {
        color: var(--danger);
        margin: 0;
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
  errorView: ReturnType<typeof describeOAuthError> | null = null;
  showStartOver = false;
  step: Exclude<CallbackView, 'error'> = 'working';
  pendingInfo: PendingInfo | null = null;
  pendingCode: string | null = null;
  pendingReturnTo: string | undefined;
  linkMethod: 'password' | 'email_code' = 'password';
  linkMethods: string[] = [];
  guardianEmail = '';
  codeSent = false;
  password = '';
  emailCode = '';
  busy = false;
  stepError = '';
  private linkAttempts = 0;
  private providerFromQuery = '';
  private callbackHandled = false;
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
    // The callback grant and provider state are both one-time credentials.
    // Route observables can emit again during navigation, so never relay or
    // redeem the same callback twice from one callback document.
    if (this.callbackHandled) return;
    this.callbackHandled = true;

    const provider = this.route.snapshot.paramMap.get('provider');
    const callbackCode = params['callbackCode'];
    const returnTo = params['returnTo'];
    const code = params['code'];
    const state = params['state'];
    const error = params['error'];
    const errorDescription = params['error_description'];
    const callbackQuery = new URLSearchParams(this.document.location.search);

    this.removeCallbackParametersFromHistory();

    if (provider && (code || error)) {
      const query = callbackQuery.toString();
      this.document.location.replace(
        `${this.apiBaseUrl}/oauth/callback/${encodeURIComponent(provider)}${
          query ? `?${query}` : ''
        }`
      );
      return;
    }

    const pending = params['pending'];
    const pendingCode = params['pendingCode'];
    if (pending && pendingCode && !error) {
      this.providerFromQuery = params['provider'] ?? '';
      await this.beginPending(pending, pendingCode, returnTo);
      return;
    }

    if (error) {
      this.showError(error, errorDescription);
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

    await this.completeWithCallbackCode(callbackCode, returnTo);
  }

  private async completeWithCallbackCode(
    callbackCode: string,
    returnTo: string | undefined
  ): Promise<void> {
    // Sign-in is often started from the login page, so an auth-page returnTo
    // must still redeem; it lands on the site root rather than being refused
    // as an invalid destination.
    const returnTarget = normalizeAuthReturnTo(returnTo, {
      currentOrigin: window.location.origin,
      authLoopFallback: 'origin-root',
    });

    if (window.opener) {
      const expectedOpenerOrigin = returnTo
        ? returnTarget?.origin
        : window.location.origin;
      if (!expectedOpenerOrigin) {
        this.error = 'Invalid authentication return destination';
        return;
      }
      this.sendMessageToParent(
        {
          type: 'oauth-callback',
          payload: {
            success: true,
            callbackCode,
          },
        },
        expectedOpenerOrigin
      );
      return;
    }

    if (!returnTarget || !this.http) {
      this.navigateToSafeFallback();
      return;
    }

    try {
      const redemption = await firstValueFrom(
        this.http.post<{
          token?: string;
          session?: true;
          returnOrigin?: string;
        }>(
          new URL('/api/oauth/callback/redeem', returnTarget.origin).toString(),
          { callbackCode },
          {
            withCredentials: true,
            headers: { 'X-ot-session-mode': 'cookie' },
          }
        )
      );
      if (
        (redemption.session !== true && !redemption.token) ||
        redemption.returnOrigin !== returnTarget.origin
      ) {
        throw new Error('No authentication session received');
      }
      if (returnTarget.isCurrentOrigin) {
        this.router.navigateByUrl(returnTarget.path);
      } else {
        this.document.location.assign(returnTarget.href);
      }
    } catch {
      this.navigateToSafeFallback();
    }
  }

  get view(): CallbackView {
    return this.error ? 'error' : this.step;
  }

  get providerLabel(): string {
    const name = this.pendingInfo?.provider || this.providerFromQuery;
    return name
      ? name.charAt(0).toUpperCase() + name.slice(1)
      : 'your provider';
  }

  private showError(
    code: string | undefined,
    description?: string,
    startOver = false
  ): void {
    this.errorView = describeOAuthError(code, description);
    this.error = this.errorView.message;
    this.showStartOver = startOver;
  }

  private pendingUrl(suffix = ''): string {
    return `${this.apiBaseUrl}/oauth/pending/${encodeURIComponent(
      this.pendingCode ?? ''
    )}${suffix}`;
  }

  private async beginPending(
    kind: string,
    pendingCode: string,
    returnTo: string | undefined
  ): Promise<void> {
    this.pendingCode = pendingCode;
    this.pendingReturnTo = returnTo;
    if (!this.http) {
      this.failPending('oauth_callback_failed');
      return;
    }
    try {
      const info = await firstValueFrom(
        this.http.get<PendingInfo>(this.pendingUrl(), {
          withCredentials: true,
        })
      );
      this.pendingInfo = info;
      const effectiveKind = info.kind || kind;
      if (effectiveKind === 'link_account') {
        this.linkMethods = info.methods ?? [];
        this.linkMethod = info.methods?.includes('password')
          ? 'password'
          : 'email_code';
        this.step = 'link';
      } else if (effectiveKind === 'age_verification') {
        this.step = 'age';
      } else {
        this.failPending('oauth_callback_failed');
      }
    } catch (err) {
      this.failPending(this.codeOf(err, 'pending_expired'), undefined, true);
    }
  }

  get canChooseMethod(): boolean {
    return (
      this.linkMethods.includes('password') &&
      this.linkMethods.includes('email_code')
    );
  }

  chooseLinkMethod(method: 'password' | 'email_code'): void {
    this.linkMethod = method;
    this.stepError = '';
  }

  async sendEmailCode(): Promise<void> {
    if (this.busy || !this.http) return;
    this.busy = true;
    this.stepError = '';
    try {
      await firstValueFrom(
        this.http.post(
          this.pendingUrl('/link/email-code'),
          {},
          {
            withCredentials: true,
          }
        )
      );
      this.codeSent = true;
    } catch (err) {
      this.stepError = describeOAuthError(
        this.codeOf(err, 'oauth_callback_failed')
      ).message;
    } finally {
      this.busy = false;
    }
  }

  async submitLink(): Promise<void> {
    if (this.busy || !this.http) return;
    const body =
      this.linkMethod === 'password'
        ? { password: this.password }
        : { emailCode: this.emailCode.trim() };
    this.busy = true;
    this.stepError = '';
    try {
      const grant = await firstValueFrom(
        this.http.post<PendingGrant>(this.pendingUrl('/link'), body, {
          withCredentials: true,
        })
      );
      if (grant.callbackCode) {
        await this.completePending(grant);
      } else {
        this.failPending('oauth_callback_failed');
      }
    } catch (err) {
      const code = this.codeOf(err, 'oauth_callback_failed');
      if (code === 'link_credentials_invalid') {
        this.linkAttempts += 1;
        const body = (err as { error?: PendingGrant }).error;
        const left = Math.max(
          0,
          body?.attemptsRemaining ?? MAX_LINK_ATTEMPTS - this.linkAttempts
        );
        this.stepError = `${describeOAuthError(code).message} ${
          left === 1 ? '1 attempt' : `${left} attempts`
        } left.`;
      } else if (code === 'link_attempts_exhausted') {
        this.failPending(code, undefined, true);
      } else {
        this.failPending(code, undefined, code === 'pending_expired');
      }
    } finally {
      this.busy = false;
    }
  }

  async submitAge(result: DateOfBirthStepResult): Promise<void> {
    if (this.busy || !this.http) return;
    this.busy = true;
    this.stepError = '';
    try {
      const response = await firstValueFrom(
        this.http.post<PendingGrant>(this.pendingUrl('/age'), result, {
          withCredentials: true,
        })
      );
      await this.handleAgeResponse(response);
    } catch (err) {
      const body = (err as { error?: PendingGrant }).error;
      if (body?.error === 'guardian_consent_required') {
        this.guardianEmail = body.data?.guardianConsentPending
          ? result.guardianEmail ?? ''
          : '';
        this.step = 'guardian';
      } else {
        const code = this.codeOf(err, 'oauth_callback_failed');
        this.failPending(
          code,
          undefined,
          code === 'age_ineligible' || code === 'pending_expired'
        );
      }
    } finally {
      this.busy = false;
    }
  }

  private async handleAgeResponse(response: PendingGrant): Promise<void> {
    if (response.callbackCode) {
      await this.completePending(response);
    } else if (response.verificationRequired) {
      this.step = 'check-email';
    } else if (response.error === 'guardian_consent_required') {
      this.step = 'guardian';
    } else {
      this.failPending(
        response.error || 'oauth_callback_failed',
        undefined,
        true
      );
    }
  }

  async cancel(): Promise<void> {
    if (this.http && this.pendingCode) {
      try {
        await firstValueFrom(
          this.http.post(
            this.pendingUrl('/cancel'),
            {},
            {
              withCredentials: true,
            }
          )
        );
      } catch {
        // The intent expires on its own; the user still leaves this flow.
      }
    }
    this.failPending('oauth_cancelled');
  }

  startOver(): void {
    if (window.opener) {
      this.sendMessageToParent({
        type: 'oauth-callback',
        payload: {
          success: false,
          error: this.errorView?.code ?? 'oauth_cancelled',
        },
      });
      return;
    }
    this.router.navigateByUrl('/login');
  }

  private async completePending(grant: PendingGrant): Promise<void> {
    this.step = 'working';
    await this.completeWithCallbackCode(
      grant.callbackCode as string,
      grant.returnTo ?? this.pendingReturnTo
    );
  }

  /** Shows a mapped error and reports the same code to the opener. */
  private failPending(
    code: string,
    description?: string,
    startOver = false
  ): void {
    this.showError(code, description, startOver);
    this.sendMessageToParent({
      type: 'oauth-callback',
      payload: { success: false, error: code, errorDescription: description },
    });
  }

  private codeOf(err: unknown, fallback: string): string {
    const body = (err as { error?: { error?: unknown; message?: unknown } })
      ?.error;
    const code = body?.error ?? body?.message;
    return typeof code === 'string' && code ? code : fallback;
  }

  private navigateToSafeFallback(): void {
    this.router.navigateByUrl('/');
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

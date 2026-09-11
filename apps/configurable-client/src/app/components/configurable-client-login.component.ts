import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  LoginBlockComponent,
  normalizeAuthReturnTo,
  OAuthProviderEvent,
  OAuthService,
} from '@optimistic-tanuki/auth-ui';
import { LoginType } from '@optimistic-tanuki/ui-models';
import { firstValueFrom } from 'rxjs';
import {
  AuthSessionService,
  CONFIGURABLE_CLIENT_APP_SCOPE,
} from '../services/auth-session.service';

const FALLBACK_RETURN_TO = '/';

@Component({
  selector: 'app-configurable-client-login',
  standalone: true,
  imports: [CommonModule, LoginBlockComponent],
  template: `
    <main
      class="login-page"
      aria-labelledby="configurable-client-login-heading"
    >
      <div class="login-card">
        <p class="eyebrow">Configurable Client</p>
        <h1 id="configurable-client-login-heading">Sign in to continue.</h1>
        <p>
          Use your owner account to open a protected application configuration.
        </p>
        <lib-login-block
          [appId]="appScope"
          [returnPath]="returnPath"
          title="Sign in to Configurable Client"
          description="Open your workspace configuration securely."
          (submitEvent)="onSubmit($event)"
          (oauthProviderSelected)="onOAuthProvider($event)"
        ></lib-login-block>
        @if (error) {
        <p class="error" role="alert">{{ error }}</p>
        }
      </div>
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .login-page {
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 1.5rem;
      }
      .login-card {
        width: min(100%, 42rem);
      }
      .eyebrow {
        margin: 0 0 0.75rem;
        font: 700 0.75rem/1.2 ui-monospace, monospace;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
      h1 {
        margin: 0;
      }
      .error {
        color: var(--danger, var(--ot-client-login-danger));
      }
    `,
  ],
})
export class ConfigurableClientLoginComponent implements OnInit {
  readonly appScope = CONFIGURABLE_CLIENT_APP_SCOPE;
  readonly returnPath: string;
  error = '';

  private readonly auth = inject(AuthSessionService);
  private readonly http = inject(HttpClient);
  private readonly oauth = inject(OAuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  constructor() {
    this.returnPath = this.safeReturnPath();
  }

  ngOnInit(): void {
    void firstValueFrom(this.http.get('/api/oauth/config'))
      .then((config) =>
        this.oauth.configureProviders(config as Record<string, object>)
      )
      .catch(() => undefined);
  }

  async onSubmit(event: LoginType): Promise<void> {
    this.error = '';
    try {
      if (await this.auth.login(event)) {
        await this.router.navigateByUrl(this.returnPath);
      } else {
        this.error = 'We could not restore your session. Please try again.';
      }
    } catch {
      this.error =
        'We could not sign you in. Check your details and try again.';
    }
  }

  async onOAuthProvider(event: OAuthProviderEvent): Promise<void> {
    this.error = '';
    try {
      const result = await this.oauth.initiateOAuthLogin(
        event.provider,
        CONFIGURABLE_CLIENT_APP_SCOPE,
        true
      );
      if (!result.success || !(await this.auth.restoreSession())) {
        this.error = 'We could not restore your session. Please try again.';
        return;
      }
      await this.router.navigateByUrl(this.returnPath);
    } catch {
      this.error = 'We could not complete sign in. Please try again.';
    }
  }

  private safeReturnPath(): string {
    const returnTo = this.route.snapshot.queryParamMap.get('returnTo');
    const currentOrigin =
      typeof window !== 'undefined' && window.location.origin
        ? window.location.origin
        : 'http://configurable-client.invalid';
    const target = normalizeAuthReturnTo(returnTo, { currentOrigin });
    return target?.isCurrentOrigin ? target.path : FALLBACK_RETURN_TO;
  }
}

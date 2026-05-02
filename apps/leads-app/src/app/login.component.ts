import { Component, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import {
  LoginBlockComponent,
  OAuthProviderEvent,
  OAuthService,
} from '@optimistic-tanuki/auth-ui';
import { LoginType } from '@optimistic-tanuki/ui-models';
import { AuthStateService } from './auth-state.service';
import { ProfileService } from './profile.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [LoginBlockComponent],
  template: `
    <section class="auth-shell">
      <div class="auth-copy">
        <p class="eyebrow">Lead Command</p>
        <h1>Sign in to your leads workspace.</h1>
        <p>
          Authentication, profile setup, onboarding, and workspace access all
          run through the same app-scoped flow.
        </p>
      </div>
      <lib-login-block
        (submitEvent)="onSubmit($event)"
        (oauthProviderSelected)="onOAuthProvider($event)"
      ></lib-login-block>
    </section>
  `,
  styles: [
    `
      .auth-shell {
        min-height: calc(100vh - 56px);
        display: grid;
        grid-template-columns: minmax(0, 420px) minmax(320px, 480px);
        gap: 3rem;
        align-items: center;
        justify-content: center;
        padding: 3rem 1.5rem;
      }
      .auth-copy {
        max-width: 28rem;
      }
      .eyebrow {
        margin: 0 0 0.75rem;
        font-size: 0.8rem;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--app-primary);
      }
      h1 {
        margin: 0 0 1rem;
        font-size: clamp(2rem, 3vw, 3rem);
        line-height: 1;
      }
      p {
        margin: 0;
        color: var(--app-foreground-muted);
      }
      @media (max-width: 900px) {
        .auth-shell {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class LoginComponent {
  private readonly authState = inject(AuthStateService);
  private readonly http = inject(HttpClient);
  private readonly profileService = inject(ProfileService);
  private readonly router = inject(Router);
  private readonly oauthService = new OAuthService(this.http, '/api');

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

  async onSubmit(event: LoginType) {
    await this.authState.login(event);
    await this.profileService.getAllProfiles();

    const profile = this.profileService.getEffectiveProfile();
    if (profile && profile.appScope === 'leads-app') {
      await this.profileService.activateProfile(profile);
      await this.router.navigate(['/']);
      return;
    }

    await this.router.navigate(['/profile/setup']);
  }

  async onOAuthProvider(event: OAuthProviderEvent): Promise<void> {
    const result = await this.oauthService.initiateOAuthLogin(
      event.provider,
      'leads-app'
    );

    if (result.success && result.token) {
      this.authState.setToken(result.token);
      await this.handleAuthenticatedUser();
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
        await this.handleAuthenticatedUser();
      }
    }
  }

  private async handleAuthenticatedUser(): Promise<void> {
    await this.profileService.getAllProfiles();

    const profile = this.profileService.getEffectiveProfile();
    if (profile && profile.appScope === 'leads-app') {
      await this.profileService.activateProfile(profile);
      await this.router.navigate(['/']);
      return;
    }

    await this.router.navigate(['/profile/setup']);
  }
}

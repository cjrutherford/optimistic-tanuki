import { Component, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import {
  LoginBlockComponent,
  OAuthProviderEvent,
  OAuthService,
} from '@optimistic-tanuki/auth-ui';
import { LoginType } from '@optimistic-tanuki/ui-models';
import { AuthShellComponent } from './auth-shell.component';
import { AuthStateService } from './auth-state.service';
import { ProfileService } from './profile.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [AuthShellComponent, LoginBlockComponent],
  template: `
    <app-auth-shell
      headline="Sign in to your leads workspace."
      lede="Authentication, profile setup, onboarding, and workspace access all run through the same app-scoped flow."
      [signals]="['Pipeline', 'Outreach', 'Scoring', 'Follow-up']"
      switchPrompt="No account yet?"
      switchLabel="Create one"
      switchLink="/register"
    >
      <lib-login-block
        appId="opportunity-compass"
        [showHero]="false"
        [errorMessage]="errorMessage"
        [pending]="pending"
        (submitEvent)="onSubmit($event)"
        (oauthProviderSelected)="onOAuthProvider($event)"
      ></lib-login-block>
    </app-auth-shell>
  `,
})
export class LoginComponent {
  private readonly authState = inject(AuthStateService);
  private readonly http = inject(HttpClient);
  private readonly profileService = inject(ProfileService);
  private readonly router = inject(Router);
  private readonly oauthService = new OAuthService(this.http, '/api');

  errorMessage = '';
  pending = false;

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
    if (this.pending) {
      return;
    }

    this.errorMessage = '';
    this.pending = true;

    try {
      await this.authState.login(event);
      await this.handleAuthenticatedUser();
    } catch {
      // A failed sign-in previously rejected silently and left the user on an
      // unchanged form with no indication anything had happened.
      this.errorMessage =
        'That email and password did not match an account. Check them and try again.';
    } finally {
      this.pending = false;
    }
  }

  async onOAuthProvider(event: OAuthProviderEvent): Promise<void> {
    if (this.pending) {
      return;
    }

    this.errorMessage = '';
    this.pending = true;

    try {
      const result = await this.oauthService.initiateOAuthLogin(
        event.provider,
        'leads-app'
      );

      if (result.success) {
        await this.authState.restoreSession();
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

        if (regResult.success) {
          await this.authState.restoreSession();
          await this.handleAuthenticatedUser();
          return;
        }
      }

      this.errorMessage = `Signing in with ${event.provider} did not complete. Try again or use your email and password.`;
    } catch {
      this.errorMessage = `Signing in with ${event.provider} did not complete. Try again or use your email and password.`;
    } finally {
      this.pending = false;
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

import { Component, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import {
  OAuthProviderEvent,
  OAuthService,
  RegisterBlockComponent,
} from '@optimistic-tanuki/auth-ui';
import {
  RegisterSubmitType,
  submitTypeToRegisterRequest,
} from '@optimistic-tanuki/ui-models';
import { AuthenticationService } from './authentication.service';
import { AuthShellComponent } from './auth-shell.component';
import { AuthStateService } from './auth-state.service';
import { ProfileService } from './profile.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [AuthShellComponent, RegisterBlockComponent],
  template: `
    <app-auth-shell
      headline="Create your account."
      lede="Registration creates your Leads user account. The leads-specific profile setup happens after sign-in."
      [signals]="['Prospects', 'Qualification', 'Follow-through', 'Activation']"
      switchPrompt="Already have an account?"
      switchLabel="Sign in"
      switchLink="/login"
    >
      <lib-register-block
        [showHero]="false"
        [errorMessage]="errorMessage"
        [pending]="pending"
        registerButtonText="Create account"
        (submitEvent)="onSubmit($event)"
        (oauthProviderSelected)="onOAuthProvider($event)"
      ></lib-register-block>
    </app-auth-shell>
  `,
})
export class RegisterComponent {
  private readonly authenticationService = inject(AuthenticationService);
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

  onSubmit(event: RegisterSubmitType) {
    if (this.pending) {
      return;
    }

    this.errorMessage = '';
    this.pending = true;

    const request = submitTypeToRegisterRequest(event);
    this.authenticationService.register(request).subscribe({
      next: async () => {
        this.pending = false;
        await this.router.navigate(['/login']);
      },
      // Registration failures previously had no `error` handler at all, so a
      // rejected sign-up looked identical to doing nothing.
      error: () => {
        this.pending = false;
        this.errorMessage =
          'That account could not be created. The email may already be registered.';
      },
    });
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

      this.errorMessage = `Signing up with ${event.provider} did not complete. Try again or register with your email.`;
    } catch {
      this.errorMessage = `Signing up with ${event.provider} did not complete. Try again or register with your email.`;
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

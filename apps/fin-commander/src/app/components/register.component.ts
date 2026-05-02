import { Component, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import {
  OAuthProviderEvent,
  OAuthService,
  RegisterBlockComponent,
} from '@optimistic-tanuki/auth-ui';
import { RegisterSubmitType } from '@optimistic-tanuki/ui-models';
import { AuthenticationService } from '../authentication.service';
import { AuthStateService } from '../state/auth-state.service';
import { FinanceService } from '@optimistic-tanuki/finance-ui';
import { ProfileService } from '../profile.service';
import { TenantContextService } from '../tenant-context.service';
import { resolveNextSetupRoute } from '../setup-route-policy';

@Component({
  selector: 'fc-register',
  standalone: true,
  imports: [RegisterBlockComponent],
  template: `
    <lib-register-block
      registerHeader="Create Fin Commander Account"
      registerButtonText="Register"
      heroSrc="'images/register-splash.png'"
      callToAction="Create an account for your finance workspace."
      (submitEvent)="onSubmit($event)"
      (oauthProviderSelected)="onOAuthProvider($event)"
    />
  `,
})
export class RegisterComponent {
  private readonly authenticationService = inject(AuthenticationService);
  private readonly authStateService = inject(AuthStateService);
  private readonly financeService = inject(FinanceService);
  private readonly http = inject(HttpClient);
  private readonly profileService = inject(ProfileService);
  private readonly tenantContext = inject(TenantContextService);
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

  onSubmit(event: RegisterSubmitType) {
    const email = event.email.trim().toLowerCase();

    this.authenticationService
      .register({
        email,
        password: event.password,
        confirm: event.confirmation,
        fn: event.firstName,
        ln: event.lastName,
        bio: event.bio,
      })
      .subscribe({
        next: () => {
          void this.router.navigate(['/login']);
        },
      });
  }

  async onOAuthProvider(event: OAuthProviderEvent): Promise<void> {
    const result = await this.oauthService.initiateOAuthLogin(
      event.provider,
      'finance'
    );

    if (result.success && result.token) {
      this.authStateService.setToken(result.token);
      await this.handlePostLogin();
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
        this.authStateService.setToken(regResult.token);
        await this.handlePostLogin();
      }
    }
  }

  private async handlePostLogin(): Promise<void> {
    await this.profileService.getAllProfiles();
    const selectedProfile =
      this.profileService.getCurrentUserProfile() ??
      this.profileService.getEffectiveProfile();

    if (!selectedProfile) {
      await this.router.navigate(['/settings']);
      return;
    }

    this.profileService.selectProfile(selectedProfile);

    try {
      await this.tenantContext.loadTenantContext();
    } catch {
      // A brand-new finance user may not have an account yet.
    }

    const nextRoute = await resolveNextSetupRoute(
      this.profileService,
      this.tenantContext,
      this.financeService
    );

    if (nextRoute) {
      await this.router.navigate(nextRoute);
      return;
    }

    await this.router.navigate(['/finance']);
  }
}

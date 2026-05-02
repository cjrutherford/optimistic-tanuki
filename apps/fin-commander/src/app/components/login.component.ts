import { Component, OnInit, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { FinanceService } from '@optimistic-tanuki/finance-ui';
import {
  LoginBlockComponent,
  OAuthProviderEvent,
  OAuthService,
} from '@optimistic-tanuki/auth-ui';
import { LoginType } from '@optimistic-tanuki/ui-models';
import { AuthStateService } from '../state/auth-state.service';
import { ProfileService } from '../profile.service';
import { resolveNextSetupRoute } from '../setup-route-policy';
import { TenantContextService } from '../tenant-context.service';

@Component({
  selector: 'fc-login',
  standalone: true,
  imports: [LoginBlockComponent],
  template: `
    <lib-login-block
      title="Fin Commander Login"
      [heroSrc]="'images/login-splash.png'"
      description="Authenticate to access your finance command surfaces."
      (submitEvent)="onSubmit($event)"
      (oauthProviderSelected)="onOAuthProvider($event)"
    />
  `,
})
export class LoginComponent implements OnInit {
  private readonly authStateService = inject(AuthStateService);
  private readonly financeService = inject(FinanceService);
  private readonly http = inject(HttpClient);
  private readonly profileService = inject(ProfileService);
  private readonly tenantContext = inject(TenantContextService);
  private readonly router = inject(Router);
  private readonly oauthService = new OAuthService(this.http, '/api');

  ngOnInit(): void {
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
    const email = event.email.trim().toLowerCase();

    await this.authStateService.login({
      email,
      password: event.password,
    });

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

import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FinanceService } from '@optimistic-tanuki/finance-ui';
import { LoginBlockComponent } from '@optimistic-tanuki/auth-ui';
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
      description="Authenticate to access your finance command surfaces."
      (submitEvent)="onSubmit($event)"
    />
  `,
})
export class LoginComponent {
  private readonly authStateService = inject(AuthStateService);
  private readonly financeService = inject(FinanceService);
  private readonly profileService = inject(ProfileService);
  private readonly tenantContext = inject(TenantContextService);
  private readonly router = inject(Router);

  async onSubmit(event: LoginType) {
    await this.authStateService.login({
      email: event.email,
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

    await this.tenantContext.loadTenantContext();
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

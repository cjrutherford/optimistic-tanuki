import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, PLATFORM_ID, inject } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthStateService } from './auth-state.service';
import { OnboardingGateService } from './onboarding-gate.service';
import { ProfileService } from './profile.service';

@Component({
  selector: 'app-home-redirect',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="redirect-shell">
      <div class="redirect-card">
        <p class="eyebrow">Lead Command</p>
        <h1>Preparing your workspace</h1>
        <p>Checking your account, profile, and onboarding state.</p>
      </div>
    </section>
  `,
  styles: [
    `
      .redirect-shell {
        min-height: calc(100vh - 56px);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem 1rem;
      }

      .redirect-card {
        width: min(32rem, 100%);
        padding: 2rem;
        border-radius: var(--radius-xl);
        border: 1px solid var(--app-border);
        background: var(--app-surface);
        text-align: center;
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
        margin: 0 0 0.75rem;
      }

      p {
        margin: 0;
        color: var(--app-foreground-muted);
      }
    `,
  ],
})
export class HomeRedirectComponent {
  private readonly router = inject(Router);
  private readonly authState = inject(AuthStateService);
  private readonly profileService = inject(ProfileService);
  private readonly onboardingGateService = inject(OnboardingGateService);
  private readonly platformId = inject(PLATFORM_ID);

  constructor() {
    void this.resolveRoute();
  }

  private async resolveRoute(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    if (!this.authState.isAuthenticated) {
      await this.router.navigateByUrl('/login', { replaceUrl: true });
      return;
    }

    await this.profileService.getAllProfiles();

    const profile = this.profileService.getEffectiveProfile();
    if (!profile || profile.appScope !== 'leads-app') {
      await this.router.navigateByUrl('/profile/setup', { replaceUrl: true });
      return;
    }

    await this.profileService.activateProfile(profile);

    const onboardingState = await firstValueFrom(
      this.onboardingGateService.getState(true)
    );

    if (onboardingState.requiresOnboarding) {
      await this.router.navigateByUrl('/onboarding', { replaceUrl: true });
      return;
    }

    await this.router.navigateByUrl('/leads', { replaceUrl: true });
  }
}

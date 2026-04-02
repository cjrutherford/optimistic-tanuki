import { Injectable, inject } from '@angular/core';
import { CanActivate, Router, RouterStateSnapshot } from '@angular/router';
import { AuthStateService } from '../state/auth-state.service';
import { ProfileService } from '../state/profile.service';
import { ReturnIntentService } from '../state/return-intent.service';

@Injectable({
  providedIn: 'root',
})
export class ProfileReadyGuard implements CanActivate {
  private readonly router = inject(Router);
  private readonly authState = inject(AuthStateService);
  private readonly profileService = inject(ProfileService);
  private readonly returnIntent = inject(ReturnIntentService);

  async canActivate(_route: never, state: RouterStateSnapshot): Promise<boolean> {
    if (!this.authState.isAuthenticated) {
      this.returnIntent.remember(state.url);
      this.router.navigate(['/login']);
      return false;
    }

    await this.profileService.getAllProfiles();
    const effectiveProfile = this.profileService.getEffectiveProfile();

    if (effectiveProfile) {
      this.profileService.selectProfile(effectiveProfile);
      return true;
    }

    this.returnIntent.remember(state.url);
    this.router.navigate(['/profile-gate']);
    return false;
  }
}

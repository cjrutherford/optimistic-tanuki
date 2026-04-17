import { Injectable, inject } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthStateService } from '../state/auth-state.service';
import { ProfileService } from '../profile.service';

@Injectable({
  providedIn: 'root',
})
export class ProfileGuard implements CanActivate {
  private readonly router = inject(Router);
  private readonly authStateService = inject(AuthStateService);
  private readonly profileService = inject(ProfileService);
  private isAuthenticated = false;

  constructor() {
    this.authStateService.isAuthenticated$.subscribe((isAuthenticated) => {
      this.isAuthenticated = isAuthenticated;
    });
  }

  async canActivate(): Promise<boolean> {
    if (!this.isAuthenticated) {
      await this.router.navigate(['/login']);
      return false;
    }

    try {
      await this.profileService.getAllProfiles();
      const selectedProfile =
        this.profileService.getCurrentUserProfile() ??
        this.profileService.getCurrentUserProfiles()[0] ??
        this.authStateService.getPersistedSelectedProfile();

      if (!selectedProfile) {
        await this.router.navigate(['/login']);
        return false;
      }

      this.profileService.selectProfile(selectedProfile);
      return true;
    } catch {
      await this.router.navigate(['/login']);
      return false;
    }
  }
}

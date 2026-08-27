import { CanActivate, Router } from '@angular/router';
import { Injectable, inject } from '@angular/core';

import { AuthStateService } from './auth-state.service';
import { ProfileService } from './profile/profile.service';

@Injectable({
  providedIn: 'root',
})
export class ProfileGuard implements CanActivate {
  private router = inject(Router);
  private authStateService = inject(AuthStateService);
  private profileService = inject(ProfileService);

  async canActivate(): Promise<boolean> {
    if (!this.authStateService.isInitialSessionRestoreComplete) {
      await this.authStateService.waitForInitialSessionRestore();
    }

    if (
      !this.authStateService.isAuthenticated &&
      !(await this.authStateService.restoreSessionAfterInitialFailure())
    ) {
      this.router.navigate(['/settings']);
      return false;
    }

    try {
      await this.profileService.getAllProfiles();
      const selectedProfile = localStorage.getItem('selectedProfile');
      if (selectedProfile) {
        this.profileService.selectProfile(JSON.parse(selectedProfile));
      }
      return true;
    } catch (error) {
      this.router.navigate(['/profile']);
      console.error('Error fetching profiles:', error);
      return false;
    }
  }
}

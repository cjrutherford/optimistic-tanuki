import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivate, Router } from '@angular/router';
import { AuthStateService } from '../state/auth-state.service';
import { ProfileService } from '../profile.service';

@Injectable({
  providedIn: 'root',
})
export class ProfileGuard implements CanActivate {
  private router = inject(Router);
  private authStateService = inject(AuthStateService);
  private platformId = inject(PLATFORM_ID);
  private isAuthenticated = false;

  constructor(private readonly profileService: ProfileService) {
    this.authStateService.isAuthenticated$.subscribe((isAuthenticated) => {
      this.isAuthenticated = isAuthenticated;
    });
  }

  async canActivate(): Promise<boolean> {
    if (!this.isAuthenticated) {
      this.isAuthenticated = await this.authStateService.restoreSession();
    }

    if (this.isAuthenticated) {
      try {
        await this.profileService.getAllProfiles();
        const profiles = this.profileService.getCurrentUserProfiles();
        if (!profiles.length) {
          this.router.navigate(['/settings'], {
            state: {
              showProfileModal: true,
              profileMessage: 'Please create a profile to continue.',
            },
          });
          return false;
        }
        if (isPlatformBrowser(this.platformId)) {
          const sessionProfileId =
            this.authStateService.getDecodedTokenValue()?.profileId;
          const sessionProfile = profiles.find(
            (profile) => profile.id === sessionProfileId
          );
          if (!sessionProfile) {
            this.router.navigate(['/settings'], {
              state: {
                showProfileModal: false,
                profileMessage:
                  'Your active profile could not be loaded. Please sign in again.',
              },
            });
            return false;
          }
          this.profileService.selectProfile(sessionProfile);
        }
        return true;
      } catch (error) {
        console.error('Error fetching profiles:', error);
        return false;
      }
    }
    this.router.navigate(['/login']);
    return false;
  }
}

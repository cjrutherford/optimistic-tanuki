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
    if (this.isAuthenticated) {
      try {
        await this.profileService.getAllProfiles();
        if (isPlatformBrowser(this.platformId)) {
          const selectedProfile = localStorage.getItem('selectedProfile');
          if (selectedProfile) {
            this.profileService.selectProfile(JSON.parse(selectedProfile));
          }
        }
        return true;
      } catch (error) {
        console.error('Error fetching profiles:', error);
        return false;
      }
    }
    // If the user is not authenticated, navigate to the login page
    this.router.navigate(['/profile']);
    return false;
  }
}

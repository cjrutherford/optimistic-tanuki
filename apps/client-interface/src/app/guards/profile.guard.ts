import { Injectable, inject } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthStateService } from '../state/auth-state.service';
import { ProfileService } from '../profile.service';

/**
 * A guard that checks if the user has a profile selected before allowing access to a route.
 */
@Injectable({
  providedIn: 'root'
})
export class ProfileGuard implements CanActivate {
  private router = inject(Router);
  private authStateService = inject(AuthStateService);
  private isAuthenticated = false;

  /**
   * Creates an instance of ProfileGuard.
   * @param profileService The ProfileService instance.
   */
  constructor(
    private readonly profileService: ProfileService,
  ) {
    this.authStateService.isAuthenticated$.subscribe(isAuthenticated => {
      this.isAuthenticated = isAuthenticated;
    });

  }

  /**
   * Determines if the route can be activated.
   * @returns A Promise that resolves to a boolean indicating whether the route can be activated.
   */
  async canActivate(): Promise<boolean> {
    if (this.isAuthenticated) {
      try {
        await this.profileService.getAllProfiles();
        const selectedProfile = localStorage.getItem('selectedProfile');
        if (selectedProfile) {
          this.profileService.selectProfile(JSON.parse(selectedProfile));
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
import { Injectable, inject } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthStateService } from '../state/auth-state.service';
import { ProfileService } from '../profile.service';

/**
 * A guard that checks if the user is authenticated before allowing access to a route.
 */
@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  private router = inject(Router);
  private authStateService = inject(AuthStateService);
  private isAuthenticated = false;

  /**
   * Creates an instance of AuthGuard.
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
        return true;
    }
    // If the user is not authenticated, navigate to the login page
    this.router.navigate(['/login']);
    return false;
  }
}

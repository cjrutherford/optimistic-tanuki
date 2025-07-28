import { CanActivate, Router } from '@angular/router';
import { Injectable, inject } from '@angular/core';

import { AuthStateService } from './auth-state.service';
import { ProfileService } from './profile.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  private router = inject(Router);
  private authStateService = inject(AuthStateService);
  private isAuthenticated = false;

  constructor(
    private readonly profileService: ProfileService,
  ) {
    this.authStateService.isAuthenticated$.subscribe(isAuthenticated => {
      this.isAuthenticated = isAuthenticated;
    });

  }

  async canActivate(): Promise<boolean> {
    if (this.isAuthenticated) {
        return true;
    }
    // If the user is not authenticated, navigate to the login page
    this.router.navigate(['/login']);
    return false;
  }
}

import { Injectable, inject } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthStateService } from '../services/auth-state.service';

@Injectable({
  providedIn: 'root',
})
export class AuthGuard implements CanActivate {
  private router = inject(Router);
  private authStateService = inject(AuthStateService);
  private isAuthenticated = false;

  constructor() {
    this.authStateService.isAuthenticated$.subscribe((isAuthenticated) => {
      this.isAuthenticated = isAuthenticated;
    });
  }

  async canActivate(): Promise<boolean> {
    if (this.isAuthenticated) {
      return true;
    }
    this.router.navigate(['/login']);
    return false;
  }
}

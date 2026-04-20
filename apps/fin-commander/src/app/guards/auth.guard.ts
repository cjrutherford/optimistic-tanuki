import { Injectable, inject } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthStateService } from '../state/auth-state.service';

@Injectable({
  providedIn: 'root',
})
export class AuthGuard implements CanActivate {
  private readonly router = inject(Router);
  private readonly authStateService = inject(AuthStateService);
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

    await this.router.navigate(['/login']);
    return false;
  }
}

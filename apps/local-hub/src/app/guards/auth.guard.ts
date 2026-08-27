import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { CanActivate, Router } from '@angular/router';
import { AuthStateService } from '../services/auth-state.service';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AuthGuard implements CanActivate {
  private router = inject(Router);
  private authStateService = inject(AuthStateService);
  private platformId = inject(PLATFORM_ID);

  async canActivate(): Promise<boolean> {
    // SSR protected requests have already passed Local Hub's Express gateway
    // session check. API routes still enforce authorization at the gateway.
    if (isPlatformServer(this.platformId)) {
      return true;
    }

    try {
      await this.authStateService.waitForSessionRestore();
    } catch {
      // Treat a failed session check as unauthenticated.
    }
    const isAuthenticated = await firstValueFrom(
      this.authStateService.isAuthenticated$
    );
    if (isAuthenticated) {
      return true;
    }
    this.router.navigate(['/login']);
    return false;
  }
}

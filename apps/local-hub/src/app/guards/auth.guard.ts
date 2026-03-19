import { Injectable, inject } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthStateService } from '../services/auth-state.service';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AuthGuard implements CanActivate {
  private router = inject(Router);
  private authStateService = inject(AuthStateService);

  async canActivate(): Promise<boolean> {
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

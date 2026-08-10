import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthStateService } from './auth-state.service';
import { from, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AuthenticationGuard implements CanActivate {
  constructor(private authState: AuthStateService, private router: Router) {}

  canActivate(): Observable<boolean> {
    return from(this.canActivateWithCurrentAuthState());
  }

  private async canActivateWithCurrentAuthState(): Promise<boolean> {
    if (!this.authState.isInitialSessionRestoreComplete) {
      await this.authState.waitForInitialSessionRestore();
    }

    if (this.authState.isAuthenticated) {
      return true;
    }

    if (await this.authState.restoreSessionAfterInitialFailure()) {
      return true;
    }

    this.router.navigate(['/login']);
    return false;
  }
}

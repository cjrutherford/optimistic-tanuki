import { Injectable, inject } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthStateService } from './auth-state.service';
import { map } from 'rxjs/operators';
import { from, Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AlreadyAuthenticatedGuard implements CanActivate {
  private authState = inject(AuthStateService);
  private router = inject(Router);

  canActivate(): Observable<boolean> {
    if (this.authState.isInitialSessionRestoreComplete) {
      return of(this.canActivateWithCurrentAuthState());
    }

    return from(this.authState.waitForInitialSessionRestore()).pipe(
      map(() => this.canActivateWithCurrentAuthState())
    );
  }

  private canActivateWithCurrentAuthState(): boolean {
    if (!this.authState.isAuthenticated) {
      return true;
    }
    this.router.navigate(['/projects']);
    return false;
  }
}

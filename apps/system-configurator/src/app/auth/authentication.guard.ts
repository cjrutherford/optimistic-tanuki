import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { map, Observable, take } from 'rxjs';
import { AuthStateService } from '../state/auth-state.service';

@Injectable({
  providedIn: 'root',
})
export class AuthenticationGuard implements CanActivate {
  constructor(
    private readonly authState: AuthStateService,
    private readonly router: Router
  ) {}

  canActivate(): Observable<boolean> {
    return this.authState.isAuthenticated$().pipe(
      take(1),
      map((isAuthenticated) => {
        if (isAuthenticated) {
          return true;
        }
        this.router.navigate(['/login']);
        return false;
      })
    );
  }
}

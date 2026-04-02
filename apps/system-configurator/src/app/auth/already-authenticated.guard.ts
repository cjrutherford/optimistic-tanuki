import { Injectable, inject } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { map, Observable, take } from 'rxjs';
import { AuthStateService } from '../state/auth-state.service';
import { ReturnIntentService } from '../state/return-intent.service';

@Injectable({
  providedIn: 'root',
})
export class AlreadyAuthenticatedGuard implements CanActivate {
  private readonly authState = inject(AuthStateService);
  private readonly router = inject(Router);
  private readonly returnIntent = inject(ReturnIntentService);

  canActivate(): Observable<boolean> {
    return this.authState.isAuthenticated$().pipe(
      take(1),
      map((isAuthenticated) => {
        if (!isAuthenticated) {
          return true;
        }

        const destination = this.returnIntent.consume() || '/';
        this.router.navigate([destination]);
        return false;
      })
    );
  }
}

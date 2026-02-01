import { Injectable, inject } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthStateService } from './auth-state.service';
import { map, take } from 'rxjs/operators';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AuthenticationGuard implements CanActivate {
  private authState = inject(AuthStateService);
  private router = inject(Router);


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

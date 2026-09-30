import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStateService } from '../services/auth-state.service';
import { ProfileService } from '../services/profile.service';
import { from, Observable, of } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';

export const ProfileGuard: CanActivateFn = (route, state) => {
  const authState = inject(AuthStateService);
  const profileService = inject(ProfileService);
  const router = inject(Router);

  const checkProfile = (): Observable<boolean> => {
    if (profileService.getCurrentUserProfile()) {
      return of(true);
    }
    return from(profileService.getAllProfiles()).pipe(
      map(() => {
        const effectiveProfile = profileService.getEffectiveProfile();
        if (effectiveProfile) {
          profileService.selectProfile(effectiveProfile);
          return true;
        }
        // The dashboard is itself behind this guard; redirecting to it from
        // itself re-ran the guard forever. Let it render without a profile.
        if (state.url.startsWith('/dashboard')) {
          return true;
        }
        router.navigate(['/dashboard']);
        return false;
      })
    );
  };

  // Wait for the cookie session check so a reload doesn't bounce to /login.
  return from(authState.ensureSession()).pipe(
    switchMap(() => {
      if (!authState.isLoggedIn()) {
        router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
        return of(false);
      }
      return checkProfile();
    })
  );
};

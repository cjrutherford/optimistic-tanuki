import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStateService } from '../services/auth-state.service';
import { ProfileService } from '../services/profile.service';
import { from, of } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';

export const ProfileGuard: CanActivateFn = (route, state) => {
  const authState = inject(AuthStateService);
  const profileService = inject(ProfileService);
  const router = inject(Router);

  if (!authState.isLoggedIn()) {
    router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }

  const profile = profileService.getCurrentUserProfile();
  if (profile) {
    return true;
  }

  return from(profileService.getAllProfiles()).pipe(
    map(() => {
      const effectiveProfile = profileService.getEffectiveProfile();
      if (effectiveProfile) {
        profileService.selectProfile(effectiveProfile);
        return true;
      }
      router.navigate(['/dashboard']);
      return false;
    })
  );
};

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { from, map, of, switchMap } from 'rxjs';
import { ProfileService } from './profile.service';

export const profileGuard: CanActivateFn = () => {
  const profileService = inject(ProfileService);
  const router = inject(Router);

  return from(profileService.getAllProfiles()).pipe(
    map(() => {
      const profile = profileService.getEffectiveProfile();
      if (!profile || profile.appScope !== 'leads-app') {
        return router.createUrlTree(['/profile/setup']);
      }

      profileService.selectProfile(profile);
      return true;
    }),
    switchMap((result) => of(result))
  );
};

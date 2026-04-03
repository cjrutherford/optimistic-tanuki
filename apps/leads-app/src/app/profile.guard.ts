import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { from, map, switchMap } from 'rxjs';
import { ProfileService } from './profile.service';

export const profileGuard: CanActivateFn = () => {
  const profileService = inject(ProfileService);
  const router = inject(Router);

  return from(profileService.getAllProfiles()).pipe(
    switchMap(async () => {
      const profile = profileService.getEffectiveProfile();
      if (!profile || profile.appScope !== 'leads-app') {
        return router.createUrlTree(['/profile/setup']);
      }

      await profileService.activateProfile(profile);
      return true;
    }),
    map((result) => result)
  );
};
